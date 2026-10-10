"""Booking PII 자동 마스킹 cron (E-5)."""

import uuid
from datetime import UTC, datetime, timedelta

import pytest


@pytest.mark.asyncio
async def test_purge_old_pii(db_session):
    from app.jobs.booking_pii import purge_expired_booking_pii
    from app.models.booking import Booking
    from app.models.booking_type import BookingType
    from app.models.calendar import Calendar
    from app.models.company import Company
    from app.models.user import User

    db_session.add(Company(id="acme-corp", name="acme-corp"))
    db_session.add(User(id="alice", email="alice@x", name="Alice"))
    await db_session.flush()
    db_session.add(
        Calendar(
            id="cal-1", company_id="acme-corp", owner_id="alice",
            scope="personal", source="native", name="B", color="#3b82f6",
        )
    )
    await db_session.flush()
    bt = BookingType(
        id=str(uuid.uuid7()),
        owner_type="user", owner_user_sub="alice",
        public_key="abc", title="T",
        duration_minutes=30, timezone="Asia/Seoul",
        weekly_schedule={"mon": [["09:00", "12:00"]]},
        minimum_notice_minutes=0,
        target_calendar_id="cal-1", capacity=1,
        notify_user_subs=["alice"], enabled=True,
    )
    db_session.add(bt)
    await db_session.flush()

    now = datetime.now(UTC)
    # 35일 전 slot 종료: 마스킹 대상
    old = Booking(
        id=str(uuid.uuid7()),
        booking_type_id=bt.id,
        slot_start_at=now - timedelta(days=35, hours=1),
        slot_end_at=now - timedelta(days=35),
        customer_name="OLD",
        customer_email="old@x.com",
        customer_message="msg",
        agreed_at=now - timedelta(days=35),
        cancel_token="tok-old",
        status="active",
        ip_address="1.2.3.4",
        user_agent="agent",
    )
    # 5일 전 slot: 유지
    fresh = Booking(
        id=str(uuid.uuid7()),
        booking_type_id=bt.id,
        slot_start_at=now - timedelta(days=5, hours=1),
        slot_end_at=now - timedelta(days=5),
        customer_name="FRESH",
        customer_email="fresh@x.com",
        customer_message=None,
        agreed_at=now - timedelta(days=5),
        cancel_token="tok-fresh",
        status="active",
    )
    db_session.add_all([old, fresh])
    await db_session.commit()

    # patch AsyncSessionLocal: 같은 db_session 재사용
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

    # ORM identity map 우회: 마스킹은 bulk UPDATE 라 session 객체는 stale
    from sqlalchemy import select, text

    row = (
        await db_session.execute(
            text(
                "SELECT customer_name, customer_email, cancel_token "
                "FROM bookings WHERE id = :id"
            ),
            {"id": old.id},
        )
    ).one()
    assert row[0] is None
    assert row[1] is None
    assert row[2] is None
    _ = select  # noqa

    row2 = (
        await db_session.execute(
            text("SELECT customer_email FROM bookings WHERE id = :id"),
            {"id": fresh.id},
        )
    ).one()
    assert row2[0] == "fresh@x.com"

    # 멱등: 두 번째 호출은 0
    affected2 = await purge_expired_booking_pii({})
    assert affected2 == 0
