"""ICS subscription (ADR-0013): 권한, 마스킹, 회전, 비인증 엔드포인트."""

from datetime import UTC, datetime, timedelta

import pytest


async def _create_personal_calendar(client, h, name="개인"):
    res = await client.post(
        "/api/v1/calendars",
        headers=h,
        json={"name": name, "scope": "personal"},
    )
    assert res.status_code == 201, res.text
    return res.json()["id"]


async def _create_shared_calendar(client, h, name="공유"):
    res = await client.post(
        "/api/v1/calendars",
        headers=h,
        json={"name": name, "scope": "shared"},
    )
    assert res.status_code == 201, res.text
    return res.json()["id"]


# ---------- 권한 ----------


@pytest.mark.asyncio
async def test_personal_owner_can_enable(client, auth_headers):
    h = auth_headers("u1", groups=["acme-corp"], active_workspace="acme-corp")
    await client.get("/api/v1/me", headers=h)
    cal_id = await _create_personal_calendar(client, h)
    r = await client.post(
        f"/api/v1/calendars/{cal_id}/subscription", headers=h
    )
    assert r.status_code == 200
    j = r.json()
    assert j["enabled"] is True
    assert j["token"] and len(j["token"]) >= 20
    assert "/api/public/v1/calendars/" in j["url"]
    assert j["token"] in j["url"]


@pytest.mark.asyncio
async def test_other_user_cannot_manage_personal(client, auth_headers):
    h1 = auth_headers("u1", groups=["acme-corp"], active_workspace="acme-corp")
    await client.get("/api/v1/me", headers=h1)
    cal_id = await _create_personal_calendar(client, h1)

    h2 = auth_headers("u2", groups=["acme-corp"], active_workspace="acme-corp")
    await client.get("/api/v1/me", headers=h2)
    # u2 는 u1 의 personal 캘린더 접근 자체 X (404)
    r = await client.post(
        f"/api/v1/calendars/{cal_id}/subscription", headers=h2
    )
    assert r.status_code in (403, 404)


@pytest.mark.asyncio
async def test_shared_requires_workspace_admin(
    client, auth_headers, db_session
):
    from app.models.user_workspace_membership import UserWorkspaceMembership

    h_admin = auth_headers(
        "admin1", groups=["acme-corp"], active_workspace="acme-corp"
    )
    await client.get("/api/v1/me", headers=h_admin)
    m = await db_session.get(UserWorkspaceMembership, ("admin1", "acme-corp"))
    m.role = "admin"
    await db_session.flush()
    cal_id = await _create_shared_calendar(client, h_admin)

    # 일반 member 는 shared 캘린더 subscription 관리 불가
    h_user = auth_headers(
        "u9", groups=["acme-corp"], active_workspace="acme-corp"
    )
    await client.get("/api/v1/me", headers=h_user)
    r = await client.post(
        f"/api/v1/calendars/{cal_id}/subscription", headers=h_user
    )
    assert r.status_code == 403

    # admin 은 가능
    r2 = await client.post(
        f"/api/v1/calendars/{cal_id}/subscription", headers=h_admin
    )
    assert r2.status_code == 200


# ---------- CRUD ----------


@pytest.mark.asyncio
async def test_get_default_disabled(client, auth_headers):
    h = auth_headers("u1", groups=["acme-corp"], active_workspace="acme-corp")
    await client.get("/api/v1/me", headers=h)
    cal_id = await _create_personal_calendar(client, h)
    r = await client.get(
        f"/api/v1/calendars/{cal_id}/subscription", headers=h
    )
    assert r.status_code == 200
    assert r.json() == {"enabled": False, "token": None, "url": None}


