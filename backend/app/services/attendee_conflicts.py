"""참석자 일정 겹침: 업무 일정끼리만 본다 (개인 캘린더는 열지 않는다).

어떤 사람이 그 시간에 "바쁨"인 경우는 셋뿐:
  1. 수락했거나 아직 응답 안 한 초대가 있는 일정 (거절은 제외)
  2. 그 사람이 워크스페이스 캘린더에 올린 일정 (예: 휴가 캘린더)
  3. 그 사람이 주최한 회의: 초대가 하나라도 붙은 일정. 주최자 일정은 주최자 개인
     캘린더에 있어서 1, 2로는 안 잡힌다.
공휴일 같은 시스템 관리형 캘린더와 외부 ICS 구독은 사람을 바쁘게 만들지 않는다.
겹침 여부만 돌려주고 일정 제목은 내보내지 않는다 (남의 회의 내용 비노출).
"""

from __future__ import annotations

from collections import defaultdict
from datetime import datetime

from sqlalchemy import and_, exists, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.calendar import Calendar
from app.models.calendar_event import CalendarEvent
from app.models.calendar_event_invitation import CalendarEventInvitation as Inv
from app.services.calendars import expand_event


async def busy_subs(
    db: AsyncSession,
    *,
    workspace_id: str,
    subs: list[str],
    start: datetime,
    end: datetime,
    exclude_event_id: str | None = None,
) -> set[str]:
    """[start, end) 에 업무 일정이 겹치는 사람(sub) 집합."""
    if not subs or end <= start:
        return set()

    base = and_(
        Calendar.workspace_id == workspace_id,
        Calendar.source == "native",
        Calendar.managed.is_(False),
        CalendarEvent.deleted_at.is_(None),
        CalendarEvent.start_at < end,
        # 반복 일정은 시작이 범위보다 앞서도 회차가 걸칠 수 있다 → 전개해서 판정
        or_(CalendarEvent.rrule.is_not(None), CalendarEvent.end_at > start),
    )
    if exclude_event_id:
        base = and_(base, CalendarEvent.id != exclude_event_id)
    has_invite = exists().where(Inv.event_id == CalendarEvent.id)

    # (event, sub) 후보: 위 세 경우
    invited = (
        select(CalendarEvent, Inv.invitee_sub)
        .join(Calendar, Calendar.id == CalendarEvent.calendar_id)
        .join(Inv, Inv.event_id == CalendarEvent.id)
        .where(base, Inv.invitee_sub.in_(subs), Inv.response != "declined")
    )
    authored = (
        select(CalendarEvent, CalendarEvent.created_by_sub)
        .join(Calendar, Calendar.id == CalendarEvent.calendar_id)
        .where(
            base,
            CalendarEvent.created_by_sub.in_(subs),
            or_(Calendar.scope == "shared", has_invite),
        )
    )

    by_event: dict[str, tuple[CalendarEvent, set[str]]] = {}
    for stmt in (invited, authored):
        for ev, sub in (await db.execute(stmt)).all():
            by_event.setdefault(ev.id, (ev, set()))[1].add(sub)

    busy: defaultdict[str, int] = defaultdict(int)
    for ev, who in by_event.values():
        if expand_event(ev, range_from=start, range_to=end):
            for sub in who:
                busy[sub] += 1
    return set(busy)
