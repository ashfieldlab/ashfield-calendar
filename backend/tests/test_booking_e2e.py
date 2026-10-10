"""booking E2E: audit log + 운영자 취소 통지 + 마스킹 후 listing (E-8)."""

import uuid
from datetime import UTC, datetime, timedelta

import pytest


def _mon() -> datetime:
    """실행 시점 기준 미래 월요일 00:00 UTC (= 09:00 KST).

    고정 과거날짜는 now-클램프로 슬롯이 0이 되는 time-rot 이라 상대화한다.
    KST 는 DST 없어 Mon 00:00 UTC = Mon 09:00 KST 고정.
    """
    d = datetime.now(UTC).replace(hour=0, minute=0, second=0, microsecond=0)
    d += timedelta(days=8)
    while d.weekday() != 0:  # 0 = Monday
        d += timedelta(days=1)
    return d


_MON = _mon()
_FROM = _MON - timedelta(days=1)
_TO = _MON + timedelta(days=1)


async def _setup(client, auth_headers):
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
            "capacity": 1,
        },
    )
    return h, res.json()


@pytest.mark.asyncio
async def test_public_booking_writes_audit_with_public_actor(
    client, auth_headers, db_session
):
    """공개 제출 → audit_log 에 actor_type='public' 항목 생성."""
    from sqlalchemy import select

    from app.models.audit_log import AuditLog

    h, bt = await _setup(client, auth_headers)
    slot = _MON
    res = await client.post(
        f"/api/public/v1/booking/{bt['public_key']}/submit",
        json={
            "slot_start_at": slot.isoformat(),
            "customer_name": "외부고객",
            "customer_email": "ext@x.com",
            "consent": True,
        },
    )
    assert res.status_code == 201
    booking_id = None
    # audit row 가져오기
    rows = (
        await db_session.execute(
            select(AuditLog).where(AuditLog.entity_type == "booking")
        )
    ).scalars().all()
    assert len(rows) >= 1
    audit = next(r for r in rows if r.action == "create")
    assert audit.actor_type == "public"
    assert audit.actor_sub is None
    assert audit.meta.get("ip")
    booking_id = audit.entity_id
    assert booking_id
    _ = h


@pytest.mark.asyncio
async def test_operator_lists_bookings_including_after_mask(
    client, auth_headers, db_session
):
    """booking 생성 → 운영자 listing 노출 → PII 마스킹 후 같은 listing 에서 fields NULL."""
    from sqlalchemy import update

    from app.jobs.booking_pii import purge_expired_booking_pii
    from app.models.booking import Booking

    h, bt = await _setup(client, auth_headers)
    slot = _MON
    res = await client.post(
        f"/api/public/v1/booking/{bt['public_key']}/submit",
        json={
            "slot_start_at": slot.isoformat(),
            "customer_name": "고객A",
            "customer_email": "a@x.com",
            "customer_message": "메모",
            "consent": True,
        },
    )
    assert res.status_code == 201

    # 운영자 listing
    res = await client.get(f"/api/v1/booking-types/{bt['id']}/bookings", headers=h)
    items = res.json()["items"]
    assert len(items) == 1
    assert items[0]["customer_name"] == "고객A"

    # slot 전체를 35일 전으로 강제 (slot_end > slot_start 제약 유지)
    past_start = datetime.now(UTC) - timedelta(days=35, hours=1)
    past_end = datetime.now(UTC) - timedelta(days=35)
    await db_session.execute(
        update(Booking).values(slot_start_at=past_start, slot_end_at=past_end)
    )
    await db_session.commit()

    # cron 의 AsyncSessionLocal 우회: 같은 세션 사용
    import contextlib

    import app.jobs.booking_pii as mod

    @contextlib.asynccontextmanager
    async def fake_factory():
        try:
            yield db_session
        finally:
            pass

    mod.AsyncSessionLocal = fake_factory  # type: ignore[assignment]
    affected = await purge_expired_booking_pii({})
    assert affected == 1

    # 다시 listing: PII 마스킹됨, row 는 살아있음
    res = await client.get(f"/api/v1/booking-types/{bt['id']}/bookings", headers=h)
    items = res.json()["items"]
    assert len(items) == 1
    assert items[0]["customer_name"] is None
    assert items[0]["customer_email"] is None


@pytest.mark.asyncio
async def test_operator_cancel_marks_booking_cancelled(client, auth_headers):
    h, bt = await _setup(client, auth_headers)
    slot = _MON
    res = await client.post(
        f"/api/public/v1/booking/{bt['public_key']}/submit",
        json={
            "slot_start_at": slot.isoformat(),
            "customer_name": "X",
            "customer_email": "x@x.com",
            "consent": True,
        },
    )
    booking_list = await client.get(
        f"/api/v1/booking-types/{bt['id']}/bookings", headers=h
    )
    booking_id = booking_list.json()["items"][0]["id"]

    res = await client.post(
        f"/api/v1/booking-types/{bt['id']}/bookings/{booking_id}/cancel",
        headers=h,
    )
    assert res.status_code == 200
    assert res.json()["status"] == "cancelled"

    # 다시 같은 슬롯 가용
    from_ = _FROM
    to = _TO
    res = await client.get(
        f"/api/public/v1/booking/{bt['public_key']}/slots",
        params={"from": from_.isoformat(), "to": to.isoformat()},
    )
    assert len(res.json()["slots"]) == 6
    _ = uuid  # noqa
