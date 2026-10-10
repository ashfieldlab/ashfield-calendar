"""/api/v1/me/caldav-tokens: CalDAV App Token CRUD (ADR-0014).

사용자가 본인 캘린더를 외부 캘린더 앱 (Apple Calendar/Thunderbird/DAVx5 등)
과 sync 하기 위해 발급. (user_sub, active_workspace_id) 한 쌍에 묶임.

발급 시 secret 평문은 응답 1회만 노출. DB 에는 bcrypt hash. 분실 시 revoke + 재발급.
"""

from __future__ import annotations

import secrets
import uuid
from datetime import UTC, datetime

import bcrypt
from fastapi import APIRouter, Depends, Path
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.context import UserContext
from app.auth.dependencies import get_current_user, require_active_workspace
from app.core.db import get_db
from app.core.errors import BusinessError
from app.core.logging import logger
from app.models.caldav_token import CalDavToken
from app.services.audit import write_audit

router = APIRouter(prefix="/me/caldav-tokens", tags=["caldav"])


class CalDavTokenItem(BaseModel):
    id: str
    name: str
    workspace_id: str
    created_at: datetime
    last_used_at: datetime | None
    # secret 평문은 발급 시점에만, 목록에선 never


class CalDavTokenList(BaseModel):
    items: list[CalDavTokenItem]


class CalDavTokenCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=128)


class CalDavTokenCreated(BaseModel):
    id: str
    name: str
    workspace_id: str
    username: str  # = user_sub. 사용자 친화적으로 별도 키 노출
    secret: str  # 평문: 이 응답에만 한 번
    server_url: str  # 사용자 안내용 (URL 고정)


def _generate_secret() -> str:
    """cdv_ prefix + url-safe 32 bytes (≈43자) → 헤매지 않게 식별 가능."""
    return "cdv_" + secrets.token_urlsafe(32)


def _hash_secret(secret: str) -> str:
    """bcrypt: PHP password_verify 와 호환되는 $2b$ 포맷."""
    return bcrypt.hashpw(secret.encode(), bcrypt.gensalt()).decode()


def _server_url() -> str:
    from app.core.config import settings

    return f"{settings.calendar_base_url.rstrip('/')}/caldav/"


@router.get(
    "",
    response_model=CalDavTokenList,
    summary="CalDAV 토큰 목록 (활성 워크스페이스 범위)",
)
async def list_tokens(
    user: UserContext = Depends(get_current_user),
    workspace_id: str = Depends(require_active_workspace),
    db: AsyncSession = Depends(get_db),
) -> CalDavTokenList:
    stmt = (
        select(CalDavToken)
        .where(
            CalDavToken.user_sub == user.sub,
            CalDavToken.workspace_id == workspace_id,
            CalDavToken.revoked_at.is_(None),
        )
        .order_by(CalDavToken.created_at.desc())
    )
    rows = list((await db.execute(stmt)).scalars().all())
    return CalDavTokenList(
        items=[
            CalDavTokenItem(
                id=r.id,
                name=r.name,
                workspace_id=r.workspace_id,
                created_at=r.created_at,
                last_used_at=r.last_used_at,
            )
            for r in rows
        ]
    )


@router.post(
    "",
    response_model=CalDavTokenCreated,
    status_code=201,
    summary="CalDAV 토큰 발급: secret 평문은 응답에만",
)
async def create_token(
    body: CalDavTokenCreate,
    user: UserContext = Depends(get_current_user),
    workspace_id: str = Depends(require_active_workspace),
    db: AsyncSession = Depends(get_db),
) -> CalDavTokenCreated:
    secret = _generate_secret()
    row = CalDavToken(
        id=str(uuid.uuid4()),
        user_sub=user.sub,
        workspace_id=workspace_id,
        secret_hash=_hash_secret(secret),
        name=body.name.strip(),
    )
    db.add(row)
    await write_audit(
        db,
        workspace_id=workspace_id,
        actor=user,
        action="caldav_token_create",
        entity_type="caldav_token",
        entity_id=row.id,
        meta={"name": row.name},
    )
    await db.commit()
    logger.info(
        "caldav_token_created",
        extra={
            "category": "biz",
            "user": user.sub,
            "workspace_id": workspace_id,
            "token_id": row.id,
        },
    )
    return CalDavTokenCreated(
        id=row.id,
        name=row.name,
        workspace_id=workspace_id,
        username=user.sub,
        secret=secret,
        server_url=_server_url(),
    )


@router.delete(
    "/{token_id}",
    status_code=204,
    summary="CalDAV 토큰 폐기: 즉시 무효",
)
async def revoke_token(
    token_id: str = Path(...),
    user: UserContext = Depends(get_current_user),
    workspace_id: str = Depends(require_active_workspace),
    db: AsyncSession = Depends(get_db),
) -> None:
    row = await db.get(CalDavToken, token_id)
    if (
        row is None
        or row.user_sub != user.sub
        or row.workspace_id != workspace_id
        or row.revoked_at is not None
    ):
        # 본인 소유가 아니거나 이미 폐기 → 404 처럼 처리 (정보 누설 방지)
        raise BusinessError("NOT_FOUND", status=404, message="토큰 없음")
    row.revoked_at = datetime.now(UTC)
    await write_audit(
        db,
        workspace_id=workspace_id,
        actor=user,
        action="caldav_token_revoke",
        entity_type="caldav_token",
        entity_id=row.id,
        meta={"name": row.name},
    )
    await db.commit()
    logger.info(
        "caldav_token_revoked",
        extra={
            "category": "biz",
            "user": user.sub,
            "token_id": row.id,
        },
    )
