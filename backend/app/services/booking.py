"""Booking 도메인 서비스: slot 계산 + race-safe 생성/취소 (ADR-0012).

핵심:
  - generate_candidate_slots: BookingType 의 weekly_schedule × duration → 후보 slot 목록 (UTC).
                              minimum_notice / available_from, to 반영.
  - available_slots: 후보에서 (이미 잡힌 booking + blocking_calendar 이벤트) 제외.
                     반환은 (slot_start_utc, remaining_capacity).
  - create_booking: pg_advisory_xact_lock 으로 race 차단. capacity 검증 + blocking 검증 +
                    CalendarEvent + Booking 한 트랜잭션. 충돌 시 409.
  - cancel_booking: cancel_token 으로 본인 검증. status='cancelled' + CalendarEvent soft delete.
"""

from __future__ import annotations

import secrets
import uuid
from datetime import UTC, date, datetime, time, timedelta
from zoneinfo import ZoneInfo

from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.errors import BusinessError
from app.models.booking import Booking
from app.models.booking_type import BookingType
from app.models.calendar import Calendar
from app.models.calendar_event import CalendarEvent

_DOW = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]


def generate_candidate_slots(
    bt: BookingType,
    range_from: datetime,
    range_to: datetime,
    now: datetime | None = None,
) -> list[datetime]:
    """BookingType 의 가용 규칙에서 [range_from, range_to) UTC 안의 slot 시작 시각들.

    minimum_notice_minutes / available_from / available_to 반영. 정렬과 중복 제거됨.
    """
    if range_to <= range_from:
        return []

    now = now or datetime.now(UTC)
    tz = ZoneInfo(bt.timezone)
    duration = timedelta(minutes=bt.duration_minutes)

    # 1) 시작 lower bound: max(range_from, now + minimum_notice, available_from 00:00 in tz)
    earliest = max(range_from, now + timedelta(minutes=bt.minimum_notice_minutes))
    if bt.available_from:
        af_local = datetime.combine(bt.available_from, time.min, tzinfo=tz)
        earliest = max(earliest, af_local.astimezone(UTC))

    upper = range_to
    if bt.available_to:
        # 종일 포함을 위해 다음 날 00:00 까지
        at_local = datetime.combine(bt.available_to + timedelta(days=1), time.min, tzinfo=tz)
        upper = min(upper, at_local.astimezone(UTC))

    if earliest >= upper:
        return []

    # 2) tz 기준으로 day-by-day 순회
    start_day_local = earliest.astimezone(tz).date()
    end_day_local = (upper - timedelta(microseconds=1)).astimezone(tz).date()

    out: list[datetime] = []
    day: date = start_day_local
    while day <= end_day_local:
        dow = _DOW[day.weekday()]
        blocks = bt.weekly_schedule.get(dow, []) or []
        for block in blocks:
            if not (isinstance(block, list) and len(block) == 2):
                continue
            start_str, end_str = block
            try:
                t_start = time.fromisoformat(start_str)
                t_end = time.fromisoformat(end_str)
            except ValueError:
                continue
            block_start = datetime.combine(day, t_start, tzinfo=tz)
            block_end = datetime.combine(day, t_end, tzinfo=tz)
            cursor = block_start
            while cursor + duration <= block_end:
                slot_utc = cursor.astimezone(UTC)
                if earliest <= slot_utc < upper:
                    out.append(slot_utc)
                cursor = cursor + duration
        day = day + timedelta(days=1)

    return sorted(set(out))


