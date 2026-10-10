"""/api/v1/workspaces/{id}/profile: 워크스페이스 표시 정보 (Workspace Admin).

현재는 외부 고객 이메일에 노출되는 로고 URL 만: 이후 brand color 등 확장 가능.
워크스페이스 이름(name) 수정은 이 라우트 범위 밖 (ADR-0004).
"""

from fastapi import APIRouter, Depends, Path
from pydantic import BaseModel, Field, field_validator
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.context import UserContext
from app.auth.dependencies import require_workspace_admin
from app.core.db import get_db
from app.core.errors import BusinessError
from app.core.logging import logger
from app.models.workspace import Workspace

router = APIRouter(
    prefix="/workspaces/{workspace_id}/profile", tags=["workspace"]
)


class WorkspaceProfileResponse(BaseModel):
    workspace_id: str
    name: str
    logo_url: str | None


class WorkspaceProfilePatch(BaseModel):
    logo_url: str | None = Field(default=None, max_length=1024)

    @field_validator("logo_url")
    @classmethod
    def _validate_url(cls, v: str | None) -> str | None:
        if v is None or v == "":
            return None
        v = v.strip()
        if not (v.startswith("https://") or v.startswith("http://")):
            raise ValueError("URL 은 http(s):// 로 시작해야 합니다.")
        return v


@router.get(
    "",
    response_model=WorkspaceProfileResponse,
    summary="워크스페이스 표시 정보 조회 (Workspace Admin)",
)
async def get_profile(
    workspace_id: str = Path(...),
    _: UserContext = Depends(require_workspace_admin),
    db: AsyncSession = Depends(get_db),
) -> WorkspaceProfileResponse:
    c = await db.get(Workspace, workspace_id)
    if c is None:
        raise BusinessError("WORKSPACE_NOT_FOUND", status=404, message="워크스페이스 없음")
    return WorkspaceProfileResponse(
        workspace_id=c.id, name=c.name, logo_url=c.logo_url
    )


@router.put(
    "",
    response_model=WorkspaceProfileResponse,
    summary="워크스페이스 표시 정보 수정 (Workspace Admin)",
)
async def put_profile(
    body: WorkspaceProfilePatch,
    workspace_id: str = Path(...),
    actor: UserContext = Depends(require_workspace_admin),
    db: AsyncSession = Depends(get_db),
) -> WorkspaceProfileResponse:
    c = await db.get(Workspace, workspace_id)
    if c is None:
        raise BusinessError("WORKSPACE_NOT_FOUND", status=404, message="워크스페이스 없음")
    c.logo_url = body.logo_url
    await db.commit()
    logger.info(
        "workspace_profile_updated",
        extra={
            "category": "biz",
            "workspace_id": workspace_id,
            "actor": actor.sub,
            "logo_url_set": c.logo_url is not None,
        },
    )
    return WorkspaceProfileResponse(
        workspace_id=c.id, name=c.name, logo_url=c.logo_url
    )
