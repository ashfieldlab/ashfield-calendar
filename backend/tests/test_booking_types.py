"""/api/v1/booking-types: 운영자 CRUD + 권한 분기 (E-1)."""

import pytest


async def _make_personal_calendar(client, headers) -> str:
    res = await client.post(
        "/api/v1/calendars",
        headers=headers,
        json={"name": "My Cal", "scope": "personal", "color": "#3b82f6"},
    )
    assert res.status_code in (200, 201), res.text
    return res.json()["id"]


async def _make_shared_calendar(client, headers) -> str:
    res = await client.post(
        "/api/v1/calendars",
        headers=headers,
        json={"name": "Team Cal", "scope": "shared", "color": "#10b981"},
    )
    assert res.status_code in (200, 201), res.text
    return res.json()["id"]


_BASE_PAYLOAD = {
    "title": "30분 상담",
    "duration_minutes": 30,
    "timezone": "Asia/Seoul",
    "weekly_schedule": {"mon": [["09:00", "12:00"], ["13:00", "18:00"]]},
    "minimum_notice_minutes": 1440,
    "capacity": 1,
}


@pytest.mark.asyncio
async def test_create_user_owned(client, auth_headers):
    h = auth_headers("alice", groups=["acme-corp"], active_workspace="acme-corp")
    cal_id = await _make_personal_calendar(client, h)
    res = await client.post(
        "/api/v1/booking-types",
        headers=h,
        json={**_BASE_PAYLOAD, "owner_type": "user", "target_calendar_id": cal_id},
    )
    assert res.status_code == 201, res.text
    body = res.json()
    assert body["owner_type"] == "user"
    assert body["owner_user_sub"] == "alice"
    assert body["owner_workspace_id"] is None
    assert len(body["public_key"]) > 8
    # notify_user_subs 기본은 본인
    assert body["notify_user_subs"] == ["alice"]


@pytest.mark.asyncio
async def test_create_workspace_owned_requires_admin(client, auth_headers, db_session):
    from app.models.user_workspace_membership import UserWorkspaceMembership

    h = auth_headers("alice", groups=["acme-corp"], active_workspace="acme-corp")
    cal_id = await _make_shared_calendar(client, h)

    # 일반 멤버 → 403
    res = await client.post(
        "/api/v1/booking-types",
        headers=h,
        json={
            **_BASE_PAYLOAD,
            "owner_type": "workspace",
            "target_calendar_id": cal_id,
        },
    )
    assert res.status_code == 403

    # admin 승격 후 → 201
    m = await db_session.get(UserWorkspaceMembership, ("alice", "acme-corp"))
    m.role = "admin"
    await db_session.flush()

    res = await client.post(
        "/api/v1/booking-types",
        headers=h,
        json={
            **_BASE_PAYLOAD,
            "owner_type": "workspace",
            "target_calendar_id": cal_id,
        },
    )
    assert res.status_code == 201, res.text
    body = res.json()
    assert body["owner_type"] == "workspace"
    assert body["owner_workspace_id"] == "acme-corp"


@pytest.mark.asyncio
async def test_workspace_owned_requires_shared_calendar(client, auth_headers, db_session):
    """owner_type=workspace 면 target_calendar 가 shared 여야 함."""

    h = auth_headers("alice", groups=["acme-corp"], active_workspace="acme-corp", roles=["admin"])
    await client.get("/api/v1/me", headers=h)
    cal_id = await _make_personal_calendar(client, h)  # personal: 거부돼야

    res = await client.post(
        "/api/v1/booking-types",
        headers=h,
        json={
            **_BASE_PAYLOAD,
            "owner_type": "workspace",
            "target_calendar_id": cal_id,
        },
    )
    assert res.status_code == 400
    _ = db_session  # noqa


@pytest.mark.asyncio
async def test_weekly_schedule_validation(client, auth_headers):
    h = auth_headers("alice", groups=["acme-corp"], active_workspace="acme-corp")
    cal_id = await _make_personal_calendar(client, h)
    bad = {
        **_BASE_PAYLOAD,
        "owner_type": "user",
        "target_calendar_id": cal_id,
        "weekly_schedule": {"funday": [["09:00", "18:00"]]},  # 잘못된 요일
    }
    res = await client.post("/api/v1/booking-types", headers=h, json=bad)
    assert res.status_code == 422


