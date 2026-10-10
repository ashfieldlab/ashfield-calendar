"""/api/v1/me/activity: 본인 관련 audit_log 타임라인.

본인 관련 =
  - 본인이 한 행동
  - 본인이 받은 알림에 연결된 entity
  - 본인이 볼 수 있는 캘린더(본인 개인 캘린더, 워크스페이스 공유 캘린더)의 일정과 그 일정의 예약에
    다른 사람이 한 일
관리자 전체 audit 와 달리 일반 사용자가 볼 수 있음.
"""

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import and_, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.context import UserContext
from app.auth.dependencies import get_current_user, require_active_workspace
from app.core.db import get_db
from app.models.audit_log import AuditLog
from app.models.booking import Booking
from app.models.calendar import Calendar
from app.models.calendar_event import CalendarEvent
from app.models.notification import Notification
from app.models.user import User

# 일정 앱 활동 화면에 나오는 entity (워크스페이스 설정 변경 등은 제외)
APP_ENTITY_TYPES = ("calendar", "event", "booking", "booking_type", "caldav_token")


class ActivityItem(BaseModel):
    id: str
    actor_sub: str | None
    actor_name: str | None  # users 캐시에서 표시명: 없으면 None (UI fallback 처리)
    actor_type: str  # user | public | system
    action: str
    entity_type: str
    entity_id: str
    meta: dict
    created_at: datetime


class ActivityResponse(BaseModel):
    items: list[ActivityItem]


router = APIRouter(prefix="/me", tags=["activity"])


@router.get(
    "/activity",
    response_model=ActivityResponse,
    summary="본인 활동 타임라인",
    responses={400: {"description": "to <= from 또는 범위 400일 초과"}},
)
async def my_activity(
    limit: int = Query(50, ge=1, le=1000),
    from_: datetime | None = Query(
        None, alias="from", description="created_at 하한 (포함). 월 단위 조회용"
    ),
    to: datetime | None = Query(None, description="created_at 상한 (제외)"),
    user: UserContext = Depends(get_current_user),
    workspace_id: str = Depends(require_active_workspace),
    db: AsyncSession = Depends(get_db),
) -> ActivityResponse:
    if from_ and to and (to <= from_ or (to - from_).days > 400):
        raise HTTPException(400, "invalid range")

    # 본인이 받은 알림에 연결된 entity_id 집합: 본인이 영향받은 변경 추적
    notif_ids = select(Notification.entity_id).where(
        Notification.recipient_sub == user.sub,
        Notification.workspace_id == workspace_id,
    )
    # 볼 수 있는 캘린더: 공유 + 본인 개인 (삭제된 캘린더 포함: 삭제 기록도 보여야 함)
    visible_cals = select(Calendar.id).where(
        Calendar.workspace_id == workspace_id,
        or_(
            Calendar.scope == "shared",
            and_(Calendar.scope == "personal", Calendar.owner_id == user.sub),
        ),
    )
    visible_events = select(CalendarEvent.id).where(
        CalendarEvent.calendar_id.in_(visible_cals)
    )
    visible_bookings = select(Booking.id).where(
        Booking.calendar_event_id.in_(visible_events)
    )

    conds = [
        AuditLog.workspace_id == workspace_id,
        AuditLog.entity_type.in_(APP_ENTITY_TYPES),
        or_(
            AuditLog.actor_sub == user.sub,
            AuditLog.entity_id.in_(notif_ids),
            and_(AuditLog.entity_type == "event", AuditLog.entity_id.in_(visible_events)),
            and_(
                AuditLog.entity_type == "calendar",
                AuditLog.entity_id.in_(visible_cals),
            ),
            and_(
                AuditLog.entity_type == "booking",
                AuditLog.entity_id.in_(visible_bookings),
            ),
        ),
    ]
    if from_:
        conds.append(AuditLog.created_at >= from_)
    if to:
        conds.append(AuditLog.created_at < to)

    stmt = (
        select(AuditLog)
        .where(and_(*conds))
        .order_by(AuditLog.created_at.desc())
        .limit(limit)
    )
    rows = list((await db.execute(stmt)).scalars().all())

    # actor 표시명 한 번에 조회: N+1 회피
    actor_subs = {r.actor_sub for r in rows if r.actor_sub}
    names: dict[str, str | None] = {}
    if actor_subs:
        for u in (
            await db.execute(select(User).where(User.id.in_(actor_subs)))
        ).scalars():
            names[u.id] = u.name or u.email or u.id

    return ActivityResponse(
        items=[
            ActivityItem(
                id=r.id,
                actor_sub=r.actor_sub,
                actor_name=names.get(r.actor_sub) if r.actor_sub else None,
                actor_type=r.actor_type,
                action=r.action,
                entity_type=r.entity_type,
                entity_id=r.entity_id,
                # 공개 라우트 audit 의 ip 는 화면에 필요 없음
                meta={k: v for k, v in (r.meta or {}).items() if k != "ip"},
                created_at=r.created_at,
            )
            for r in rows
        ]
    )
