"""/api/v1/companies/{id}/members — Company Admin 이 자기 회사 멤버·role 관리.

System Admin 도 통과 (require_company_admin super-set). 다른 회사 침범은 path
검증으로 막힘.

소속은 로컬 DB 가 원천이다 (ADR-0004). 회사 admin 이 할 수 있는 것:
  - 이메일로 멤버 추가 — 그 사람이 한 번 이상 로그인해 users 행이 있어야 한다
    (초대 메일·가입 전 초대는 없음).
  - 멤버 제거 — 본인 제거·마지막 admin 제거는 거부.
  - role 변경.
"""

from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Path
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.context import UserContext
from app.auth.dependencies import require_company_admin
from app.core.db import get_db
from app.core.logging import logger
from app.models.company import Company
from app.models.user import User
from app.models.user_company_membership import UserCompanyMembership
from app.services.audit import write_audit

router = APIRouter(prefix="/companies/{company_id}/members", tags=["company"])

CompanyRole = Literal["admin", "member"]


class MemberItem(BaseModel):
    user_sub: str
    email: str | None
    name: str | None
    role: CompanyRole


class MemberListResponse(BaseModel):
    members: list[MemberItem]


class RolePatch(BaseModel):
    role: CompanyRole


class MemberAdd(BaseModel):
    email: str = Field(..., min_length=3, max_length=320)
    role: CompanyRole = "member"


@router.get(
    "",
    response_model=MemberListResponse,
    summary="회사 멤버 + role 목록 (Company Admin)",
)
async def list_members(
    company_id: str = Path(...),
    _: UserContext = Depends(require_company_admin),
    db: AsyncSession = Depends(get_db),
) -> MemberListResponse:
    if await db.get(Company, company_id) is None:
        raise HTTPException(404, "Company not found")
    stmt = (
        select(UserCompanyMembership, User)
        .join(User, User.id == UserCompanyMembership.user_sub)
        .where(UserCompanyMembership.company_id == company_id)
        .order_by(UserCompanyMembership.role.desc(), User.name)
    )
    rows = (await db.execute(stmt)).all()
    return MemberListResponse(
        members=[
            MemberItem(
                user_sub=m.user_sub,
                email=u.email,
                name=u.name,
                role=m.role,  # type: ignore[arg-type]
            )
            for m, u in rows
        ]
    )


@router.patch(
    "/{user_sub}",
    response_model=MemberItem,
    summary="멤버 role 변경 (Company Admin)",
    responses={404: {"description": "멤버십 없음"}},
)
async def patch_member_role(
    body: RolePatch,
    company_id: str = Path(...),
    user_sub: str = Path(...),
    actor: UserContext = Depends(require_company_admin),
    db: AsyncSession = Depends(get_db),
) -> MemberItem:
    membership = await db.get(UserCompanyMembership, (user_sub, company_id))
    if membership is None:
        raise HTTPException(404, "Membership not found")
    if membership.role == body.role:
        user = await db.get(User, user_sub)
        return MemberItem(
            user_sub=user_sub,
            email=user.email if user else None,
            name=user.name if user else None,
            role=membership.role,  # type: ignore[arg-type]
        )
    prev = membership.role
    membership.role = body.role
    await write_audit(
        db,
        company_id=company_id,
        actor=actor,
        action="update",
        entity_type="company_membership",
        entity_id=user_sub,
        meta={"role_from": prev, "role_to": body.role},
    )
    await db.commit()
    logger.info(
        "company_member_role_changed_by_company_admin",
        extra={
            "category": "authz",
            "company_id": company_id,
            "user_sub": user_sub,
            "role_from": prev,
            "role_to": body.role,
            "actor": actor.sub,
        },
    )
    user = await db.get(User, user_sub)
    return MemberItem(
        user_sub=user_sub,
        email=user.email if user else None,
        name=user.name if user else None,
        role=membership.role,  # type: ignore[arg-type]
    )



@router.post(
    "",
    response_model=MemberItem,
    status_code=201,
    summary="이메일로 멤버 추가 (Company Admin)",
    responses={
        404: {"description": "그 이메일로 로그인한 사용자가 없음"},
        409: {"description": "이미 멤버"},
    },
)
async def add_member(
    body: MemberAdd,
    company_id: str = Path(...),
    actor: UserContext = Depends(require_company_admin),
    db: AsyncSession = Depends(get_db),
) -> MemberItem:
    if await db.get(Company, company_id) is None:
        raise HTTPException(404, "Company not found")
    email = body.email.strip().lower()
    user = (
        await db.execute(
            select(User).where(func.lower(User.email) == email).order_by(User.created_at)
        )
    ).scalars().first()
    if user is None:
        raise HTTPException(
            404, "해당 이메일로 로그인한 사용자가 없습니다. 먼저 한 번 로그인해야 합니다."
        )
    if await db.get(UserCompanyMembership, (user.id, company_id)) is not None:
        raise HTTPException(409, "이미 멤버입니다.")
    db.add(UserCompanyMembership(user_sub=user.id, company_id=company_id, role=body.role))
    await write_audit(
        db,
        company_id=company_id,
        actor=actor,
        action="create",
        entity_type="company_membership",
        entity_id=user.id,
        meta={"role": body.role},
    )
    await db.commit()
    logger.info(
        "company_member_added",
        extra={
            "category": "authz",
            "company_id": company_id,
            "user_sub": user.id,
            "role": body.role,
            "actor": actor.sub,
        },
    )
    return MemberItem(user_sub=user.id, email=user.email, name=user.name, role=body.role)


@router.delete(
    "/{user_sub}",
    status_code=204,
    summary="멤버 제거 (Company Admin)",
    responses={
        404: {"description": "멤버십 없음"},
        409: {"description": "본인 또는 마지막 admin 제거 시도"},
    },
)
async def remove_member(
    company_id: str = Path(...),
    user_sub: str = Path(...),
    actor: UserContext = Depends(require_company_admin),
    db: AsyncSession = Depends(get_db),
) -> None:
    membership = await db.get(UserCompanyMembership, (user_sub, company_id))
    if membership is None:
        raise HTTPException(404, "Membership not found")
    if user_sub == actor.sub:
        raise HTTPException(409, "본인은 제거할 수 없습니다.")
    if membership.role == "admin":
        admins = await db.scalar(
            select(func.count()).where(
                UserCompanyMembership.company_id == company_id,
                UserCompanyMembership.role == "admin",
            )
        )
        if (admins or 0) <= 1:
            raise HTTPException(409, "마지막 admin 은 제거할 수 없습니다.")
    await db.delete(membership)
    await write_audit(
        db,
        company_id=company_id,
        actor=actor,
        action="delete",
        entity_type="company_membership",
        entity_id=user_sub,
        meta={"role": membership.role},
    )
    await db.commit()
    logger.info(
        "company_member_removed",
        extra={
            "category": "authz",
            "company_id": company_id,
            "user_sub": user_sub,
            "actor": actor.sub,
        },
    )
