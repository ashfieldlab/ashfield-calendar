"""Calendar / Event 도메인 서비스.

권한 (Phase 1):
  - personal: owner_id == user.sub
  - shared: active company 멤버면 OK (require_active_company 가 이미 체크)
  - 다른 회사: 404
Auto-visibility (ADR-0007): GET /calendars = 회사의 모든 shared + 본인 personal.
반복 일정: rrule (RFC 5545) → dateutil.rrule 로 [from, to) 구간 expand.
"""

from __future__ import annotations

import uuid
from datetime import UTC, datetime, timedelta
from typing import Literal

from dateutil.rrule import rrulestr
from fastapi import HTTPException
from sqlalchemy import and_, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.context import UserContext
from app.models.booking import Booking
from app.models.calendar import Calendar
from app.models.calendar_event import CalendarEvent
from app.models.calendar_event_invitation import CalendarEventInvitation
from app.models.user_calendar_preference import UserCalendarPreference

Permission = Literal["read", "write"]


def new_id() -> str:
    return str(uuid.uuid7())


async def get_calendar_or_404(db: AsyncSession, calendar_id: str) -> Calendar:
    cal = await db.get(Calendar, calendar_id)
    if cal is None or cal.deleted_at is not None:
        raise HTTPException(404, "Calendar not found")
    return cal


def assert_calendar_access(
    cal: Calendar, *, user: UserContext, company_id: str, permission: Permission = "read"
) -> None:
    if cal.company_id != company_id:
        raise HTTPException(404, "Calendar not found")
    if cal.scope == "personal" and cal.owner_id != user.sub:
        raise HTTPException(403, "Forbidden")
    # write 권한: shared 캘린더도 멤버면 OK (Phase 1 단순 모델). 더 정교한 분리는 Phase 1.5.
    _ = permission


async def get_event_with_calendar_or_404(
    db: AsyncSession, event_id: str
) -> tuple[CalendarEvent, Calendar]:
    ev = await db.get(CalendarEvent, event_id)
    if ev is None or ev.deleted_at is not None:
        raise HTTPException(404, "Event not found")
    cal = await db.get(Calendar, ev.calendar_id)
    if cal is None or cal.deleted_at is not None:
        raise HTTPException(404, "Event not found")
    return ev, cal


async def ensure_holidays_calendar(
    db: AsyncSession, *, company_id: str, actor_sub: str
) -> None:
    """회사에 기본 공휴일 캘린더(관리형 external_ics)를 idempotent 시드.

    fetch 는 하지 않는다: external_ics_refresh 잡(매 5분)이 채운다. GET 경로에서
    호출되므로 외부 피드 장애가 캘린더 목록을 깨지 않게 한다.
    """
    from app.core.config import settings

    url = settings.holidays_ics_url
    if not url:
        return
    exists = await db.scalar(
        select(Calendar.id).where(
            Calendar.company_id == company_id,
            Calendar.managed.is_(True),
            Calendar.external_ics_url == url,
            Calendar.deleted_at.is_(None),
        )
    )
    if exists:
        return
    db.add(
        Calendar(
            id=str(uuid.uuid7()),
            company_id=company_id,
            owner_id=actor_sub,
            scope="shared",
            source="external_ics",
            name="대한민국 공휴일",
            color="#dc2626",
            managed=True,
            external_ics_url=url,
        )
    )
    await db.flush()


async def list_visible_calendars(
    db: AsyncSession, *, company_id: str, user: UserContext
) -> list[tuple[Calendar, UserCalendarPreference | None]]:
    """자동 가시: 회사 모든 shared + 본인 personal."""
    cal_stmt = (
        select(Calendar)
        .where(
            and_(
                Calendar.company_id == company_id,
                Calendar.deleted_at.is_(None),
                or_(
                    Calendar.scope == "shared",
                    and_(Calendar.scope == "personal", Calendar.owner_id == user.sub),
                ),
            )
        )
        .order_by(Calendar.scope.desc(), Calendar.name)
    )
    cals = list((await db.execute(cal_stmt)).scalars().all())
    if not cals:
        return []

    pref_stmt = select(UserCalendarPreference).where(
        and_(
            UserCalendarPreference.user_sub == user.sub,
            UserCalendarPreference.calendar_id.in_([c.id for c in cals]),
        )
    )
    prefs = {p.calendar_id: p for p in (await db.execute(pref_stmt)).scalars().all()}
    return [(c, prefs.get(c.id)) for c in cals]


async def upsert_preference(
    db: AsyncSession,
    *,
    user_sub: str,
    calendar_id: str,
    hidden: bool | None,
    color_override: str | None,
) -> UserCalendarPreference:
    pref = await db.get(UserCalendarPreference, (user_sub, calendar_id))
    if pref is None:
        pref = UserCalendarPreference(
            user_sub=user_sub,
            calendar_id=calendar_id,
            hidden=hidden if hidden is not None else False,
            color_override=color_override,
        )
        db.add(pref)
    else:
        if hidden is not None:
            pref.hidden = hidden
        if color_override is not None or hidden is not None:
            # color_override 미전송이면 그대로, 명시적 null 은 reset
            pref.color_override = color_override
    return pref


