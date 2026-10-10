"""공개 booking 라우트: 비인증 (ADR-0011/0012).

엔드포인트:
  GET    /booking/{public_key}               : BookingType 공개 정보 (회사 이름 + 양식)
  GET    /booking/{public_key}/slots         : 가용 슬롯 (range_from/range_to)
  POST   /booking/{public_key}/submit        : 예약 제출 (honeypot + rate limit + 동의)
  POST   /booking/cancel/{cancel_token}      : 취소

노출 정보 최소화 (ADR-0011): 회사 이름 + 양식 title/description/duration 만.
운영자 신원·이메일 노출 X. 다른 예약자 정보 노출 X.

보호: honeypot 필드 + rate limit (IP + email) + audit log.
"""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Annotated

from fastapi import APIRouter, Depends, Header, HTTPException, Path, Query, Request
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_db
from app.core.logging import logger
from app.middleware.rate_limit import (
    check_email_limit,
    check_ip_limit,
    get_rate_limits,
)
from app.models.booking_type import BookingType
from app.models.company import Company
from app.models.user import User
from app.services.audit import write_audit
from app.services.booking import (
    available_slots,
    cancel_booking,
    create_booking,
    dispatch_booking_cancelled_emails,
    dispatch_booking_received_emails,
    public_base_url,
)

router = APIRouter(prefix="/booking", tags=["public-booking"])


# ---------------------------------------------------------------------------
# 응답 모델: 노출 정보 최소화
# ---------------------------------------------------------------------------


class PublicBookingTypeResponse(BaseModel):
    """공개 표시: 운영자 신원 노출 X."""

    public_key: str
    title: str
    description: str | None
    duration_minutes: int
    timezone: str
    capacity: int
    minimum_notice_minutes: int
    lookahead_days: int
    privacy_policy_url: str | None
    # 회사 이름만 (운영자 이름·이메일은 X)
    organization_name: str


class PublicSlotItem(BaseModel):
    start_at: datetime
    end_at: datetime
    remaining: int


class PublicSlotListResponse(BaseModel):
    slots: list[PublicSlotItem]


class PublicBookingSubmit(BaseModel):
    slot_start_at: datetime
    customer_name: str = Field(min_length=1, max_length=128)
    customer_email: EmailStr
    customer_message: str | None = Field(default=None, max_length=2000)
    consent: bool                          # 필수 동의
    # honeypot: 사람은 비워둠. 봇이 채우면 거부.
    website: str | None = Field(default=None, max_length=200)


class PublicBookingResponse(BaseModel):
    """제출 직후 응답: 예약자에게 보여줄 정보 + cancel 링크용 token."""

    cancel_token: str
    slot_start_at: datetime
    slot_end_at: datetime
    title: str


# ---------------------------------------------------------------------------
# 유틸
# ---------------------------------------------------------------------------


async def _get_active_or_404(
    db: AsyncSession, public_key: str
) -> BookingType:
    bt = (
        await db.execute(
            select(BookingType).where(BookingType.public_key == public_key)
        )
    ).scalar_one_or_none()
    if bt is None or not bt.enabled or bt.deleted_at is not None:
        raise HTTPException(404, "Not found")
    return bt


async def _organization_branding(
    db: AsyncSession, bt: BookingType
) -> tuple[str, str | None]:
    """노출용: (name, logo_url). user-owned 면 logo_url 없음."""
    if bt.owner_company_id:
        c = await db.get(Company, bt.owner_company_id)
        if c is not None:
            return c.name, c.logo_url
        return bt.owner_company_id, None
    # user-owned: 운영자 이름 노출 X. 도메인만 fallback, logo 없음.
    if bt.owner_user_sub:
        u = await db.get(User, bt.owner_user_sub)
        if u and u.email:
            return u.email.split("@")[-1], None
    return "Workspace", None


async def _organization_name(db: AsyncSession, bt: BookingType) -> str:
    """호환용: 이름만 필요한 곳에서 사용."""
    name, _ = await _organization_branding(db, bt)
    return name


def _client_ip(request: Request, x_forwarded_for: str | None) -> str:
    if x_forwarded_for:
        return x_forwarded_for.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


# ---------------------------------------------------------------------------
# 라우트
# ---------------------------------------------------------------------------


@router.get(
    "/{public_key}",
    response_model=PublicBookingTypeResponse,
    summary="공개 BookingType 정보 (회사 이름 + 양식)",
)
async def get_public_booking_type(
    request: Request,
    public_key: str = Path(..., min_length=1, max_length=32),
    x_forwarded_for: Annotated[str | None, Header()] = None,
    db: AsyncSession = Depends(get_db),
) -> PublicBookingTypeResponse:
    ip = _client_ip(request, x_forwarded_for)
    per_ip, _ = get_rate_limits()
    await check_ip_limit(ip, per_ip)

    bt = await _get_active_or_404(db, public_key)
    org = await _organization_name(db, bt)
    return PublicBookingTypeResponse(
        public_key=bt.public_key,
        title=bt.title,
        description=bt.description,
        duration_minutes=bt.duration_minutes,
        timezone=bt.timezone,
        capacity=bt.capacity,
        minimum_notice_minutes=bt.minimum_notice_minutes,
        lookahead_days=bt.lookahead_days,
        privacy_policy_url=bt.privacy_policy_url,
        organization_name=org,
    )


