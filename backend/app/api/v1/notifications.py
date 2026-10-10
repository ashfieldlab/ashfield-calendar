"""/api/v1/notifications: in-app 알림 조회/읽음 + 이메일 수신 설정.

알림은 본인이 한 행동이 아닌 변경에 대해 자동 발생:
  - `event_invited`: 누가 본인을 일정에 초대
  - `event_invitation_response`: 본인이 만든 일정에 초대받은 사람이 응답
  - `event_updated`, `event_cancelled`: 참석하는 일정이 바뀌거나 취소됨 (payload 에 바뀐 필드, 이전 시각)
  - `event_reminder`, `booking_*`

목록 응답은 알림마다 지금 상태의 일정(`event`), 본인 초대(`invitation`), 예약(`booking`)을 붙인다:
알림 화면에서 바로 초대에 응답하고 일정 카드를 그리기 위해.

각 알림은 (1) DB row (in-app) (2) 매칭 Webhook fan-out (3) 이메일 (opt-out 가능) 3채널.
이메일은 `smtp_enabled=true` + `email_enabled=true` 일 때만.
"""

from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import and_, func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.context import UserContext
from app.auth.dependencies import get_current_user, require_active_workspace
from app.core.db import get_db
from app.models.booking import Booking
from app.models.calendar import Calendar
from app.models.calendar_event import CalendarEvent
from app.models.calendar_event_invitation import CalendarEventInvitation
from app.models.notification import Notification
from app.models.user import User
from app.models.user_calendar_preference import UserCalendarPreference
from app.schemas.notification import (
    EmailPreferencePatch,
    EmailPreferenceResponse,
    MarkAllReadResponse,
    NotificationBookingContext,
    NotificationEventContext,
    NotificationInvitationContext,
    NotificationListResponse,
    NotificationPatch,
    NotificationResponse,
)
from app.services.email import get_or_create_pref

router = APIRouter(prefix="/notifications", tags=["notifications"])


def _to_response(n: Notification, actor_name: str | None = None) -> NotificationResponse:
    return NotificationResponse(
        id=n.id,
        type=n.type,
        actor_sub=n.actor_sub,
        actor_name=actor_name,
        entity_type=n.entity_type,
        entity_id=n.entity_id,
        payload=n.payload,
        read_at=n.read_at,
        created_at=n.created_at,
    )


