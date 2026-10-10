"""/api/v1/search: 일정 검색.

list_visible_calendars(+초대) 로 권한 정합. 필터: 날짜 범위, calendar_id. FTS 는 보류(ILIKE).
"""

from datetime import datetime

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy import and_, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.context import UserContext
from app.auth.dependencies import get_current_user, require_active_workspace
from app.core.db import get_db
from app.models.calendar_event import CalendarEvent
from app.models.calendar_event_invitation import CalendarEventInvitation
from app.services.calendars import list_visible_calendars


class SearchEventItem(BaseModel):
    id: str
    calendar_id: str
    title: str
    description: str | None
    location: str | None
    start_at: datetime
    end_at: datetime


class SearchResponse(BaseModel):
    events: list[SearchEventItem]


router = APIRouter(prefix="/search", tags=["search"])


@router.get(
    "",
    response_model=SearchResponse,
    summary="일정 검색 (권한 정합)",
    responses={422: {"description": "q 가 비어있거나 128자 초과"}},
)
async def search(
    q: str = Query(..., min_length=1, max_length=128, description="검색어"),
    limit: int = Query(20, ge=1, le=100, description="결과 수"),
    date_from: datetime | None = Query(None, description="일정 시작 >= "),
    date_to: datetime | None = Query(None, description="일정 시작 < "),
    calendar_id: str | None = Query(None, description="특정 캘린더만"),
    user: UserContext = Depends(get_current_user),
    workspace_id: str = Depends(require_active_workspace),
    db: AsyncSession = Depends(get_db),
) -> SearchResponse:
    pattern = f"%{q}%"

    # --- 일정: 가시 캘린더 + 초대받은 것 (이미 권한 정합) ---
    visible = await list_visible_calendars(db, workspace_id=workspace_id, user=user)
    visible_ids = [c.id for c, _p in visible]

    event_filters = [
        CalendarEvent.deleted_at.is_(None),
        or_(
            CalendarEvent.title.ilike(pattern),
            CalendarEvent.description.ilike(pattern),
            CalendarEvent.location.ilike(pattern),
        ),
    ]
    if date_from:
        event_filters.append(CalendarEvent.start_at >= date_from)
    if date_to:
        event_filters.append(CalendarEvent.start_at < date_to)
    if calendar_id:
        event_filters.append(CalendarEvent.calendar_id == calendar_id)

    if visible_ids:
        from_visible = select(CalendarEvent).where(
            and_(CalendarEvent.calendar_id.in_(visible_ids), *event_filters)
        )
    else:
        from_visible = None

    from_invited = (
        select(CalendarEvent)
        .join(
            CalendarEventInvitation,
            CalendarEventInvitation.event_id == CalendarEvent.id,
        )
        .where(
            and_(
                CalendarEventInvitation.invitee_sub == user.sub,
                CalendarEventInvitation.response != "declined",
                *event_filters,
            )
        )
    )

    seen: dict[str, CalendarEvent] = {}
    if from_visible is not None:
        for e in (await db.execute(from_visible.limit(limit))).scalars().all():
            seen[e.id] = e
    for e in (await db.execute(from_invited.limit(limit))).scalars().all():
        seen.setdefault(e.id, e)
    events = sorted(seen.values(), key=lambda x: x.start_at, reverse=True)[:limit]

    return SearchResponse(
        events=[
            SearchEventItem(
                id=e.id,
                calendar_id=e.calendar_id,
                title=e.title,
                description=e.description,
                location=e.location,
                start_at=e.start_at,
                end_at=e.end_at,
            )
            for e in events
        ],
    )