@pytest.mark.asyncio
async def test_rotate_invalidates_old_token(client, auth_headers):
    h = auth_headers("u1", groups=["acme-corp"], active_workspace="acme-corp")
    await client.get("/api/v1/me", headers=h)
    cal_id = await _create_personal_calendar(client, h)
    e1 = await client.post(
        f"/api/v1/calendars/{cal_id}/subscription", headers=h
    )
    t1 = e1.json()["token"]

    r = await client.post(
        f"/api/v1/calendars/{cal_id}/subscription/rotate", headers=h
    )
    assert r.status_code == 200
    t2 = r.json()["token"]
    assert t1 != t2

    # 옛 토큰으로 public endpoint 호출 → 404
    pub = await client.get(f"/api/public/v1/calendars/{t1}.ics")
    assert pub.status_code == 404
    # 새 토큰은 200
    pub2 = await client.get(f"/api/public/v1/calendars/{t2}.ics")
    assert pub2.status_code == 200


@pytest.mark.asyncio
async def test_disable_returns_404_on_public(client, auth_headers):
    h = auth_headers("u1", groups=["acme-corp"], active_workspace="acme-corp")
    await client.get("/api/v1/me", headers=h)
    cal_id = await _create_personal_calendar(client, h)
    enable = await client.post(
        f"/api/v1/calendars/{cal_id}/subscription", headers=h
    )
    t = enable.json()["token"]

    pub_ok = await client.get(f"/api/public/v1/calendars/{t}.ics")
    assert pub_ok.status_code == 200

    dis = await client.delete(
        f"/api/v1/calendars/{cal_id}/subscription", headers=h
    )
    assert dis.status_code == 204

    pub_404 = await client.get(f"/api/public/v1/calendars/{t}.ics")
    assert pub_404.status_code == 404


@pytest.mark.asyncio
async def test_rotate_when_disabled_400(client, auth_headers):
    h = auth_headers("u1", groups=["acme-corp"], active_workspace="acme-corp")
    await client.get("/api/v1/me", headers=h)
    cal_id = await _create_personal_calendar(client, h)
    r = await client.post(
        f"/api/v1/calendars/{cal_id}/subscription/rotate", headers=h
    )
    assert r.status_code == 400


# ---------- PIPA 마스킹 ----------


@pytest.mark.asyncio
async def test_booking_event_masked_in_subscription_ics(
    client, auth_headers, db_session
):
    """booking-linked CalendarEvent 는 SUMMARY=bt.title 만, DESCRIPTION 비움."""
    from app.models.booking import Booking
    from app.models.booking_type import BookingType
    from app.models.calendar import Calendar
    from app.models.calendar_event import CalendarEvent

    h = auth_headers("u1", groups=["acme-corp"], active_workspace="acme-corp")
    await client.get("/api/v1/me", headers=h)

    cal_id = await _create_personal_calendar(client, h, name="상담 캘린더")
    cal = await db_session.get(Calendar, cal_id)

    # BookingType + Booking + CalendarEvent (booking-linked)
    bt = BookingType(
        id="bt1",
        owner_type="user",
        owner_user_sub="u1",
        owner_workspace_id=None,
        target_calendar_id=cal.id,
        title="30분 상담",
        description=None,
        duration_minutes=30,
        timezone="Asia/Seoul",
        capacity=1,
        weekly_schedule={"mon": [["09:00", "18:00"]]},
        notify_user_subs=[],
        public_key="pubkey1",
        enabled=True,
    )
    db_session.add(bt)
    await db_session.flush()

    start = datetime.now(UTC) + timedelta(days=1)
    end = start + timedelta(minutes=30)
    ev = CalendarEvent(
        id="ev1",
        calendar_id=cal.id,
        title="30분 상담: 홍길동",  # 고객명 포함
        description="비밀 상담 내용입니다",  # PII
        location="강남역 4번 출구",
        start_at=start,
        end_at=end,
        all_day=False,
        timezone="Asia/Seoul",
        rrule=None,
        recurrence_exceptions=[],
        reminder_minutes_before=None,
        created_by_sub="u1",
    )
    db_session.add(ev)
    await db_session.flush()
    booking = Booking(
        id="bk1",
        booking_type_id=bt.id,
        slot_start_at=start,
        slot_end_at=end,
        customer_name="홍길동",
        customer_email="hong@example.com",
        customer_message="비밀 상담 내용입니다",
        status="active",
        calendar_event_id=ev.id,
        cancel_token="ctok",
        agreed_at=datetime.now(UTC),
    )
    db_session.add(booking)
    await db_session.commit()

    # 활성화
    enable = await client.post(
        f"/api/v1/calendars/{cal_id}/subscription", headers=h
    )
    token = enable.json()["token"]

    # public ICS
    pub = await client.get(f"/api/public/v1/calendars/{token}.ics")
    assert pub.status_code == 200
    body = pub.text

    # SUMMARY 는 bt.title 만 (고객명 X)
    assert "30분 상담" in body
    assert "홍길동" not in body
    # description / location 마스킹
    assert "비밀 상담" not in body
    assert "강남역" not in body


