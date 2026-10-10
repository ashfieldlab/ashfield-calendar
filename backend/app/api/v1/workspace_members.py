"""/api/v1/workspaces/{id}/members: Workspace Admin 의 멤버 조회 (읽기 전용).

System Admin 도 통과 (require_workspace_admin super-set). 다른 워크스페이스 침범은 path
검증으로 막힘.

멤버 추가, 제거, 역할 변경은 Ashfield 계정 서버에서 한다 (ADR-0024): 앱의 멤버십은
토큰 `workspaces` 클레임으로 동기화되는 캐시다. 응답의 account_workspace_id 로
프론트가 계정 서버 워크스페이스 화면(`${ACCOUNT_URL}/workspaces/{id}`) 링크를 만든다.
목록은 이 앱에 한 번 이상 접속한 멤버만 담는다.
"""

from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Path
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.context import UserContext
from app.auth.dependencies import require_workspace_admin
from app.core.db import get_db
from app.models.user import User
from app.models.user_workspace_membership import UserWorkspaceMembership
from app.models.workspace import Workspace

router = APIRouter(prefix="/workspaces/{workspace_id}/members", tags=["workspace"])

WorkspaceRole = Literal["admin", "member"]


class MemberItem(BaseModel):
    user_sub: str
    email: str | None
    name: str | None
    role: WorkspaceRole


class MemberListResponse(BaseModel):
    # 계정 서버 워크스페이스 ID. NULL = 로컬(레거시) 워크스페이스: 계정 서버에서 관리할 수 없음.
    account_workspace_id: str | None = None
    members: list[MemberItem]


@router.get(
    "",
    response_model=MemberListResponse,
    summary="워크스페이스 멤버 + role 목록 (Workspace Admin)",
)
async def list_members(
    workspace_id: str = Path(...),
    _: UserContext = Depends(require_workspace_admin),
    db: AsyncSession = Depends(get_db),
) -> MemberListResponse:
    workspace = await db.get(Workspace, workspace_id)
    if workspace is None:
        raise HTTPException(404, "Workspace not found")
    stmt = (
        select(UserWorkspaceMembership, User)
        .join(User, User.id == UserWorkspaceMembership.user_sub)
        .where(UserWorkspaceMembership.workspace_id == workspace_id)
        .order_by(UserWorkspaceMembership.role.desc(), User.name)
    )
    rows = (await db.execute(stmt)).all()
    return MemberListResponse(
        account_workspace_id=workspace.account_workspace_id,
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
