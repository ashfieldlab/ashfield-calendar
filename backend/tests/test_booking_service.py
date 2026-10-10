"""booking 서비스: slot 계산 + race-safe 생성 + 취소 (E-2)."""

import uuid
from datetime import UTC, datetime, timedelta

import pytest

from app.models.booking_type import BookingType
from app.models.calendar import Calendar
from app.models.calendar_event import CalendarEvent
from app.services.booking import (
    available_slots,
    cancel_booking,
    create_booking,
    generate_candidate_slots,
)


def _make_bt(
    db_session,
    *,
    duration=30,
    weekly=None,
    capacity=1,
    minimum_notice_minutes=0,
    target_calendar_id="cal-1",
    blocking_calendar_ids=None,
    tz="Asia/Seoul",
) -> BookingType:
    if weekly is None:
        weekly = {"mon": [["09:00", "12:00"], ["13:00", "18:00"]]}
    bt = BookingType(
        id=str(uuid.uuid7()),
        owner_type="user",
        owner_user_sub="alice",
        owner_company_id=None,
        public_key=str(uuid.uuid7())[:11],
        title="30분 상담",
        description=None,
        duration_minutes=duration,
        timezone=tz,
        weekly_schedule=weekly,
        available_from=None,
        available_to=None,
        minimum_notice_minutes=minimum_notice_minutes,
        target_calendar_id=target_calendar_id,
        blocking_calendar_ids=blocking_calendar_ids or [],
        capacity=capacity,
        notify_user_subs=["alice"],
        enabled=True,
    )
    db_session.add(bt)
    return bt


async def _make_company_and_calendar(db_session, cal_id="cal-1") -> None:
    from app.models.company import Company
    from app.models.user import User

    db_session.add(Company(id="acme-corp", name="acme-corp"))
    db_session.add(User(id="alice", email="alice@x", name="Alice"))
    await db_session.flush()
    db_session.add(
        Calendar(
            id=cal_id,
            company_id="acme-corp",
            owner_id="alice",
            scope="personal",
            source="native",
            name="Bookings",
            color="#3b82f6",
        )
    )
    await db_session.flush()


@pytest.mark.asyncio
async def test_generate_slots_basic(db_session):
    await _make_company_and_calendar(db_session)
    bt = _make_bt(db_session)
    await db_session.flush()

    # 2026-06-08 은 월요일 (KST). 09:00–12:00 + 13:00–18:00 = 8h × 2 slots/h = 16 slots
    range_from = datetime(2026, 6, 7, 0, 0, tzinfo=UTC)
    range_to = datetime(2026, 6, 9, 0, 0, tzinfo=UTC)
    now = datetime(2026, 6, 1, tzinfo=UTC)
    slots = generate_candidate_slots(bt, range_from, range_to, now=now)
    assert len(slots) == 16


@pytest.mark.asyncio
async def test_generate_slots_respects_minimum_notice(db_session):
    await _make_company_and_calendar(db_session)
    bt = _make_bt(db_session, minimum_notice_minutes=60 * 24)
    await db_session.flush()

    # now = 월요일 KST 10:00. 24h notice → 화요일 10:00 부터
    now = datetime(2026, 6, 8, 1, 0, tzinfo=UTC)  # = 10:00 KST 월
    range_from = now
    range_to = now + timedelta(days=3)
    slots = generate_candidate_slots(bt, range_from, range_to, now=now)
    # 월 슬롯은 다 잘림 (24h 안), 화도 weekly_schedule 에 없음: 0
    # weekly 가 mon 만 있어서 → 다음 주 월요일 09:00 부터
    assert all(s > now + timedelta(hours=23) for s in slots)


@pytest.mark.asyncio
async def test_available_slots_subtracts_existing_booking(db_session):
    await _make_company_and_calendar(db_session)
    bt = _make_bt(db_session)
    await db_session.flush()

    now = datetime(2026, 6, 1, tzinfo=UTC)
    slot1 = datetime(2026, 6, 8, 0, 0, tzinfo=UTC)  # 09:00 KST 월
    # 이 slot 에 기존 booking 추가 → capacity=1 이라 사라져야
    await create_booking(
        db_session,
        bt=bt,
        slot_start_at=slot1,
        customer_name="X",
        customer_email="x@x",
        customer_message=None,
        agreed_at=now,
        now=now,
    )
    await db_session.flush()

    slots = await available_slots(
        db_session, bt,
        datetime(2026, 6, 7, 0, 0, tzinfo=UTC),
        datetime(2026, 6, 9, 0, 0, tzinfo=UTC),
        now=now,
    )
    slot_times = [s for s, _ in slots]
    assert slot1 not in slot_times
    # 나머지 15 개는 남아있어야
    assert len(slots) == 15


@pytest.mark.asyncio
async def test_create_booking_race_capacity1(db_session):
    """capacity=1 같은 슬롯에 2번째 INSERT → 409."""
    await _make_company_and_calendar(db_session)
    bt = _make_bt(db_session)
    await db_session.flush()

    now = datetime(2026, 6, 1, tzinfo=UTC)
    slot = datetime(2026, 6, 8, 0, 0, tzinfo=UTC)

    await create_booking(
        db_session, bt=bt, slot_start_at=slot,
        customer_name="A", customer_email="a@a", customer_message=None,
        agreed_at=now, now=now,
    )
    await db_session.flush()

    from app.core.errors import BusinessError
    with pytest.raises(BusinessError) as exc:
        await create_booking(
            db_session, bt=bt, slot_start_at=slot,
            customer_name="B", customer_email="b@b", customer_message=None,
            agreed_at=now, now=now,
        )
    assert exc.value.status == 409


