"""공개 booking 라우트: 비인증, 동의, honeypot, rate limit (E-3)."""

from datetime import UTC, datetime, timedelta

import pytest


def _mon() -> datetime:
    """실행 시점 기준 미래 월요일 00:00 UTC (= 09:00 KST).

    slot 은 weekly_schedule(월) 기반이라 실제 월요일 date 가 필요한데, 고정 과거날짜는
    시간이 지나며 now-클램프(minimum_notice/현재시각)로 슬롯이 0이 되는 time-rot 이다.
    실행 시점 기준으로 상대화한다. KST 는 DST 없어 Mon 00:00 UTC = Mon 09:00 KST 고정.
    """
    d = datetime.now(UTC).replace(hour=0, minute=0, second=0, microsecond=0)
    d += timedelta(days=8)  # now 여유 (minimum_notice 0 이어도 안전 마진)
    while d.weekday() != 0:  # 0 = Monday
        d += timedelta(days=1)
    return d


_MON = _mon()
_FROM = _MON - timedelta(days=1)
_TO = _MON + timedelta(days=1)


async def _setup_bt(client, auth_headers, *, capacity=1):
    """alice 가 만든 personal 캘린더 + BookingType. public_key 반환."""
    h = auth_headers("alice", groups=["acme-corp"], active_workspace="acme-corp")
    res = await client.post(
        "/api/v1/calendars",
        headers=h,
        json={"name": "B", "scope": "personal", "color": "#3b82f6"},
    )
    cal_id = res.json()["id"]

    res = await client.post(
        "/api/v1/booking-types",
        headers=h,
        json={
            "owner_type": "user",
            "title": "30분 상담",
            "duration_minutes": 30,
            "timezone": "Asia/Seoul",
            "weekly_schedule": {"mon": [["09:00", "12:00"]]},
            "minimum_notice_minutes": 0,
            "target_calendar_id": cal_id,
            "capacity": capacity,
        },
    )
    assert res.status_code == 201, res.text
    return res.json()["public_key"]


@pytest.mark.asyncio
async def test_public_get_booking_type_no_auth(client, auth_headers):
    pk = await _setup_bt(client, auth_headers)
    # 인증 없이 직접 호출
    res = await client.get(f"/api/public/v1/booking/{pk}")
    assert res.status_code == 200
    body = res.json()
    assert body["title"] == "30분 상담"
    assert body["duration_minutes"] == 30
    # 운영자 신원 노출 X
    assert "owner_user_sub" not in body
    assert "alice" not in str(body)


@pytest.mark.asyncio
async def test_public_unknown_key_404(client):
    res = await client.get("/api/public/v1/booking/notfound")
    assert res.status_code == 404


@pytest.mark.asyncio
async def test_public_slots(client, auth_headers):
    pk = await _setup_bt(client, auth_headers)
    # 다음 월요일 범위
    from_ = _FROM
    to = _TO
    res = await client.get(
        f"/api/public/v1/booking/{pk}/slots",
        params={"from": from_.isoformat(), "to": to.isoformat()},
    )
    assert res.status_code == 200
    slots = res.json()["slots"]
    # 09:00–12:00 KST = 30분 슬롯 6개
    assert len(slots) == 6


@pytest.mark.asyncio
async def test_submit_requires_consent(client, auth_headers):
    pk = await _setup_bt(client, auth_headers)
    slot = _MON  # 09:00 KST 월
    res = await client.post(
        f"/api/public/v1/booking/{pk}/submit",
        json={
            "slot_start_at": slot.isoformat(),
            "customer_name": "고객",
            "customer_email": "c@x.com",
            "consent": False,
        },
    )
    assert res.status_code == 422


@pytest.mark.asyncio
async def test_submit_creates_booking_and_event(client, auth_headers):
    pk = await _setup_bt(client, auth_headers)
    slot = _MON
    res = await client.post(
        f"/api/public/v1/booking/{pk}/submit",
        json={
            "slot_start_at": slot.isoformat(),
            "customer_name": "홍길동",
            "customer_email": "hong@x.com",
            "customer_message": "30분 미팅 요청드립니다.",
            "consent": True,
        },
    )
    assert res.status_code == 201, res.text
    body = res.json()
    assert body["title"] == "30분 상담"
    assert len(body["cancel_token"]) > 8
    # 슬롯이 가용 목록에서 빠짐
    from_ = _FROM
    to = _TO
    res = await client.get(
        f"/api/public/v1/booking/{pk}/slots",
        params={"from": from_.isoformat(), "to": to.isoformat()},
    )
    assert len(res.json()["slots"]) == 5


@pytest.mark.asyncio
async def test_honeypot_silently_rejects(client, auth_headers):
    pk = await _setup_bt(client, auth_headers)
    slot = _MON
    res = await client.post(
        f"/api/public/v1/booking/{pk}/submit",
        json={
            "slot_start_at": slot.isoformat(),
            "customer_name": "Bot",
            "customer_email": "bot@x.com",
            "consent": True,
            "website": "http://spam.example",  # honeypot 채움
        },
    )
    # 봇이 알아채지 못하게 201 반환
    assert res.status_code == 201
    # 하지만 실제 토큰은 'discarded'
    assert res.json()["cancel_token"] == "discarded"
    # 슬롯도 여전히 가용: 실제로 안 만들어짐
    from_ = _FROM
    to = _TO
    res = await client.get(
        f"/api/public/v1/booking/{pk}/slots",
        params={"from": from_.isoformat(), "to": to.isoformat()},
    )
    assert len(res.json()["slots"]) == 6


@pytest.mark.asyncio
async def test_cancel_token_flow(client, auth_headers):
    pk = await _setup_bt(client, auth_headers)
    slot = _MON
    res = await client.post(
        f"/api/public/v1/booking/{pk}/submit",
        json={
            "slot_start_at": slot.isoformat(),
            "customer_name": "X", "customer_email": "x@x.com",
            "consent": True,
        },
    )
    token = res.json()["cancel_token"]

    res = await client.post(f"/api/public/v1/booking/cancel/{token}")
    assert res.status_code == 200

    # 슬롯 다시 가용
    from_ = _FROM
    to = _TO
    res = await client.get(
        f"/api/public/v1/booking/{pk}/slots",
        params={"from": from_.isoformat(), "to": to.isoformat()},
    )
    assert len(res.json()["slots"]) == 6


@pytest.mark.asyncio
async def test_submit_race_capacity_1_returns_409(client, auth_headers):
    pk = await _setup_bt(client, auth_headers)
    slot = _MON
    payload = {
        "slot_start_at": slot.isoformat(),
        "customer_name": "A", "customer_email": "a@x.com",
        "consent": True,
    }
    res1 = await client.post(f"/api/public/v1/booking/{pk}/submit", json=payload)
    assert res1.status_code == 201

    payload2 = {**payload, "customer_email": "b@x.com"}
    res2 = await client.post(f"/api/public/v1/booking/{pk}/submit", json=payload2)
    assert res2.status_code == 409
    body = res2.json()
    # BusinessError 형식: code + message + params (skeleton 표준)
    assert body["code"] == "BOOKING_SLOT_FULL"
    assert body["params"]["capacity"] == 1
    assert "request_id" in body