async def _with_context(
    db: AsyncSession, rows: list[Notification], user_sub: str
) -> list[NotificationResponse]:
    """알림 목록에 일정, 본인 초대, 예약의 현재 상태를 붙인다 (종류별 IN 조회, N+1 없음)."""
    names = await _actor_names(db, {r.actor_sub for r in rows if r.actor_sub})
    out = [
        _to_response(r, names.get(r.actor_sub) if r.actor_sub else None) for r in rows
    ]

    booking_ids = {r.entity_id for r in rows if r.entity_type == "booking"}
    bookings: dict[str, Booking] = {}
    if booking_ids:
        for b in (
            await db.execute(select(Booking).where(Booking.id.in_(booking_ids)))
        ).scalars():
            bookings[b.id] = b

    event_ids = {r.entity_id for r in rows if r.entity_type == "event"}
    event_ids |= {b.calendar_event_id for b in bookings.values() if b.calendar_event_id}
    events: dict[str, CalendarEvent] = {}
    cals: dict[str, Calendar] = {}
    colors: dict[str, str] = {}
    invs: dict[str, CalendarEventInvitation] = {}
    if event_ids:
        for ev in (
            await db.execute(select(CalendarEvent).where(CalendarEvent.id.in_(event_ids)))
        ).scalars():
            events[ev.id] = ev
        cal_ids = {ev.calendar_id for ev in events.values()}
        if cal_ids:
            for c in (
                await db.execute(select(Calendar).where(Calendar.id.in_(cal_ids)))
            ).scalars():
                cals[c.id] = c
            for p in (
                await db.execute(
                    select(UserCalendarPreference).where(
                        UserCalendarPreference.user_sub == user_sub,
                        UserCalendarPreference.calendar_id.in_(cal_ids),
                    )
                )
            ).scalars():
                if p.color_override:
                    colors[p.calendar_id] = p.color_override
        for inv in (
            await db.execute(
                select(CalendarEventInvitation).where(
                    CalendarEventInvitation.event_id.in_(event_ids),
                    CalendarEventInvitation.invitee_sub == user_sub,
                )
            )
        ).scalars():
            invs[inv.event_id] = inv

    for r, resp in zip(rows, out, strict=True):
        b = bookings.get(r.entity_id) if r.entity_type == "booking" else None
        if b is not None:
            resp.booking = NotificationBookingContext(
                id=b.id,
                booking_type_id=b.booking_type_id,
                status=b.status,
                slot_start_at=b.slot_start_at,
                slot_end_at=b.slot_end_at,
                customer_name=b.customer_name,
                customer_email=b.customer_email,
                calendar_event_id=b.calendar_event_id,
            )
        ev_id = (
            r.entity_id
            if r.entity_type == "event"
            else (b.calendar_event_id if b is not None else None)
        )
        ev = events.get(ev_id) if ev_id else None
        if ev is not None:
            cal = cals.get(ev.calendar_id)
            resp.event = NotificationEventContext(
                id=ev.id,
                title=ev.title,
                start_at=ev.start_at,
                end_at=ev.end_at,
                all_day=ev.all_day,
                location=ev.location,
                calendar_id=ev.calendar_id,
                # 남의 개인 캘린더(초대받은 일정) 이름은 노출하지 않는다
                calendar_name=(
                    cal.name
                    if cal and (cal.scope == "shared" or cal.owner_id == user_sub)
                    else None
                ),
                calendar_color=colors.get(ev.calendar_id) or (cal.color if cal else None),
                deleted=ev.deleted_at is not None,
            )
            inv = invs.get(ev.id)
            if inv is not None and r.type == "event_invited":
                resp.invitation = NotificationInvitationContext(
                    id=inv.id, event_id=inv.event_id, response=inv.response
                )
    return out


async def _actor_names(db: AsyncSession, subs: set[str]) -> dict[str, str | None]:
    if not subs:
        return {}
    names: dict[str, str | None] = {}
    for u in (await db.execute(select(User).where(User.id.in_(subs)))).scalars():
        names[u.id] = u.name or u.email or u.id
    return names


@router.get(
    "",
    response_model=NotificationListResponse,
    summary="알림 목록 + 안읽음 카운트",
)
async def list_notifications(
    unread_only: bool = Query(False, description="true 면 안읽음만"),
    entity_types: list[str] | None = Query(
        None,
        description="지정 시 해당 entity_type 만 (앱 스코프). 미지정이면 전체.",
    ),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0, description="페이지네이션 오프셋 (히스토리 페이지 '더 보기')"),
    user: UserContext = Depends(get_current_user),
    workspace_id: str = Depends(require_active_workspace),
    db: AsyncSession = Depends(get_db),
) -> NotificationListResponse:
    conds = [
        Notification.recipient_sub == user.sub,
        Notification.workspace_id == workspace_id,
    ]
    if entity_types:
        conds.append(Notification.entity_type.in_(entity_types))
    list_conds = [*conds]
    if unread_only:
        list_conds.append(Notification.read_at.is_(None))

    # limit+1 조회로 다음 페이지 존재 여부 판단 (별도 count 쿼리 회피).
    stmt = (
        select(Notification)
        .where(and_(*list_conds))
        .order_by(Notification.created_at.desc())
        .limit(limit + 1)
        .offset(offset)
    )
    rows = list((await db.execute(stmt)).scalars().all())
    has_more = len(rows) > limit
    rows = rows[:limit]

    # 안읽음 카운트는 앱 스코프(entity_types)는 반영하되 unread_only 와 무관하게 항상 계산.
    unread_stmt = select(func.count()).where(
        and_(*conds, Notification.read_at.is_(None))
    )
    unread_count = (await db.execute(unread_stmt)).scalar_one()

    return NotificationListResponse(
        notifications=await _with_context(db, rows, user.sub),
        unread_count=int(unread_count),
        has_more=has_more,
    )


