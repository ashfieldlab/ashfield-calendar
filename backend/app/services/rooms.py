"""Room(회의실) 충돌 체크 + 조회 (ADR-0019).

같은 room_id 로 시간이 겹치는 Event 가 있으면 저장 차단(이중예약 불가).
MVP: 단순 시간 겹침: 반복 이벤트의 미래 occurrence 점유는 미고려(후속).
"""

import uuid
from datetime import datetime

from fastapi import HTTPException
from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.context import UserContext
from app.core.errors import BusinessError
from app.models.calendar import Calendar
from app.models.calendar_event import CalendarEvent
from app.models.room import Room
from app.services.calendars import can_read_event


def new_room_id() -> str:
    return str(uuid.uuid4())


async def get_room_or_404(
    db: AsyncSession, *, room_id: str, workspace_id: str
) -> Room:
    room = await db.get(Room, room_id)
    if room is None or room.workspace_id != workspace_id:
        raise HTTPException(status_code=404, detail="Room not found")
    return room


async def find_room_conflicts(
    db: AsyncSession,
    *,
    room_ids: list[str],
    start_at: datetime,
    end_at: datetime,
    exclude_event_id: str | None = None,
) -> dict[str, CalendarEvent]:
    """room_id 별로 [start, end) 와 겹치는 첫 Event. 겹침이 없는 방은 빠진다."""
    if not room_ids:
        return {}
    conds = [
        CalendarEvent.room_id.in_(room_ids),
        CalendarEvent.deleted_at.is_(None),
        CalendarEvent.start_at < end_at,
        CalendarEvent.end_at > start_at,
    ]
    if exclude_event_id:
        conds.append(CalendarEvent.id != exclude_event_id)
    rows = (
        await db.execute(
            select(CalendarEvent).where(and_(*conds)).order_by(CalendarEvent.start_at)
        )
    ).scalars()
    found: dict[str, CalendarEvent] = {}
    for ev in rows:
        if ev.room_id is not None:
            found.setdefault(ev.room_id, ev)
    return found


async def conflict_params(
    db: AsyncSession, conflict: CalendarEvent, *, user: UserContext, workspace_id: str
) -> dict[str, object]:
    """겹친 일정 안내용 값. 제목은 요청자가 그 일정을 읽을 수 있을 때만: 남의 개인 일정 제목 노출 방지."""
    params: dict[str, object] = {
        "start_at": conflict.start_at.isoformat(),
        "end_at": conflict.end_at.isoformat(),
        "all_day": conflict.all_day,
    }
    cal = await db.get(Calendar, conflict.calendar_id)
    if cal is not None and await can_read_event(
        db, conflict, cal, user=user, workspace_id=workspace_id
    ):
        params["title"] = conflict.title
    return params


async def assert_room_free(
    db: AsyncSession,
    *,
    room_id: str,
    start_at: datetime,
    end_at: datetime,
    workspace_id: str,
    user: UserContext,
    exclude_event_id: str | None = None,
) -> None:
    """room_id 가 [start, end) 에 이미 점유돼 있으면 409. 방이 워크스페이스 것이 아니면 404."""
    await get_room_or_404(db, room_id=room_id, workspace_id=workspace_id)
    found = await find_room_conflicts(
        db,
        room_ids=[room_id],
        start_at=start_at,
        end_at=end_at,
        exclude_event_id=exclude_event_id,
    )
    conflict = found.get(room_id)
    if conflict is not None:
        raise BusinessError(
            "ROOM_CONFLICT",
            status=409,
            message="회의실이 이미 예약돼 있습니다.",
            params=await conflict_params(
                db, conflict, user=user, workspace_id=workspace_id
            ),
        )
