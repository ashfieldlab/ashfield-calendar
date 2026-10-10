"""/api/v1/booking-types: 운영자가 관리하는 BookingType CRUD (ADR-0012).

권한:
  - owner_type='user'    → 본인만 (owner_user_sub == user.sub)
  - owner_type='company' → 그 회사 admin (require_company_admin 등가 검사)
  - System Admin 은 모든 BookingType 접근 가능 (super-set)

공개 라우트(/api/public/v1/*) 와 분리. 여기는 JWT 강제.
"""

from __future__ import annotations

import secrets
import uuid
from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException, Path
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.context import UserContext
from app.auth.dependencies import get_current_user, require_active_company
from app.core.db import get_db
from app.core.logging import logger
from app.models.booking import Booking
from app.models.booking_type import BookingType
from app.models.calendar import Calendar
from app.models.user_company_membership import UserCompanyMembership
from app.schemas.booking_type import (
    BookingTypeCreate,
    BookingTypeListResponse,
    BookingTypePatch,
    BookingTypeResponse,
)
from app.services.audit import write_audit

router = APIRouter(prefix="/booking-types", tags=["booking-types"])


def _to_response(bt: BookingType) -> BookingTypeResponse:
    return BookingTypeResponse.model_validate(bt, from_attributes=True)


def _new_public_key() -> str:
    return secrets.token_urlsafe(8)


async def _can_manage(
    db: AsyncSession, bt: BookingType, user: UserContext
) -> bool:
    """본인 / 회사 admin / system admin."""
    if user.is_system_admin:
        return True
    if bt.owner_type == "user":
        return bt.owner_user_sub == user.sub
    # owner_type == 'company'
    m = await db.get(UserCompanyMembership, (user.sub, bt.owner_company_id))
    return m is not None and m.role == "admin"


async def _get_or_403(
    db: AsyncSession, booking_type_id: str, user: UserContext
) -> BookingType:
    bt = await db.get(BookingType, booking_type_id)
    if bt is None or bt.deleted_at is not None:
        raise HTTPException(404, "BookingType not found")
    if not await _can_manage(db, bt, user):
        raise HTTPException(403, "Forbidden")
    return bt


@router.get(
    "",
    response_model=BookingTypeListResponse,
    summary="본인이 관리 가능한 BookingType 목록",
)
async def list_booking_types(
    user: UserContext = Depends(get_current_user),
    company_id: str = Depends(require_active_company),
    db: AsyncSession = Depends(get_db),
) -> BookingTypeListResponse:
    """본인 소유 + 본인이 admin 인 활성 회사의 회사 소유. System Admin 은 활성 회사 + 본인 것."""
    conds = [BookingType.deleted_at.is_(None)]
    # 활성 회사를 명시적으로 받음: 어느 회사 컨텍스트에서 보는지
    if user.is_system_admin:
        conds.append(
            (BookingType.owner_company_id == company_id)
            | (BookingType.owner_user_sub == user.sub)
        )
    else:
        # 회사 admin 인지 검사
        m = await db.get(UserCompanyMembership, (user.sub, company_id))
        is_company_admin = m is not None and m.role == "admin"
        if is_company_admin:
            conds.append(
                (BookingType.owner_company_id == company_id)
                | (BookingType.owner_user_sub == user.sub)
            )
        else:
            conds.append(BookingType.owner_user_sub == user.sub)

    stmt = (
        select(BookingType)
        .where(*conds)
        .order_by(BookingType.title)
    )
    rows = list((await db.execute(stmt)).scalars().all())
    return BookingTypeListResponse(items=[_to_response(r) for r in rows])