async def _fetch_blocking_events(
    db: AsyncSession,
    bt: BookingType,
    range_from: datetime,
    range_to: datetime,
) -> list[tuple[datetime, datetime]]:
    """blocking_calendar_ids ∪ {target_calendar_id} 의 다른 이벤트 [start, end] 목록.

    이 BookingType 의 booking 으로부터 생성된 CalendarEvent 는 제외 (capacity 카운트로 따로 처리).
    """
    cal_ids: list[str] = list(bt.blocking_calendar_ids or [])
    cal_ids.append(bt.target_calendar_id)
    cal_ids = list(set(cal_ids))

    # 자기 BookingType 이 만든 CalendarEvent 의 id 들: 제외
    own_event_ids_stmt = select(Booking.calendar_event_id).where(
        Booking.booking_type_id == bt.id,
        Booking.calendar_event_id.is_not(None),
    )

    stmt = (
        select(CalendarEvent.start_at, CalendarEvent.end_at)
        .where(
            CalendarEvent.calendar_id.in_(cal_ids),
            CalendarEvent.deleted_at.is_(None),
            CalendarEvent.end_at > range_from,
            CalendarEvent.start_at < range_to,
            # 자기 BookingType 이 만든 이벤트 제외 (capacity 카운트로 따로 처리)
            CalendarEvent.id.notin_(own_event_ids_stmt),
        )
    )
    rows = (await db.execute(stmt)).all()
    return [(r[0], r[1]) for r in rows]


def _overlaps_any(
    s: datetime, e: datetime, intervals: list[tuple[datetime, datetime]]
) -> bool:
    for a, b in intervals:
        if a < e and b > s:
            return True
    return False


async def available_slots(
    db: AsyncSession,
    bt: BookingType,
    range_from: datetime,
    range_to: datetime,
    now: datetime | None = None,
) -> list[tuple[datetime, int]]:
    """후보 slot 에서 booking 카운트 + blocking 이벤트 적용. (start_utc, remaining_capacity)."""
    candidates = generate_candidate_slots(bt, range_from, range_to, now)
    if not candidates:
        return []

    duration = timedelta(minutes=bt.duration_minutes)

    # capacity 카운트 (이 BookingType 의 active booking)
    counts_stmt = (
        select(Booking.slot_start_at, func.count())
        .where(
            Booking.booking_type_id == bt.id,
            Booking.status == "active",
            Booking.slot_start_at.in_(candidates),
        )
        .group_by(Booking.slot_start_at)
    )
    booked: dict[datetime, int] = {
        r[0]: int(r[1]) for r in (await db.execute(counts_stmt)).all()
    }

    # blocking events (한 번에 fetch)
    blocking = await _fetch_blocking_events(
        db, bt, candidates[0], candidates[-1] + duration
    )

    out: list[tuple[datetime, int]] = []
    for s in candidates:
        e = s + duration
        remaining = bt.capacity - booked.get(s, 0)
        if remaining <= 0:
            continue
        if _overlaps_any(s, e, blocking):
            continue
        out.append((s, remaining))
    return out


def _lock_key(bt_id: str, slot_start: datetime) -> int:
    """advisory lock 용 64bit 정수. 같은 (bt, slot) 이면 같은 키."""
    h = hash((bt_id, slot_start.isoformat()))
    return h & 0x7FFFFFFFFFFFFFFF  # int64 positive