# ---------------------------------------------------------------------------
# RRULE expand
# ---------------------------------------------------------------------------


def _is_excluded(exceptions: list[str], dt: datetime) -> bool:
    """recurrence_exceptions 는 ISO 문자열 리스트. naive 비교를 위해 normalize."""
    if not exceptions:
        return False
    key = dt.astimezone(UTC).replace(microsecond=0).isoformat()
    norm = {datetime.fromisoformat(x).astimezone(UTC).replace(microsecond=0).isoformat()
            for x in exceptions}
    return key in norm


def expand_event(
    ev: CalendarEvent, *, range_from: datetime, range_to: datetime
) -> list[dict]:
    """단일 event 를 [from, to) 구간 occurrence 들로 풀어 반환.

    rrule 이 None 이면 [from, to) 와 겹치면 1건 반환.
    """
    duration = ev.end_at - ev.start_at
    occurrences: list[dict] = []

    def to_payload(start: datetime) -> dict:
        end = start + duration
        return {
            "event_id": ev.id,
            "calendar_id": ev.calendar_id,
            "title": ev.title,
            "description": ev.description,
            "location": ev.location,
            "start_at": start,
            "end_at": end,
            "all_day": ev.all_day,
            "timezone": ev.timezone,
            "is_recurring": ev.rrule is not None,
        }

    if not ev.rrule:
        if ev.end_at > range_from and ev.start_at < range_to:
            occurrences.append(to_payload(ev.start_at))
        return occurrences

    # dateutil 은 timezone-aware DTSTART 를 인수로 받으면 인식
    rule = rrulestr(ev.rrule, dtstart=ev.start_at)
    # between(from, to) 는 strictly inside; 시작 직전 시작-넘김 케이스 회수 위해 from-duration
    for start in rule.between(range_from - duration, range_to, inc=True):
        if _is_excluded(ev.recurrence_exceptions, start):
            continue
        if start + duration <= range_from or start >= range_to:
            continue
        occurrences.append(to_payload(start))
    return occurrences


async def list_occurrences(
    db: AsyncSession,
    *,
    company_id: str,
    user: UserContext,
    range_from: datetime,
    range_to: datetime,
    calendar_ids: list[str] | None,
) -> list[dict]:
    """가시 캘린더 ∩ 요청 ID 목록 ∩ hidden=false 의 occurrence 를 풀어 반환."""
    visible = await list_visible_calendars(db, company_id=company_id, user=user)
    visible_map: dict[str, Calendar] = {
        c.id: c for c, p in visible if not (p and p.hidden)
    }
    if calendar_ids:
        target_ids = [cid for cid in calendar_ids if cid in visible_map]
    else:
        target_ids = list(visible_map.keys())

    if range_to <= range_from:
        raise HTTPException(400, "Invalid range")
    if range_to - range_from > timedelta(days=400):
        raise HTTPException(400, "Range too wide (max 400 days)")

    events: list[CalendarEvent] = []
    if target_ids:
        stmt = (
            select(CalendarEvent)
            .where(
                and_(
                    CalendarEvent.calendar_id.in_(target_ids),
                    CalendarEvent.deleted_at.is_(None),
                    or_(
                        CalendarEvent.rrule.is_not(None),
                        and_(
                            CalendarEvent.end_at > range_from,
                            CalendarEvent.start_at < range_to,
                        ),
                    ),
                    CalendarEvent.start_at <= range_to,
                )
            )
            .order_by(CalendarEvent.start_at)
        )
        events = list((await db.execute(stmt)).scalars().all())

    # 초대받은 이벤트도 포함: 본인이 declined 한 건 제외
    inv_stmt = (
        select(CalendarEvent)
        .join(
            CalendarEventInvitation,
            CalendarEventInvitation.event_id == CalendarEvent.id,
        )
        .where(
            and_(
                CalendarEventInvitation.invitee_sub == user.sub,
                CalendarEventInvitation.response != "declined",
                CalendarEvent.deleted_at.is_(None),
                CalendarEvent.start_at <= range_to,
            )
        )
    )
    invited = list((await db.execute(inv_stmt)).scalars().all())
    seen_ids = {ev.id for ev in events}
    for ev in invited:
        if ev.id in seen_ids:
            continue
        events.append(ev)

    out: list[dict] = []
    for ev in events:
        out.extend(expand_event(ev, range_from=range_from, range_to=range_to))

    # booking-linked event 표시: 캘린더 UI 가 readonly 처리
    event_ids = {x["event_id"] for x in out}
    if event_ids:
        bstmt = select(Booking.calendar_event_id, Booking.id).where(
            Booking.calendar_event_id.in_(event_ids)
        )
        booking_map = {ev_id: bid for ev_id, bid in (await db.execute(bstmt)).all()}
        for x in out:
            x["booking_id"] = booking_map.get(x["event_id"])

    out.sort(key=lambda x: x["start_at"])
    return out
