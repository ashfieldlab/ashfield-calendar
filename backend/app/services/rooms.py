"""Room(회의실) 충돌 체크 + 조회 (ADR-0019).

같은 room_id 로 시간이 겹치는 Event 가 있으면 저장 차단(이중예약 불가).
MVP: 단순 시간 겹침: 반복 이벤트의 미래 occurrence 점유는 미고려(후속).
"""

import uuid
from datetime import datetime

from fastapi import HTTPException
from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.calendar_event import CalendarEvent
from app.models.room import Room


def new_room_id() -> str:
    return str(uuid.uuid4())


async def get_room_or_404(
    db: AsyncSession, *, room_id: str, workspace_id: str
) -> Room:
    room = await db.get(Room, room_id)
    if room is None or room.workspace_id != workspace_id:
        raise HTTPException(status_code=404, detail="Room not found")
    return room


async def assert_room_free(
    db: AsyncSession,
    *,
    room_id: str,
    start_at: datetime,
    end_at: datetime,
    workspace_id: str,
    exclude_event_id: str | None = None,
) -> None:
    """room_id 가 [start, end) 에 이미 점유돼 있으면 409. 방이 워크스페이스 것이 아니면 404."""
    await get_room_or_404(db, room_id=room_id, workspace_id=workspace_id)
    conds = [
        CalendarEvent.room_id == room_id,
        CalendarEvent.deleted_at.is_(None),
        CalendarEvent.start_at < end_at,
        CalendarEvent.end_at > start_at,
    ]
    if exclude_event_id:
        conds.append(CalendarEvent.id != exclude_event_id)
    conflict = (
        await db.execute(select(CalendarEvent).where(and_(*conds)).limit(1))
    ).scalar_one_or_none()
    if conflict is not None:
        raise HTTPException(
            status_code=409,
            detail={
                "code": "ROOM_CONFLICT",
                "message": f"회의실이 이미 예약돼 있습니다: '{conflict.title}'",
                "conflict": {
                    "event_id": conflict.id,
                    "title": conflict.title,
                    "start_at": conflict.start_at.isoformat(),
                    "end_at": conflict.end_at.isoformat(),
                },
            },
        )