@router.post(
    "",
    response_model=BookingTypeResponse,
    summary="BookingType 생성",
    status_code=201,
    responses={
        400: {"description": "target_calendar 가 owner 와 다른 컨텍스트"},
        403: {"description": "owner_type=company 인데 회사 admin 아님"},
    },
)
async def create_booking_type(
    body: BookingTypeCreate,
    user: UserContext = Depends(get_current_user),
    company_id: str = Depends(require_active_company),
    db: AsyncSession = Depends(get_db),
) -> BookingTypeResponse:
    # target_calendar 검증
    cal = await db.get(Calendar, body.target_calendar_id)
    if cal is None or cal.deleted_at is not None or cal.company_id != company_id:
        raise HTTPException(400, "target_calendar invalid")

    # owner 결정 + 권한
    if body.owner_type == "user":
        owner_user_sub: str | None = user.sub
        owner_company_id: str | None = None
        # personal 캘린더는 본인 것만, shared 는 회사 멤버면 OK
        if cal.scope == "personal" and cal.owner_id != user.sub:
            raise HTTPException(400, "target_calendar not owned by you")
    else:  # company
        if not user.is_system_admin:
            m = await db.get(UserCompanyMembership, (user.sub, company_id))
            if m is None or m.role != "admin":
                raise HTTPException(403, "Company admin only")
        owner_user_sub = None
        owner_company_id = company_id
        if cal.scope != "shared":
            raise HTTPException(
                400, "company-owned BookingType must use a shared calendar"
            )

    bt = BookingType(
        id=str(uuid.uuid7()),
        owner_type=body.owner_type,
        owner_user_sub=owner_user_sub,
        owner_company_id=owner_company_id,
        public_key=_new_public_key(),
        title=body.title,
        description=body.description,
        privacy_policy_url=body.privacy_policy_url,
        duration_minutes=body.duration_minutes,
        timezone=body.timezone,
        weekly_schedule=body.weekly_schedule,
        available_from=body.available_from,
        available_to=body.available_to,
        minimum_notice_minutes=body.minimum_notice_minutes,
        lookahead_days=body.lookahead_days,
        target_calendar_id=body.target_calendar_id,
        blocking_calendar_ids=body.blocking_calendar_ids,
        capacity=body.capacity,
        # 미지정 시: 생성한 운영자 본인을 기본으로 (user/company 둘 다).
        # company-owned 도 추후 UI 에서 멤버 다중 선택해 추가 가능.
        notify_user_subs=body.notify_user_subs or [user.sub],
    )
    db.add(bt)
    await write_audit(
        db,
        company_id=company_id,
        actor=user,
        action="create",
        entity_type="booking_type",
        entity_id=bt.id,
        meta={"title": bt.title, "public_key": bt.public_key},
    )
    await db.commit()
    await db.refresh(bt)
    logger.info(
        "booking_type_created",
        extra={"category": "biz", "id": bt.id, "owner_type": bt.owner_type},
    )
    return _to_response(bt)