@router.get(
    "/preferences",
    response_model=EmailPreferenceResponse,
    summary="이메일 알림 수신 설정 조회",
)
async def get_preferences(
    user: UserContext = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> EmailPreferenceResponse:
    pref = await get_or_create_pref(db, user_sub=user.sub)
    await db.commit()
    await db.refresh(pref)
    return EmailPreferenceResponse(
        email_enabled=pref.email_enabled, email_categories=pref.email_categories
    )


@router.patch(
    "/preferences",
    response_model=EmailPreferenceResponse,
    summary="이메일 알림 수신 토글 (마스터 + 카테고리별)",
)
async def patch_preferences(
    body: EmailPreferencePatch,
    user: UserContext = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> EmailPreferenceResponse:
    pref = await get_or_create_pref(db, user_sub=user.sub)
    if body.email_enabled is not None:
        pref.email_enabled = body.email_enabled
    if body.email_categories is not None:
        # 넘어온 키만 병합: 새 dict 재할당으로 ORM 변경 감지.
        pref.email_categories = {**(pref.email_categories or {}), **body.email_categories}
    await db.commit()
    await db.refresh(pref)
    return EmailPreferenceResponse(
        email_enabled=pref.email_enabled, email_categories=pref.email_categories
    )


@router.patch(
    "/{notification_id}",
    response_model=NotificationResponse,
    summary="단건 읽음 토글",
    responses={404: {"description": "본인 알림 아님 또는 없음"}},
)
async def patch_notification(
    notification_id: str,
    body: NotificationPatch,
    user: UserContext = Depends(get_current_user),
    workspace_id: str = Depends(require_active_workspace),
    db: AsyncSession = Depends(get_db),
) -> NotificationResponse:
    n = await db.get(Notification, notification_id)
    if (
        n is None
        or n.recipient_sub != user.sub
        or n.workspace_id != workspace_id
    ):
        raise HTTPException(404, "Notification not found")
    # read=false 면 안 읽음으로 되돌린다
    n.read_at = datetime.now(UTC) if body.read else None
    await db.commit()
    await db.refresh(n)
    return (await _with_context(db, [n], user.sub))[0]


@router.post(
    "/mark-all-read",
    response_model=MarkAllReadResponse,
    summary="모든 알림 읽음 처리",
)
async def mark_all_read(
    entity_types: list[str] | None = Query(
        None,
        description="지정 시 해당 entity_type 알림만 읽음 처리 (앱 스코프). "
        "미지정이면 전체.",
    ),
    user: UserContext = Depends(get_current_user),
    workspace_id: str = Depends(require_active_workspace),
    db: AsyncSession = Depends(get_db),
) -> MarkAllReadResponse:
    now = datetime.now(UTC)
    conds = [
        Notification.recipient_sub == user.sub,
        Notification.workspace_id == workspace_id,
        Notification.read_at.is_(None),
    ]
    # 뱃지와 목록이 현재 앱 알림만 보여주므로, "모두 읽음"도 그 앱 범위만
    # 처리해야 함: 안 그러면 안 본 다른 앱 알림까지 읽음 처리되어 놓친다.
    if entity_types:
        conds.append(Notification.entity_type.in_(entity_types))
    stmt = update(Notification).where(and_(*conds)).values(read_at=now)
    result = await db.execute(stmt)
    await db.commit()
    return MarkAllReadResponse(marked=result.rowcount or 0)
