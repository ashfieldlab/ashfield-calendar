"""GET /api/v1/me: 현재 사용자 정보 반환.

JWT 검증 → 로컬 사용자와 소속 동기화(토큰 `workspaces` 클레임, ADR-0024) 흐름을
한 번에 시연하는 가장 단순한 라우트.
"""

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.context import UserContext
from app.auth.dependencies import get_current_user
from app.core.db import get_db
from app.models.user import User
from app.models.user_workspace_membership import UserWorkspaceMembership
from app.models.workspace import Workspace

router = APIRouter()


@router.get(
    "/me",
    summary="현재 사용자 정보",
    responses={
        401: {"description": "JWT 없음, 만료, 서명, iss, aud 불일치"},
    },
)
async def get_me(
    user: UserContext = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """신원 + 우리 DB 의 소속 워크스페이스, role.

    부수효과: `users` 행 upsert, 토큰 `workspaces` 가 바뀌었으면 워크스페이스와 멤버십 동기화.
    groups: 소속 워크스페이스 ID 목록. workspaces: 같은 목록의 {id, name, account_workspace_id}
    (account_workspace_id = 계정 서버 워크스페이스 ID, 로컬 레거시 워크스페이스는 null).
    workspace_roles: 워크스페이스별 role (ADR-0010, frontend isWorkspaceAdmin 계산용).
    """
    rows = (
        await db.execute(
            select(
                UserWorkspaceMembership.workspace_id,
                UserWorkspaceMembership.role,
                Workspace.name,
                Workspace.account_workspace_id,
            )
            .join(Workspace, Workspace.id == UserWorkspaceMembership.workspace_id)
            .where(UserWorkspaceMembership.user_sub == user.sub)
            .order_by(Workspace.name, Workspace.id)
        )
    ).all()
    workspace_roles: dict[str, str] = {cid: role for cid, role, _, _ in rows}
    me = await db.get(User, user.sub)
    return {
        "sub": user.sub,
        "email": user.email,
        "name": user.name,
        "image": me.image if me else None,
        "groups": user.groups,
        "workspaces": [
            {"id": cid, "name": name, "account_workspace_id": awid}
            for cid, _, name, awid in rows
        ],
        "roles": user.roles,
        "is_system_admin": user.is_system_admin,
        "workspace_roles": workspace_roles,
    }