@router.get(
    "/{public_key}/slots",
    response_model=PublicSlotListResponse,
    summary="가용 슬롯 조회",
)
async def get_slots(
    request: Request,
    public_key: str = Path(..., min_length=1, max_length=32),
    from_: datetime = Query(..., alias="from"),
    to: datetime = Query(...),
    x_forwarded_for: Annotated[str | None, Header()] = None,
    db: AsyncSession = Depends(get_db),
) -> PublicSlotListResponse:
    ip = _client_ip(request, x_forwarded_for)
    per_ip, _ = get_rate_limits()
    await check_ip_limit(ip, per_ip)

    if to <= from_:
        raise HTTPException(400, "to must be > from")
    if (to - from_).days > 90:
        raise HTTPException(400, "range too large (max 90 days)")

    bt = await _get_active_or_404(db, public_key)
    slots = await available_slots(db, bt, from_, to)
    from datetime import timedelta

    duration = timedelta(minutes=bt.duration_minutes)
    return PublicSlotListResponse(
        slots=[
            PublicSlotItem(start_at=s, end_at=s + duration, remaining=remaining)
            for s, remaining in slots
        ]
    )


@router.post(
    "/{public_key}/submit",
    response_model=PublicBookingResponse,
    status_code=201,
    summary="예약 제출 (즉시 등록: ADR-0012)",
    responses={
        409: {"description": "슬롯 만석 또는 차단"},
        422: {"description": "동의 미체크, 가용 외 슬롯, validation 실패"},
        429: {"description": "rate limit"},
    },
)
async def submit_booking(
    body: PublicBookingSubmit,
    request: Request,
    public_key: str = Path(..., min_length=1, max_length=32),
    user_agent: Annotated[str | None, Header(alias="user-agent")] = None,
    x_forwarded_for: Annotated[str | None, Header()] = None,
    db: AsyncSession = Depends(get_db),
) -> PublicBookingResponse:
    ip = _client_ip(request, x_forwarded_for)
    per_ip, per_email = get_rate_limits()
    await check_ip_limit(ip, per_ip)
    await check_email_limit(body.customer_email, per_email)

    # honeypot: 채워졌으면 봇 의심, 성공 흉내 (silent reject)
    if body.website:
        logger.info(
            "honeypot_triggered",
            extra={"category": "api", "ip": ip, "email": body.customer_email},
        )
        # 정상 응답 흉내: 봇이 알아채지 못하게. 가짜 토큰.
        return PublicBookingResponse(
            cancel_token="discarded",
            slot_start_at=body.slot_start_at,
            slot_end_at=body.slot_start_at,
            title="ok",
        )

    if not body.consent:
        raise HTTPException(422, "consent required")

    bt = await _get_active_or_404(db, public_key)

    booking = await create_booking(
        db,
        bt=bt,
        slot_start_at=body.slot_start_at,
        customer_name=body.customer_name.strip(),
        customer_email=str(body.customer_email),
        customer_message=(body.customer_message or "").strip() or None,
        agreed_at=datetime.now(UTC),
        ip_address=ip[:64],
        user_agent=(user_agent or "")[:255] or None,
    )
    await write_audit(
        db,
        company_id=bt.owner_company_id,  # NULL OK (D-1)
        actor=None,
        actor_type="public",              # 공개 라우트 (ADR-0011)
        action="create",
        entity_type="booking",
        entity_id=booking.id,
        meta={
            "booking_type_id": bt.id,
            "slot_start_at": booking.slot_start_at.isoformat(),
            "ip": ip,
        },
    )
    await db.commit()
    await db.refresh(booking)
    logger.info(
        "public_booking_created",
        extra={
            "category": "biz",
            "booking_id": booking.id,
            "booking_type_id": bt.id,
            "ip": ip,
        },
    )
    # 이메일 발송: commit 후 (실패해도 booking 은 살아있음)
    org, org_logo = await _organization_branding(db, bt)
    await dispatch_booking_received_emails(
        booking,
        bt,
        organization_name=org,
        organization_logo_url=org_logo,
        base_url=public_base_url(),
    )
    return PublicBookingResponse(
        cancel_token=booking.cancel_token or "",
        slot_start_at=booking.slot_start_at,
        slot_end_at=booking.slot_end_at,
        title=bt.title,
    )


@router.post(
    "/cancel/{cancel_token}",
    summary="예약 취소 (토큰 인증)",
    responses={404: {"description": "유효하지 않은 토큰"}},
)
async def cancel(
    request: Request,
    cancel_token: str = Path(..., min_length=8, max_length=64),
    x_forwarded_for: Annotated[str | None, Header()] = None,
    db: AsyncSession = Depends(get_db),
) -> dict:
    ip = _client_ip(request, x_forwarded_for)
    per_ip, _ = get_rate_limits()
    await check_ip_limit(ip, per_ip)

    booking = await cancel_booking(db, cancel_token=cancel_token, by="customer")
    # audit: booking_type 의 owner 회사로 연결 가능하면
    bt = await db.get(BookingType, booking.booking_type_id)
    await write_audit(
        db,
        company_id=bt.owner_company_id if bt else None,
        actor=None,
        actor_type="public",
        action="delete",
        entity_type="booking",
        entity_id=booking.id,
        meta={"by": "customer", "ip": ip},
    )
    await db.commit()
    logger.info(
        "public_booking_cancelled",
        extra={"category": "biz", "booking_id": booking.id, "ip": ip},
    )
    if bt is not None:
        org, org_logo = await _organization_branding(db, bt)
        await dispatch_booking_cancelled_emails(
            booking,
            bt,
            organization_name=org,
            organization_logo_url=org_logo,
            base_url=public_base_url(),
        )
    return {"ok": True}