async def create_booking(
    db: AsyncSession,
    *,
    bt: BookingType,
    slot_start_at: datetime,
    customer_name: str,
    customer_email: str,
    customer_message: str | None,
    agreed_at: datetime,
    ip_address: str | None = None,
    user_agent: str | None = None,
    now: datetime | None = None,
) -> Booking:
    """race-safe booking 생성. 트랜잭션 안에서 advisory lock → 충돌 검사 → INSERT.

    호출자는 commit 책임 (get_db 의 yield 패턴).
    """
    if not bt.enabled or bt.deleted_at is not None:
        raise BusinessError(
            "BOOKING_TYPE_NOT_FOUND",
            status=404,
            message="BookingType not available",
        )

    duration = timedelta(minutes=bt.duration_minutes)
    slot_end_at = slot_start_at + duration
    now = now or datetime.now(UTC)

    # slot_start_at 이 후보에 있는지 (가용 규칙 일치) 검증
    candidates = generate_candidate_slots(
        bt, slot_start_at, slot_end_at + timedelta(seconds=1), now=now
    )
    if slot_start_at not in candidates:
        raise BusinessError(
            "BOOKING_OFF_SCHEDULE",
            status=422,
            message="Slot not in availability schedule",
            params={"slot_start_at": slot_start_at.isoformat()},
        )

    # advisory lock: 같은 (bt, slot) 동시 호출 직렬화
    await db.execute(
        text("SELECT pg_advisory_xact_lock(:k)"),
        {"k": _lock_key(bt.id, slot_start_at)},
    )

    # capacity 검증
    count_stmt = select(func.count()).where(
        Booking.booking_type_id == bt.id,
        Booking.slot_start_at == slot_start_at,
        Booking.status == "active",
    )
    booked_count = (await db.execute(count_stmt)).scalar_one()
    if booked_count >= bt.capacity:
        raise BusinessError(
            "BOOKING_SLOT_FULL",
            status=409,
            message="Slot is full",
            params={"capacity": bt.capacity, "booked": booked_count},
        )

    # blocking 이벤트 검증
    blocking = await _fetch_blocking_events(db, bt, slot_start_at, slot_end_at)
    if _overlaps_any(slot_start_at, slot_end_at, blocking):
        raise BusinessError(
            "BOOKING_SLOT_BLOCKED",
            status=409,
            message="Slot is unavailable",
        )

    # CalendarEvent + Booking insert
    # created_by_sub 은 target_calendar 의 owner 사용: 항상 존재 (Calendar.owner_id NOT NULL FK).
    # workspace-owned BookingType 도 shared 캘린더가 있어서 valid user_sub 보장.
    cal = await db.get(Calendar, bt.target_calendar_id)
    if cal is None:
        raise BusinessError(
            "TARGET_CALENDAR_GONE",
            status=500,
            message="target_calendar gone",
        )
    ev_id = str(uuid.uuid7())
    ev = CalendarEvent(
        id=ev_id,
        calendar_id=bt.target_calendar_id,
        title=f"{bt.title}: {customer_name}",
        description=customer_message,
        location=None,
        start_at=slot_start_at,
        end_at=slot_end_at,
        all_day=False,
        timezone=bt.timezone,
        rrule=None,
        recurrence_exceptions=[],
        created_by_sub=cal.owner_id,
    )
    db.add(ev)
    await db.flush()  # FK 순서 보장: CalendarEvent 먼저 INSERT
    booking = Booking(
        id=str(uuid.uuid7()),
        booking_type_id=bt.id,
        slot_start_at=slot_start_at,
        slot_end_at=slot_end_at,
        calendar_event_id=ev_id,
        customer_name=customer_name,
        customer_email=customer_email,
        customer_message=customer_message,
        agreed_at=agreed_at,
        cancel_token=secrets.token_urlsafe(16),
        status="active",
        ip_address=ip_address,
        user_agent=user_agent,
    )
    db.add(booking)
    return booking


def _format_local(dt: datetime, tz: str) -> str:
    try:
        local = dt.astimezone(ZoneInfo(tz))
    except Exception:
        local = dt
    return local.strftime("%Y-%m-%d %H:%M") + f" ({tz})"


