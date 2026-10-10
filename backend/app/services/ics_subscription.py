"""ICS subscription 렌더링 — PIPA 마스킹 강제 (ADR-0013).

booking 으로부터 만들어진 CalendarEvent 의 title 은 "{bt.title} — {customer_name}",
description 은 customer_message 라 외부 캘린더 앱에 sync 되면 PIPA 수집목적 외 이용.
→ 이 모듈은 _masked_vevent 로 SUMMARY=bt.title 만, DESCRIPTION·LOCATION 비움.

토글 없음 (코드 상수) — 운영자 실수로 풀모드 켜면 외부 서버에 sync 된 PII 회수 X.
"""

from __future__ import annotations

import secrets
from datetime import UTC, datetime, timedelta

from icalendar import Calendar as IcsCalendar
from icalendar import Event as IcsEvent
from icalendar.prop import vRecur
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.booking import Booking
from app.models.booking_type import BookingType
from app.models.calendar import Calendar
from app.models.calendar_event import CalendarEvent

# 노출 범위 — 너무 많은 과거 이벤트 노출 방지 + 응답 무거움 회피
PAST_LOOKBACK_DAYS = 90
TOKEN_BYTES = 32  # secrets.token_urlsafe(32) → ~43자


def new_subscription_token() -> str:
    return secrets.token_urlsafe(TOKEN_BYTES)


def _masked_vevent(ev: CalendarEvent, masked_title: str) -> IcsEvent:
    """booking-linked event 용 — PIPA 마스킹된 VEVENT.

    노출: dtstart/dtend, rrule/exdate, SUMMARY (bt.title 만).
    숨김: customer 이름·메시지·위치.
    """
    vevent = IcsEvent()
    vevent.add("uid", f"{ev.id}@ashfield.local")
    vevent.add("summary", masked_title)
    # description/location 의도적으로 비움
    vevent.add("dtstart", ev.start_at)
    vevent.add("dtend", ev.end_at)
    vevent.add("dtstamp", datetime.now(UTC))
    if ev.rrule:
        vevent.add("rrule", vRecur.from_ical(ev.rrule))
    for exc_iso in ev.recurrence_exceptions or []:
        try:
            vevent.add("exdate", datetime.fromisoformat(exc_iso))
        except ValueError:
            continue
    return vevent


def _plain_vevent(ev: CalendarEvent) -> IcsEvent:
    """운영자 직접 생성 event — 마스킹 없음. events.py 의 _event_to_vevent 복제."""
    vevent = IcsEvent()
    vevent.add("uid", f"{ev.id}@ashfield.local")
    vevent.add("summary", ev.title)
    if ev.description:
        vevent.add("description", ev.description)
    if ev.location:
        vevent.add("location", ev.location)
    vevent.add("dtstart", ev.start_at)
    vevent.add("dtend", ev.end_at)
    vevent.add("dtstamp", datetime.now(UTC))
    if ev.rrule:
        vevent.add("rrule", vRecur.from_ical(ev.rrule))
    for exc_iso in ev.recurrence_exceptions or []:
        try:
            vevent.add("exdate", datetime.fromisoformat(exc_iso))
        except ValueError:
            continue
    return vevent


async def render_subscription_ics(db: AsyncSession, cal: Calendar) -> bytes:
    """ICS subscription 응답 본문. booking-linked event 는 마스킹 적용.

    포함 범위:
      - RRULE 있는 이벤트는 항상 (외부 클라이언트가 expand)
      - 단일 이벤트는 최근 PAST_LOOKBACK_DAYS 이후 종료된 것만
      - 삭제된 이벤트(deleted_at) 제외
    """
    past_cutoff = datetime.now(UTC) - timedelta(days=PAST_LOOKBACK_DAYS)
    events_stmt = (
        select(CalendarEvent)
        .where(
            CalendarEvent.calendar_id == cal.id,
            CalendarEvent.deleted_at.is_(None),
            or_(
                CalendarEvent.rrule.is_not(None),
                CalendarEvent.end_at >= past_cutoff,
            ),
        )
        .order_by(CalendarEvent.start_at)
    )
    events: list[CalendarEvent] = list(
        (await db.execute(events_stmt)).scalars().all()
    )

    # booking-linked map: event_id → masked_title (bt.title)
    booking_titles: dict[str, str] = {}
    if events:
        ids = [ev.id for ev in events]
        bstmt = (
            select(Booking.calendar_event_id, BookingType.title)
            .join(BookingType, Booking.booking_type_id == BookingType.id)
            .where(Booking.calendar_event_id.in_(ids))
        )
        for ev_id, bt_title in (await db.execute(bstmt)).all():
            booking_titles[ev_id] = bt_title

    ics = IcsCalendar()
    ics.add("prodid", "-//Ashfield//Calendar Subscription//KR")
    ics.add("version", "2.0")
    ics.add("x-wr-calname", cal.name)
    for ev in events:
        if ev.id in booking_titles:
            ics.add_component(_masked_vevent(ev, booking_titles[ev.id]))
        else:
            ics.add_component(_plain_vevent(ev))
    return ics.to_ical()