@pytest.mark.asyncio
async def test_patch_and_delete(client, auth_headers):
    h = auth_headers("alice", groups=["acme-corp"], active_workspace="acme-corp")
    cal_id = await _make_personal_calendar(client, h)
    res = await client.post(
        "/api/v1/booking-types",
        headers=h,
        json={**_BASE_PAYLOAD, "owner_type": "user", "target_calendar_id": cal_id},
    )
    bt_id = res.json()["id"]

    # PATCH title
    res = await client.patch(
        f"/api/v1/booking-types/{bt_id}",
        headers=h,
        json={"title": "1시간 컨설팅", "duration_minutes": 60},
    )
    assert res.status_code == 200
    assert res.json()["title"] == "1시간 컨설팅"
    assert res.json()["duration_minutes"] == 60

    # rotate-key
    old_key = res.json()["public_key"]
    res = await client.post(
        f"/api/v1/booking-types/{bt_id}/rotate-key", headers=h
    )
    assert res.status_code == 200
    assert res.json()["public_key"] != old_key

    # DELETE
    res = await client.delete(f"/api/v1/booking-types/{bt_id}", headers=h)
    assert res.status_code == 204

    # 삭제 후 조회 404
    res = await client.get(f"/api/v1/booking-types/{bt_id}", headers=h)
    assert res.status_code == 404


@pytest.mark.asyncio
async def test_other_user_cannot_manage(client, auth_headers):
    """alice 의 BookingType 을 bob 이 못 만진다."""
    h_a = auth_headers("alice", groups=["acme-corp"], active_workspace="acme-corp")
    h_b = auth_headers("bob", groups=["acme-corp"], active_workspace="acme-corp")
    cal_id = await _make_personal_calendar(client, h_a)
    res = await client.post(
        "/api/v1/booking-types",
        headers=h_a,
        json={**_BASE_PAYLOAD, "owner_type": "user", "target_calendar_id": cal_id},
    )
    bt_id = res.json()["id"]

    res = await client.get(f"/api/v1/booking-types/{bt_id}", headers=h_b)
    assert res.status_code == 403

    res = await client.patch(
        f"/api/v1/booking-types/{bt_id}", headers=h_b, json={"title": "hack"}
    )
    assert res.status_code == 403


def _next_monday_utc():
    """실행 시점 기준 8일 이후 첫 월요일 00:00 UTC (= 09:00 KST)."""
    from datetime import UTC, datetime, timedelta

    d = datetime.now(UTC).replace(hour=0, minute=0, second=0, microsecond=0)
    d += timedelta(days=8)
    while d.weekday() != 0:
        d += timedelta(days=1)
    return d


async def _make_bt_with_booking(client, h):
    """월 09:00~10:00 KST, 30분, 정원 1. 첫 슬롯(09:00)에 공개 예약 1건."""
    cal_id = await _make_personal_calendar(client, h)
    res = await client.post(
        "/api/v1/booking-types",
        headers=h,
        json={
            **_BASE_PAYLOAD,
            "owner_type": "user",
            "target_calendar_id": cal_id,
            "weekly_schedule": {"mon": [["09:00", "10:00"]]},
            "minimum_notice_minutes": 0,
        },
    )
    bt = res.json()
    mon = _next_monday_utc()
    res = await client.post(
        f"/api/public/v1/booking/{bt['public_key']}/submit",
        json={
            "slot_start_at": mon.isoformat(),
            "customer_name": "고객",
            "customer_email": "c@x.com",
            "consent": True,
        },
    )
    assert res.status_code == 201, res.text
    return bt, mon


@pytest.mark.asyncio
async def test_list_includes_booking_stats(client, auth_headers):
    from datetime import datetime

    h = auth_headers("alice", groups=["acme-corp"], active_workspace="acme-corp")
    bt, mon = await _make_bt_with_booking(client, h)

    res = await client.get("/api/v1/booking-types", headers=h)
    assert res.status_code == 200
    item = next(x for x in res.json()["items"] if x["id"] == bt["id"])
    assert item["upcoming_count"] == 1
    assert item["last_30d_count"] == 1
    assert datetime.fromisoformat(item["next_booking_at"]) == mon


