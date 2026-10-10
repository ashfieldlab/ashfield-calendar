"""일정 변경과 취소: 바뀐 필드 계산 + 참석자 알림 (event_updated, event_cancelled).

활동 내역(audit meta)과 알림(payload)이 같은 모양을 쓰도록 한 곳에 모은다.
  fields  : 바뀐 필드 키 목록 (title, start_at, end_at, all_day, location, room_id, rrule, description)
  changes : {키: {"from": 값, "to": 값}}. 시각은 ISO, 회의실은 이름. description 은 값 없이 키만.
  old_start, new_start : 시작 시각이 바뀌었을 때만.
"""

from __future__ import annotations

from datetime import datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.calendar import Calendar
from app.models.calendar_event import CalendarEvent
from app.models.calendar_event_invitation import CalendarEventInvitation
from app.models.room import Room
from app.services.notifications import PendingDispatch, notify

TRACKED = (
    "title",
    "start_at",
    "end_at",
    "all_day",
    "location",
    "room_id",
    "rrule",
    "description",
)
# 참석자에게 알릴 만한 변경 (설명, 알림 시각 같은 건 조용히)
NOTIFY_FIELDS = {"title", "start_at", "end_at", "all_day", "location", "room_id", "rrule"}


def snapshot(ev: CalendarEvent) -> dict:
    return {k: getattr(ev, k) for k in TRACKED}


def _plain(v: object) -> object:
    if isinstance(v, datetime):
        return v.isoformat()
    return v


async def _room_names(db: AsyncSession, ids: set[str]) -> dict[str, str]:
    ids = {i for i in ids if i}
    if not ids:
        return {}
    rows = (await db.execute(select(Room).where(Room.id.in_(ids)))).scalars()
    return {r.id: r.name for r in rows}


async def diff(db: AsyncSession, before: dict, ev: CalendarEvent) -> dict:
    """before 스냅샷과 현재 ev 비교. 바뀐 게 없으면 fields=[]."""
    after = snapshot(ev)
    keys = [k for k in TRACKED if before.get(k) != after.get(k)]
    rooms = (
        await _room_names(db, {before.get("room_id"), after.get("room_id")})
        if "room_id" in keys
        else {}
    )
    changes: dict[str, dict] = {}
    for k in keys:
        if k == "description":
            changes[k] = {}
            continue
        a, b = before.get(k), after.get(k)
        if k == "room_id":
            a, b = rooms.get(a) if a else None, rooms.get(b) if b else None
        changes[k] = {"from": _plain(a), "to": _plain(b)}
    out: dict = {"fields": keys, "changes": changes}
    if "start_at" in keys:
        out["old_start"] = _plain(before["start_at"])
        out["new_start"] = _plain(after["start_at"])
    if "end_at" in keys:
        out["old_end"] = _plain(before["end_at"])
    return out


def event_card(ev: CalendarEvent) -> dict:
    """알림 payload 공통: 일정 카드에 필요한 값."""
    return {
        "title": ev.title,
        "start_at": ev.start_at.isoformat(),
        "end_at": ev.end_at.isoformat(),
        "all_day": ev.all_day,
        "location": ev.location,
        "calendar_id": ev.calendar_id,
    }


async def attendee_subs(db: AsyncSession, ev: CalendarEvent) -> list[str]:
    """알림 받을 사람: 거절하지 않은 내부 참석자 + 작성자."""
    rows = (
        await db.execute(
            select(CalendarEventInvitation.invitee_sub).where(
                CalendarEventInvitation.event_id == ev.id,
                CalendarEventInvitation.invitee_sub.is_not(None),
                CalendarEventInvitation.response != "declined",
            )
        )
    ).scalars()
    subs = [s for s in rows if s]
    if ev.created_by_sub and ev.created_by_sub not in subs:
        subs.append(ev.created_by_sub)
    return subs


async def notify_attendees(
    db: AsyncSession,
    pending: PendingDispatch,
    *,
    ev: CalendarEvent,
    cal: Calendar,
    actor_sub: str,
    type_: str,
    payload: dict,
) -> None:
    for sub in await attendee_subs(db, ev):
        await notify(
            db,
            pending,
            recipient_sub=sub,
            workspace_id=cal.workspace_id,
            actor_sub=actor_sub,
            type_=type_,
            entity_type="event",
            entity_id=ev.id,
            payload=payload,
        )