@pytest.mark.asyncio
async def test_create_booking_capacity_n(db_session):
    """capacity=3 → 같은 slot 에 3건 OK, 4번째 → 409."""
    await _make_company_and_calendar(db_session)
    bt = _make_bt(db_session, capacity=3)
    await db_session.flush()
    now = datetime(2026, 6, 1, tzinfo=UTC)
    slot = datetime(2026, 6, 8, 0, 0, tzinfo=UTC)

    for i in range(3):
        await create_booking(
            db_session, bt=bt, slot_start_at=slot,
            customer_name=f"U{i}", customer_email=f"u{i}@x",
            customer_message=None, agreed_at=now, now=now,
        )
        await db_session.flush()

    from app.core.errors import BusinessError
    with pytest.raises(BusinessError) as exc:
        await create_booking(
            db_session, bt=bt, slot_start_at=slot,
            customer_name="U4", customer_email="u4@x",
            customer_message=None, agreed_at=now, now=now,
        )
    assert exc.value.status == 409


@pytest.mark.asyncio
async def test_create_booking_rejects_off_schedule_slot(db_session):
    """가용 규칙에 없는 시각(예: 12:30 점심) 으로 직접 요청 → 422."""
    await _make_company_and_calendar(db_session)
    bt = _make_bt(db_session)
    await db_session.flush()
    now = datetime(2026, 6, 1, tzinfo=UTC)
    # 12:30 KST = 03:30 UTC: 점심시간 (블록 사이)
    off = datetime(2026, 6, 8, 3, 30, tzinfo=UTC)

    from app.core.errors import BusinessError
    with pytest.raises(BusinessError) as exc:
        await create_booking(
            db_session, bt=bt, slot_start_at=off,
            customer_name="X", customer_email="x@x",
            customer_message=None, agreed_at=now, now=now,
        )
    assert exc.value.status == 422


@pytest.mark.asyncio
async def test_blocking_calendar_blocks_slot(db_session):
    """blocking_calendar_ids 의 이벤트와 겹치는 slot 제외."""
    await _make_company_and_calendar(db_session)
    db_session.add(
        Calendar(
            id="holidays", company_id="acme-corp", owner_id="alice",
            scope="personal", source="native", name="공휴일", color="#ef4444",
        )
    )
    bt = _make_bt(db_session, blocking_calendar_ids=["holidays"])
    # 2026-06-08 09:00–10:00 KST = 00:00–01:00 UTC 공휴일 이벤트
    db_session.add(
        CalendarEvent(
            id=str(uuid.uuid7()),
            calendar_id="holidays",
            title="공휴일",
            description=None, location=None,
            start_at=datetime(2026, 6, 8, 0, 0, tzinfo=UTC),
            end_at=datetime(2026, 6, 8, 1, 0, tzinfo=UTC),
            all_day=False, timezone="Asia/Seoul",
            rrule=None, recurrence_exceptions=[],
            created_by_sub="alice",
        )
    )
    await db_session.flush()

    now = datetime(2026, 6, 1, tzinfo=UTC)
    slots = await available_slots(
        db_session, bt,
        datetime(2026, 6, 7, 0, 0, tzinfo=UTC),
        datetime(2026, 6, 9, 0, 0, tzinfo=UTC),
        now=now,
    )
    slot_times = [s for s, _ in slots]
    # 09:00 (00:00 UTC) + 09:30 (00:30 UTC) 두 슬롯 모두 겹침 → 제외
    assert datetime(2026, 6, 8, 0, 0, tzinfo=UTC) not in slot_times
    assert datetime(2026, 6, 8, 0, 30, tzinfo=UTC) not in slot_times
    assert len(slots) == 14


@pytest.mark.asyncio
async def test_cancel_booking_idempotent(db_session):
    await _make_company_and_calendar(db_session)
    bt = _make_bt(db_session)
    await db_session.flush()
    now = datetime(2026, 6, 1, tzinfo=UTC)
    slot = datetime(2026, 6, 8, 0, 0, tzinfo=UTC)
    booking = await create_booking(
        db_session, bt=bt, slot_start_at=slot,
        customer_name="X", customer_email="x@x", customer_message=None,
        agreed_at=now, now=now,
    )
    await db_session.flush()

    token = booking.cancel_token
    b1 = await cancel_booking(db_session, cancel_token=token, by="customer", now=now)
    assert b1.status == "cancelled"
    # CalendarEvent 도 soft delete
    ev = await db_session.get(CalendarEvent, b1.calendar_event_id)
    assert ev.deleted_at is not None

    # 두 번째 호출: 멱등
    b2 = await cancel_booking(db_session, cancel_token=token, by="customer", now=now)
    assert b2.status == "cancelled"

    # 취소된 슬롯은 다시 가용
    slots = await available_slots(
        db_session, bt,
        datetime(2026, 6, 7, 0, 0, tzinfo=UTC),
        datetime(2026, 6, 9, 0, 0, tzinfo=UTC),
        now=now,
    )
    slot_times = [s for s, _ in slots]
    assert slot in slot_times