async def dispatch_booking_received_emails(
    booking: Booking,
    bt: BookingType,
    organization_name: str,
    base_url: str,
    organization_logo_url: str | None = None,
) -> None:
    """예약 직후: 고객 안내 + 운영자 알림 (in-app + 이메일). commit 후 호출.

    SMTP resolve 는 booking_type 의 owner_workspace_id 기준 (워크스페이스 override 우선).
    """
    from app.core.db import AsyncSessionLocal
    from app.services.email import send_for_event, send_to_address
    from app.services.email_template import make_brand_html
    from app.services.notifications import emit_notification

    cancel_url = f"{base_url.rstrip('/')}/cancel/{booking.cancel_token}"
    slot_local = _format_local(booking.slot_start_at, bt.timezone)
    brand_html = make_brand_html(organization_name, organization_logo_url)

    # 1) 고객에게 안내 이메일
    await send_to_address(
        to_email=booking.customer_email or "",
        event_type="booking_received_customer",
        payload={
            "organization_name": organization_name,
            "organization_logo_url": organization_logo_url or "",
            "organization_brand": brand_html,
            "title": bt.title,
            "customer_name": booking.customer_name or "고객",
            "slot_start_local": slot_local,
            "cancel_url": cancel_url,
        },
        workspace_id=bt.owner_workspace_id,
    )

    # 2) 운영자(들)에게: in-app Notification + 이메일
    op_payload = {
        "title": bt.title,
        "customer_name": booking.customer_name or "고객",
        "customer_email": booking.customer_email or "",
        "customer_message": booking.customer_message or "(없음)",
        "slot_start_local": slot_local,
        "booking_type_id": bt.id,
    }
    subs = bt.notify_user_subs or []
    if subs:
        # workspace_id 는 in-app Notification 의 workspace_id 필드용: user-owned 면
        # target_calendar 의 workspace 사용.
        workspace_id_for_notif = bt.owner_workspace_id
        if workspace_id_for_notif is None:
            async with AsyncSessionLocal() as nf_db:
                cal = await nf_db.get(Calendar, bt.target_calendar_id)
                workspace_id_for_notif = cal.workspace_id if cal else None
        # in-app Notification: 별도 트랜잭션
        if workspace_id_for_notif:
            async with AsyncSessionLocal() as nf_db:
                for sub in subs:
                    await emit_notification(
                        nf_db,
                        recipient_sub=sub,
                        workspace_id=workspace_id_for_notif,
                        actor_sub=None,
                        type_="booking_received",
                        entity_type="booking",
                        entity_id=booking.id,
                        payload=op_payload,
                    )
                await nf_db.commit()
    for sub in subs:
        await send_for_event(
            recipient_sub=sub,
            actor_sub=None,
            event_type="booking_received_operator",
            payload=op_payload,
            workspace_id=bt.owner_workspace_id,
        )


async def dispatch_booking_cancelled_emails(
    booking: Booking,
    bt: BookingType,
    organization_name: str,
    base_url: str,
    organization_logo_url: str | None = None,
) -> None:
    """취소 직후: 고객 확인 + 운영자 통지 (in-app + 이메일). commit 후 호출."""
    from app.core.db import AsyncSessionLocal
    from app.services.email import send_for_event, send_to_address
    from app.services.email_template import make_brand_html
    from app.services.notifications import emit_notification

    book_url = f"{base_url.rstrip('/')}/book/{bt.public_key}"
    slot_local = _format_local(booking.slot_start_at, bt.timezone)
    brand_html = make_brand_html(organization_name, organization_logo_url)

    if booking.customer_email:
        await send_to_address(
            to_email=booking.customer_email,
            event_type="booking_cancelled_customer",
            payload={
                "organization_name": organization_name,
                "organization_logo_url": organization_logo_url or "",
                "organization_brand": brand_html,
                "title": bt.title,
                "customer_name": booking.customer_name or "고객",
                "slot_start_local": slot_local,
                "book_url": book_url,
            },
            workspace_id=bt.owner_workspace_id,
        )

    op_payload = {
        "title": bt.title,
        "customer_name": booking.customer_name or "고객",
        "slot_start_local": slot_local,
        "booking_type_id": bt.id,
    }
    subs = bt.notify_user_subs or []
    if subs:
        workspace_id_for_notif = bt.owner_workspace_id
        if workspace_id_for_notif is None:
            async with AsyncSessionLocal() as nf_db:
                cal = await nf_db.get(Calendar, bt.target_calendar_id)
                workspace_id_for_notif = cal.workspace_id if cal else None
        if workspace_id_for_notif:
            async with AsyncSessionLocal() as nf_db:
                for sub in subs:
                    await emit_notification(
                        nf_db,
                        recipient_sub=sub,
                        workspace_id=workspace_id_for_notif,
                        actor_sub=None,
                        type_="booking_cancelled",
                        entity_type="booking",
                        entity_id=booking.id,
                        payload=op_payload,
                    )
                await nf_db.commit()
    for sub in subs:
        await send_for_event(
            recipient_sub=sub,
            actor_sub=None,
            event_type="booking_cancelled_operator",
            payload=op_payload,
            workspace_id=bt.owner_workspace_id,
        )