@router.get(
    "/{booking_type_id}",
    response_model=BookingTypeResponse,
    summary="BookingType 단건 조회",
)
async def get_booking_type(
    booking_type_id: str = Path(...),
    user: UserContext = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> BookingTypeResponse:
    bt = await _get_or_403(db, booking_type_id, user)
    return _to_response(bt)


@router.patch(
    "/{booking_type_id}",
    response_model=BookingTypeResponse,
    summary="BookingType 수정",
)
async def patch_booking_type(
    body: BookingTypePatch,
    booking_type_id: str = Path(...),
    user: UserContext = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> BookingTypeResponse:
    bt = await _get_or_403(db, booking_type_id, user)
    fields = body.model_dump(exclude_unset=True)
    if "target_calendar_id" in fields:
        cal = await db.get(Calendar, fields["target_calendar_id"])
        ctx_company = bt.owner_company_id or (
            (await db.get(Calendar, bt.target_calendar_id)).company_id
        )
        if cal is None or cal.deleted_at is not None or cal.company_id != ctx_company:
            raise HTTPException(400, "target_calendar invalid")
    for k, v in fields.items():
        setattr(bt, k, v)
    await write_audit(
        db,
        company_id=bt.owner_company_id,  # NULL OK (D-1)
        actor=user,
        action="update",
        entity_type="booking_type",
        entity_id=bt.id,
        meta={k: v for k, v in fields.items() if k != "weekly_schedule"},
    )
    await db.commit()
    await db.refresh(bt)
    return _to_response(bt)


@router.delete(
    "/{booking_type_id}",
    status_code=204,
    summary="BookingType soft delete (공개 URL 무효화)",
)
async def delete_booking_type(
    booking_type_id: str = Path(...),
    user: UserContext = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    bt = await _get_or_403(db, booking_type_id, user)
    bt.deleted_at = datetime.now(UTC)
    await write_audit(
        db,
        company_id=bt.owner_company_id,
        actor=user,
        action="delete",
        entity_type="booking_type",
        entity_id=bt.id,
        meta={"title": bt.title},
    )
    await db.commit()


@router.get(
    "/{booking_type_id}/bookings",
    summary="이 BookingType 으로 들어온 Booking 목록 (운영자)",
)
async def list_bookings_of_type(
    booking_type_id: str = Path(...),
    user: UserContext = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    bt = await _get_or_403(db, booking_type_id, user)
    rows = list(
        (
            await db.execute(
                select(Booking)
                .where(Booking.booking_type_id == bt.id)
                .order_by(Booking.slot_start_at.desc())
                .limit(200)
            )
        ).scalars().all()
    )
    return {
        "items": [
            {
                "id": b.id,
                "slot_start_at": b.slot_start_at.isoformat(),
                "slot_end_at": b.slot_end_at.isoformat(),
                "customer_name": b.customer_name,
                "customer_email": b.customer_email,
                "customer_message": b.customer_message,
                "status": b.status,
                "cancelled_at": b.cancelled_at.isoformat() if b.cancelled_at else None,
                "created_at": b.created_at.isoformat(),
            }
            for b in rows
        ]
    }


@router.post(
    "/{booking_type_id}/bookings/{booking_id}/reschedule",
    summary="운영자가 예약 시간(또는 메모) 변경",
    responses={
        404: {"description": "BookingType 또는 Booking 없음/불일치"},
        409: {"description": "새 슬롯 만석/충돌"},
        422: {"description": "force=false 인데 가용 외 시각"},
    },
)
async def operator_reschedule_booking(
    body: dict,
    booking_type_id: str = Path(...),
    booking_id: str = Path(...),
    user: UserContext = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    from datetime import datetime as _dt

    from app.models.company import Company
    from app.services.booking import (
        dispatch_booking_rescheduled_emails,
        public_base_url,
        reschedule_booking,
    )

    bt = await _get_or_403(db, booking_type_id, user)
    booking = await db.get(Booking, booking_id)
    if booking is None or booking.booking_type_id != bt.id:
        raise HTTPException(404, "Booking not found")

    new_iso = body.get("new_slot_start_at")
    if not isinstance(new_iso, str):
        raise HTTPException(422, "new_slot_start_at required")
    try:
        new_slot = _dt.fromisoformat(new_iso.replace("Z", "+00:00"))
    except ValueError as exc:
        raise HTTPException(422, "invalid new_slot_start_at") from exc

    new_description = body.get("new_description")
    if new_description is not None and not isinstance(new_description, str):
        raise HTTPException(422, "new_description must be string or null")

    force = bool(body.get("force", False))
    notify_customer = body.get("notify_customer", True)

    old_slot = booking.slot_start_at
    await reschedule_booking(
        db,
        booking=booking,
        bt=bt,
        new_slot_start_at=new_slot,
        new_description=new_description,
        force=force,
    )
    await write_audit(
        db,
        company_id=bt.owner_company_id,
        actor=user,
        action="update",
        entity_type="booking",
        entity_id=booking.id,
        meta={
            "action": "reschedule",
            "old_slot": old_slot.isoformat(),
            "new_slot": new_slot.isoformat(),
            "force": force,
        },
    )
    await db.commit()
    await db.refresh(booking)

    if notify_customer:
        org_name, org_logo = "Workspace", None
        if bt.owner_company_id:
            c = await db.get(Company, bt.owner_company_id)
            if c is not None:
                org_name, org_logo = c.name, c.logo_url
        await dispatch_booking_rescheduled_emails(
            booking, bt,
            organization_name=org_name,
            organization_logo_url=org_logo,
            base_url=public_base_url(),
            old_slot_start=old_slot,
        )

    return {
        "ok": True,
        "slot_start_at": booking.slot_start_at.isoformat(),
        "slot_end_at": booking.slot_end_at.isoformat(),
    }


@router.post(
    "/{booking_type_id}/bookings/{booking_id}/cancel",
    summary="운영자가 예약 취소",
    responses={404: {"description": "BookingType 또는 Booking 없음/불일치"}},
)
async def operator_cancel_booking(
    booking_type_id: str = Path(...),
    booking_id: str = Path(...),
    user: UserContext = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    from datetime import UTC, datetime

    from app.models.calendar_event import CalendarEvent

    bt = await _get_or_403(db, booking_type_id, user)
    booking = await db.get(Booking, booking_id)
    if booking is None or booking.booking_type_id != bt.id:
        raise HTTPException(404, "Booking not found")
    if booking.status == "active":
        booking.status = "cancelled"
        booking.cancelled_at = datetime.now(UTC)
        booking.cancelled_by = "operator"
        if booking.calendar_event_id:
            ev = await db.get(CalendarEvent, booking.calendar_event_id)
            if ev is not None and ev.deleted_at is None:
                ev.deleted_at = booking.cancelled_at
        await write_audit(
            db,
            company_id=bt.owner_company_id,
            actor=user,
            action="delete",
            entity_type="booking",
            entity_id=booking.id,
            meta={"by": "operator"},
        )
        await db.commit()
        # 고객·운영자에게 취소 통지 메일
        from app.models.company import Company
        from app.services.booking import (
            dispatch_booking_cancelled_emails,
            public_base_url,
        )

        org_name, org_logo = "Workspace", None
        if bt.owner_company_id:
            c = await db.get(Company, bt.owner_company_id)
            if c is not None:
                org_name, org_logo = c.name, c.logo_url
        await dispatch_booking_cancelled_emails(
            booking, bt,
            organization_name=org_name,
            organization_logo_url=org_logo,
            base_url=public_base_url(),
        )
    return {"ok": True, "status": booking.status}


@router.post(
    "/{booking_type_id}/rotate-key",
    response_model=BookingTypeResponse,
    summary="공개 URL 키 재발급 (기존 URL 무효화)",
)
async def rotate_public_key(
    booking_type_id: str = Path(...),
    user: UserContext = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> BookingTypeResponse:
    bt = await _get_or_403(db, booking_type_id, user)
    bt.public_key = _new_public_key()
    await write_audit(
        db,
        company_id=bt.owner_company_id,
        actor=user,
        action="rotate_token",
        entity_type="booking_type",
        entity_id=bt.id,
        meta={"new_public_key": bt.public_key},
    )
    await db.commit()
    await db.refresh(bt)
    return _to_response(bt)
