"""GET /api/v1/me — 현재 사용자 정보 반환.

JWT 검증·revocation·lazy upsert 흐름을 한 번에 시연하는 가장 단순한 라우트.
"""

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.context import UserContext
from app.auth.dependencies import get_current_user
from app.core.db import get_db
from app.models.user_company_membership import UserCompanyMembership

router = APIRouter()


@router.get(
    "/me",
    summary="현재 사용자 정보",
    responses={
        401: {"description": "JWT 없음·만료·서명 불일치 또는 revoked sid"},
    },
)
async def get_me(
    user: UserContext = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """JWT claims + 우리 DB 의 회사 role.

    부수효과: `users` 캐시·회사 멤버십 lazy upsert (5분 throttle).
    company_roles: 사용자가 admin 인 회사 목록 매핑 (ADR-0010, frontend isCompanyAdmin 계산용).
    """
    rows = (
        await db.execute(
            select(
                UserCompanyMembership.company_id, UserCompanyMembership.role
            ).where(UserCompanyMembership.user_sub == user.sub)
        )
    ).all()
    company_roles: dict[str, str] = {cid: role for cid, role in rows}
    return {
        "sub": user.sub,
        "email": user.email,
        "name": user.name,
        "groups": user.groups,
        "roles": user.roles,
        "is_system_admin": user.is_system_admin,
        "company_roles": company_roles,
    }