def public_base_url() -> str:
    """예약 공개 페이지(/book, /cancel) base URL. 공개 라우트라 아무 호스트나 되지만
    예약은 calendar 앱 기능이므로 calendar 도메인으로 통일."""
    return settings.calendar_base_url


async def reschedule_booking(
    db: AsyncSession,
    *,
    booking: Booking,
    bt: BookingType,
    new_slot_start_at: datetime,
    new_description: str | None = None,
    force: bool = False,
    now: datetime | None = None,
) -> Booking:
    """운영자가 booking 의 시간 (선택적으로 메모) 을 변경.

    force=False: 가용 규칙, capacity, blocking 검증. 양식 안의 가용 슬롯만.
    force=True: 검증 skip: 운영자가 양식 밖 시각으로도 강제 이동 가능
                (예: 고객과 합의 후 정규 슬롯 외 시간 잡기).

    호출자는 commit 책임 + 이메일 디스패치 책임.
    """
    if booking.status != "active":
        raise BusinessError(
            "BOOKING_NOT_ACTIVE",
            status=400,
            message="Cannot reschedule a cancelled booking",
        )
    if booking.booking_type_id != bt.id:
        raise BusinessError(
            "BOOKING_TYPE_MISMATCH", status=400, message="Mismatch"
        )

    duration = timedelta(minutes=bt.duration_minutes)
    new_slot_end_at = new_slot_start_at + duration
    now = now or datetime.now(UTC)

    # 시간은 동일하고 메모만 바꾸는 경우: 검증 skip
    time_changing = new_slot_start_at != booking.slot_start_at

    if time_changing and not force:
        # 가용 규칙 검증
        candidates = generate_candidate_slots(
            bt, new_slot_start_at, new_slot_end_at + timedelta(seconds=1), now=now
        )
        if new_slot_start_at not in candidates:
            raise BusinessError(
                "BOOKING_OFF_SCHEDULE",
                status=422,
                message="New slot not in availability schedule",
                params={"slot_start_at": new_slot_start_at.isoformat()},
            )

    if time_changing:
        # advisory lock: 새 슬롯 race 차단
        await db.execute(
            text("SELECT pg_advisory_xact_lock(:k)"),
            {"k": _lock_key(bt.id, new_slot_start_at)},
        )
        if not force:
            # capacity: 자기 자신은 제외
            count_stmt = select(func.count()).where(
                Booking.booking_type_id == bt.id,
                Booking.slot_start_at == new_slot_start_at,
                Booking.status == "active",
                Booking.id != booking.id,
            )
            booked_count = (await db.execute(count_stmt)).scalar_one()
            if booked_count >= bt.capacity:
                raise BusinessError(
                    "BOOKING_SLOT_FULL",
                    status=409,
                    message="Slot is full",
                    params={"capacity": bt.capacity, "booked": booked_count},
                )
            # blocking 이벤트: 자기 CalendarEvent 는 제외 (_fetch_blocking_events 가 처리)
            blocking = await _fetch_blocking_events(
                db, bt, new_slot_start_at, new_slot_end_at
            )
            if _overlaps_any(new_slot_start_at, new_slot_end_at, blocking):
                raise BusinessError(
                    "BOOKING_SLOT_BLOCKED",
                    status=409,
                    message="Slot is unavailable",
                )

    # CalendarEvent 갱신
    if booking.calendar_event_id:
        ev = await db.get(CalendarEvent, booking.calendar_event_id)
        if ev is not None:
            ev.start_at = new_slot_start_at
            ev.end_at = new_slot_end_at
            if new_description is not None:
                ev.description = new_description

    booking.slot_start_at = new_slot_start_at
    booking.slot_end_at = new_slot_end_at
    if new_description is not None:
        booking.customer_message = new_description

    return booking