@pytest.mark.asyncio
async def test_list_stats_zero_without_bookings(client, auth_headers):
    h = auth_headers("alice", groups=["acme-corp"], active_workspace="acme-corp")
    cal_id = await _make_personal_calendar(client, h)
    await client.post(
        "/api/v1/booking-types",
        headers=h,
        json={**_BASE_PAYLOAD, "owner_type": "user", "target_calendar_id": cal_id},
    )
    res = await client.get("/api/v1/booking-types", headers=h)
    item = res.json()["items"][0]
    assert item["upcoming_count"] == 0
    assert item["next_booking_at"] is None
    assert item["last_30d_count"] == 0


@pytest.mark.asyncio
async def test_operator_slots_include_full(client, auth_headers):
    """운영자 슬롯: 찬 슬롯도 open=false 로 포함, exclude_booking_id 면 다시 열림."""
    from datetime import datetime, timedelta

    h = auth_headers("alice", groups=["acme-corp"], active_workspace="acme-corp")
    bt, mon = await _make_bt_with_booking(client, h)
    params = {
        "from": (mon - timedelta(hours=1)).isoformat(),
        "to": (mon + timedelta(hours=2)).isoformat(),
    }
    res = await client.get(
        f"/api/v1/booking-types/{bt['id']}/slots", headers=h, params=params
    )
    assert res.status_code == 200, res.text
    slots = res.json()["slots"]
    assert len(slots) == 2
    first, second = slots
    assert datetime.fromisoformat(first["start_at"]) == mon
    assert first["open"] is False
    assert first["remaining"] == 0
    assert second["open"] is True

    # 공개 API 는 찬 슬롯을 돌려주지 않는다
    res = await client.get(
        f"/api/public/v1/booking/{bt['public_key']}/slots", params=params
    )
    assert len(res.json()["slots"]) == 1

    # 일정 변경 중인 그 예약을 빼면 열린다
    bookings = (
        await client.get(f"/api/v1/booking-types/{bt['id']}/bookings", headers=h)
    ).json()["items"]
    res = await client.get(
        f"/api/v1/booking-types/{bt['id']}/slots",
        headers=h,
        params={**params, "exclude_booking_id": bookings[0]["id"]},
    )
    assert all(s["open"] for s in res.json()["slots"])


@pytest.mark.asyncio
async def test_operator_slots_notice_marks_closed(client, auth_headers):
    """최소 예약 시점 이전 슬롯은 open=false 로 포함."""
    from datetime import timedelta

    h = auth_headers("alice", groups=["acme-corp"], active_workspace="acme-corp")
    bt, mon = await _make_bt_with_booking(client, h)
    res = await client.patch(
        f"/api/v1/booking-types/{bt['id']}",
        headers=h,
        json={"minimum_notice_minutes": 60 * 24 * 365},
    )
    assert res.status_code == 200
    res = await client.get(
        f"/api/v1/booking-types/{bt['id']}/slots",
        headers=h,
        params={
            "from": (mon - timedelta(hours=1)).isoformat(),
            "to": (mon + timedelta(hours=2)).isoformat(),
        },
    )
    slots = res.json()["slots"]
    assert len(slots) == 2
    assert not any(s["open"] for s in slots)


@pytest.mark.asyncio
async def test_operator_slots_forbidden_and_range(client, auth_headers):
    from datetime import timedelta

    h_a = auth_headers("alice", groups=["acme-corp"], active_workspace="acme-corp")
    h_b = auth_headers("bob", groups=["acme-corp"], active_workspace="acme-corp")
    bt, mon = await _make_bt_with_booking(client, h_a)
    params = {"from": mon.isoformat(), "to": (mon + timedelta(days=1)).isoformat()}
    res = await client.get(
        f"/api/v1/booking-types/{bt['id']}/slots", headers=h_b, params=params
    )
    assert res.status_code == 403

    res = await client.get(
        f"/api/v1/booking-types/{bt['id']}/slots",
        headers=h_a,
        params={"from": mon.isoformat(), "to": (mon + timedelta(days=100)).isoformat()},
    )
    assert res.status_code == 400
