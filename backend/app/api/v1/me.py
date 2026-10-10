"""GET /api/v1/me: 현재 사용자 정보 반환.

JWT 검증 → 로컬 사용자·소속 동기화(토큰 `workspaces` 클레임, ADR-0024) 흐름을
한 번에 시연하는 가장 단순한 라우트.
"""

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.context import UserContext
from app.auth.dependencies import get_current_user
from app.core.db import get_db
from app.models.company import Company
from app.models.user import User
from app.models.user_company_membership import UserCompanyMembership

router = APIRouter()


@router.get(
    "/me",
    summary="현재 사용자 정보",
    responses={
        401: {"description": "JWT 없음·만료·서명·iss·aud 불일치"},
    },
)
async def get_me(
    user: UserContext = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """신원 + 우리 DB 의 소속 회사·role.

    부수효과: `users` 행 upsert, 토큰 `workspaces` 가 바뀌었으면 회사·멤버십 동기화.
    groups: 소속 회사 ID 목록. companies: 같은 목록의 {id, name, account_workspace_id}
    (account_workspace_id = 계정 서버 워크스페이스 ID, 로컬 레거시 회사는 null).
    company_roles: 회사별 role (ADR-0010, frontend isCompanyAdmin 계산용).
    """
    rows = (
        await db.execute(
            select(
                UserCompanyMembership.company_id,
                UserCompanyMembership.role,
                Company.name,
                Company.account_workspace_id,
            )
            .join(Company, Company.id == UserCompanyMembership.company_id)
            .where(UserCompanyMembership.user_sub == user.sub)
            .order_by(Company.name, Company.id)
        )
    ).all()
    company_roles: dict[str, str] = {cid: role for cid, role, _, _ in rows}
    me = await db.get(User, user.sub)
    return {
        "sub": user.sub,
        "email": user.email,
        "name": user.name,
        "image": me.image if me else None,
        "groups": user.groups,
        "companies": [
            {"id": cid, "name": name, "account_workspace_id": awid}
            for cid, _, name, awid in rows
        ],
        "roles": user.roles,
        "is_system_admin": user.is_system_admin,
        "company_roles": company_roles,
    }

