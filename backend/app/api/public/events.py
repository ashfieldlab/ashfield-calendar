"""공개 일정 RSVP 라우트: 비인증 (ADR-0011).

외부 게스트가 이메일 링크(/rsvp/{token})로 일정 초대에 응답한다.
  GET   /events/rsvp/{token}  : 초대/일정 요약 (노출 최소화)
  POST  /events/rsvp/{token}  : 수락/거절/미정

노출 최소화: 일정 제목, 시작/종료, 초대 워크스페이스 이름과 본인 이메일만. 운영자 신원, 다른
초대자 정보 X. 보호: IP rate limit + audit log.
"""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, Header, HTTPException, Path, Request
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_db
from app.core.logging import logger
from app.middleware.rate_limit import check_ip_limit, get_rate_limits
from app.models.calendar import Calendar
from app.models.calendar_event import CalendarEvent
from app.models.calendar_event_invitation import CalendarEventInvitation
from app.models.workspace import Workspace
from app.services.audit import write_audit
from app.services.notifications import PendingDispatch, notify

router = APIRouter(prefix="/events", tags=["public-rsvp"])


def _client_ip(request: Request, x_forwarded_for: str | None) -> str:
    if x_forwarded_for:
        return x_forwarded_for.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


class PublicRsvpView(BaseModel):
    """공개 표시: 운영자 신원, 다른 초대자 노출 X."""

    title: str
    start_at: datetime
    end_at: datetime
    location: str | None = None
    organization_name: str
    invitee_email: str
    response: str


class RsvpSubmit(BaseModel):
    response: Literal["accepted", "declined", "tentative"]


async def _load_or_404(
    db: AsyncSession, token: str
) -> tuple[CalendarEventInvitation, CalendarEvent, Calendar]:
    inv = (
        await db.execute(
            select(CalendarEventInvitation).where(
                CalendarEventInvitation.rsvp_token == token
            )
        )
    ).scalar_one_or_none()
    if inv is None or inv.invitee_sub is not None:
        raise HTTPException(404, "유효하지 않은 초대입니다")
    ev = await db.get(CalendarEvent, inv.event_id)
    if ev is None or ev.deleted_at is not None:
        raise HTTPException(404, "일정을 찾을 수 없습니다")
    cal = await db.get(Calendar, ev.calendar_id)
    if cal is None:
        raise HTTPException(404, "일정을 찾을 수 없습니다")
    return inv, ev, cal


@router.get(
    "/rsvp/{token}",
    response_model=PublicRsvpView,
    summary="초대 요약 (토큰)",
    responses={404: {"description": "유효하지 않은 토큰"}},
)
async def get_rsvp(
    request: Request,
    token: str = Path(..., min_length=16, max_length=64),
    x_forwarded_for: Annotated[str | None, Header()] = None,
    db: AsyncSession = Depends(get_db),
) -> PublicRsvpView:
    per_ip, _ = get_rate_limits()
    await check_ip_limit(_client_ip(request, x_forwarded_for), per_ip)

    inv, ev, cal = await _load_or_404(db, token)
    workspace = await db.get(Workspace, cal.workspace_id)
    return PublicRsvpView(
        title=ev.title,
        start_at=ev.start_at,
        end_at=ev.end_at,
        location=ev.location,
        organization_name=workspace.name if workspace else "Ashfield",
        invitee_email=inv.invitee_email or "",
        response=inv.response,
    )


@router.post(
    "/rsvp/{token}",
    response_model=PublicRsvpView,
    summary="초대 응답 (토큰)",
    responses={404: {"description": "유효하지 않은 토큰"}},
)
async def submit_rsvp(
    request: Request,
    body: RsvpSubmit,
    token: str = Path(..., min_length=16, max_length=64),
    x_forwarded_for: Annotated[str | None, Header()] = None,
    db: AsyncSession = Depends(get_db),
) -> PublicRsvpView:
    ip = _client_ip(request, x_forwarded_for)
    per_ip, _ = get_rate_limits()
    await check_ip_limit(ip, per_ip)

    inv, ev, cal = await _load_or_404(db, token)
    inv.response = body.response
    inv.responded_at = datetime.now(UTC)

    # 주최자에게 응답 통지 (in-app + 이메일). 외부 게스트라 actor_sub 없음.
    pending = PendingDispatch()
    await notify(
        db,
        pending,
        recipient_sub=ev.created_by_sub,
        workspace_id=cal.workspace_id,
        actor_sub=None,
        type_="event_invitation_response",
        entity_type="event",
        entity_id=ev.id,
        payload={
            "title": ev.title,
            "response": body.response,
            "guest_email": inv.invitee_email,
            "guest_name": inv.invitee_name,
            "start_at": ev.start_at.isoformat(),
            "end_at": ev.end_at.isoformat(),
            "all_day": ev.all_day,
            "location": ev.location,
            "calendar_id": cal.id,
        },
    )
    await write_audit(
        db,
        workspace_id=cal.workspace_id,
        actor=None,
        actor_type="public",
        action="update",
        entity_type="event",
        entity_id=ev.id,
        meta={
            "rsvp": body.response,
            "guest_email": inv.invitee_email,
            "guest_name": inv.invitee_name,
            "calendar_id": cal.id,
            "title": ev.title,
            "ip": ip,
        },
    )
    await db.commit()
    await pending.fire()
    await db.refresh(inv)
    logger.info(
        "public_rsvp_submitted",
        extra={"category": "biz", "event_id": ev.id, "response": body.response, "ip": ip},
    )
    workspace = await db.get(Workspace, cal.workspace_id)
    return PublicRsvpView(
        title=ev.title,
        start_at=ev.start_at,
        end_at=ev.end_at,
        location=ev.location,
        organization_name=workspace.name if workspace else "Ashfield",
        invitee_email=inv.invitee_email or "",
        response=inv.response,
    )