async def dispatch_booking_rescheduled_emails(
    booking: Booking,
    bt: BookingType,
    organization_name: str,
    base_url: str,
    old_slot_start: datetime,
    organization_logo_url: str | None = None,
) -> None:
    """변경 직후: 고객 + 운영자(들) 알림. commit 후 호출."""
    from app.core.db import AsyncSessionLocal
    from app.services.email import send_for_event, send_to_address
    from app.services.email_template import make_brand_html
    from app.services.notifications import emit_notification

    cancel_url = f"{base_url.rstrip('/')}/cancel/{booking.cancel_token}"
    old_local = _format_local(old_slot_start, bt.timezone)
    new_local = _format_local(booking.slot_start_at, bt.timezone)
    brand_html = make_brand_html(organization_name, organization_logo_url)

    if booking.customer_email:
        await send_to_address(
            to_email=booking.customer_email,
            event_type="booking_rescheduled_customer",
            payload={
                "organization_name": organization_name,
                "organization_logo_url": organization_logo_url or "",
                "organization_brand": brand_html,
                "title": bt.title,
                "customer_name": booking.customer_name or "고객",
                "old_slot_local": old_local,
                "new_slot_local": new_local,
                "cancel_url": cancel_url,
            },
            workspace_id=bt.owner_workspace_id,
        )

    op_payload = {
        "title": bt.title,
        "customer_name": booking.customer_name or "고객",
        "old_slot_local": old_local,
        "new_slot_local": new_local,
        "booking_type_id": bt.id,
    }
    subs = bt.notify_user_subs or []
    if subs:
        workspace_id_for_notif = bt.owner_workspace_id
        if workspace_id_for_notif is None:
            async with AsyncSessionLocal() as nf_db:
                cal = await nf_db.get(Calendar, bt.target_calendar_id)
                workspace_id_for_notif = cal.workspace_id if cal else None
        if workspace_id_for_notif:
            async with AsyncSessionLocal() as nf_db:
                for sub in subs:
                    await emit_notification(
                        nf_db,
                        recipient_sub=sub,
                        workspace_id=workspace_id_for_notif,
                        actor_sub=None,
                        type_="booking_rescheduled",
                        entity_type="booking",
                        entity_id=booking.id,
                        payload=op_payload,
                    )
                await nf_db.commit()
    for sub in subs:
        await send_for_event(
            recipient_sub=sub,
            actor_sub=None,
            event_type="booking_rescheduled_operator",
            payload=op_payload,
            workspace_id=bt.owner_workspace_id,
        )


async def cancel_booking(
    db: AsyncSession,
    *,
    cancel_token: str,
    by: str,
    now: datetime | None = None,
) -> Booking:
    """cancel_token 으로 본인 인증 → 취소.

    by: 'customer' (공개 라우트) | 'operator' (운영자 라우트, 토큰 알면 동일 동작).
    """
    booking = (
        await db.execute(
            select(Booking).where(Booking.cancel_token == cancel_token)
        )
    ).scalar_one_or_none()
    if booking is None:
        raise BusinessError(
            "BOOKING_CANCEL_TOKEN_INVALID",
            status=404,
            message="Invalid cancel token",
        )
    if booking.status == "cancelled":
        return booking  # 멱등

    booking.status = "cancelled"
    booking.cancelled_at = now or datetime.now(UTC)
    booking.cancelled_by = by  # type: ignore[assignment]

    # CalendarEvent 도 soft delete: 운영자 캘린더에서 사라짐
    if booking.calendar_event_id:
        ev = await db.get(CalendarEvent, booking.calendar_event_id)
        if ev is not None and ev.deleted_at is None:
            ev.deleted_at = booking.cancelled_at

    return booking