@pytest.mark.asyncio
async def test_non_booking_event_not_masked(
    client, auth_headers, db_session
):
    """운영자가 직접 만든 일정은 마스킹 X: 제목과 설명 그대로."""
    from app.models.calendar import Calendar
    from app.models.calendar_event import CalendarEvent

    h = auth_headers("u1", groups=["acme-corp"], active_workspace="acme-corp")
    await client.get("/api/v1/me", headers=h)

    cal_id = await _create_personal_calendar(client, h, name="내 일정")
    cal = await db_session.get(Calendar, cal_id)

    start = datetime.now(UTC) + timedelta(days=1)
    ev = CalendarEvent(
        id="ev2",
        calendar_id=cal.id,
        title="팀 회의",
        description="주간 회고",
        location="대회의실",
        start_at=start,
        end_at=start + timedelta(hours=1),
        all_day=False,
        timezone="Asia/Seoul",
        rrule=None,
        recurrence_exceptions=[],
        reminder_minutes_before=None,
        created_by_sub="u1",
    )
    db_session.add(ev)
    await db_session.commit()

    enable = await client.post(
        f"/api/v1/calendars/{cal_id}/subscription", headers=h
    )
    token = enable.json()["token"]

    pub = await client.get(f"/api/public/v1/calendars/{token}.ics")
    body = pub.text
    assert "팀 회의" in body
    assert "주간 회고" in body
    assert "대회의실" in body


# ---------- public route ----------


@pytest.mark.asyncio
async def test_unknown_token_404(client):
    r = await client.get(
        "/api/public/v1/calendars/" + ("z" * 32) + ".ics"
    )
    assert r.status_code == 404


@pytest.mark.asyncio
async def test_response_headers(client, auth_headers):
    h = auth_headers("u1", groups=["acme-corp"], active_workspace="acme-corp")
    await client.get("/api/v1/me", headers=h)
    cal_id = await _create_personal_calendar(client, h)
    enable = await client.post(
        f"/api/v1/calendars/{cal_id}/subscription", headers=h
    )
    t = enable.json()["token"]
    r = await client.get(f"/api/public/v1/calendars/{t}.ics")
    assert r.status_code == 200
    assert "text/calendar" in r.headers["content-type"]
    assert "private" in r.headers["cache-control"]
    assert r.text.startswith("BEGIN:VCALENDAR")


@pytest.mark.asyncio
async def test_calendar_list_reports_subscription_enabled(client, auth_headers):
    h = auth_headers("u1", groups=["acme-corp"], active_workspace="acme-corp")
    await client.get("/api/v1/me", headers=h)
    cal_id = await _create_personal_calendar(client, h)

    def _flag(body):
        return next(c for c in body["calendars"] if c["id"] == cal_id)["subscription_enabled"]

    assert _flag((await client.get("/api/v1/calendars", headers=h)).json()) is False
    await client.post(f"/api/v1/calendars/{cal_id}/subscription", headers=h)
    assert _flag((await client.get("/api/v1/calendars", headers=h)).json()) is True
    await client.delete(f"/api/v1/calendars/{cal_id}/subscription", headers=h)
    assert _flag((await client.get("/api/v1/calendars", headers=h)).json()) is False
