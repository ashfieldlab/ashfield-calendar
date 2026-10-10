"""Audit log helper: 변경 일으키는 라우터가 호출.

write_audit() 는 row 만 add, commit 은 호출자가 함께 (트랜잭션 일체화).
"""

from __future__ import annotations

import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.context import UserContext
from app.models.audit_log import AuditLog


async def write_audit(
    db: AsyncSession,
    *,
    company_id: str | None,
    actor: UserContext | None,
    action: str,
    entity_type: str,
    entity_id: str,
    meta: dict | None = None,
    request_id: str | None = None,
    actor_type: str | None = None,
) -> None:
    """actor_type 기본:
      - actor 가 있으면 'user'
      - actor=None 이면 'system'
      - 명시값(예: 'public' for 공개 라우트) 이 있으면 override.
    """
    audit_meta = dict(meta or {})
    db.add(
        AuditLog(
            id=str(uuid.uuid7()),
            company_id=company_id,
            actor_sub=actor.sub if actor else None,
            actor_type=actor_type or ("user" if actor else "system"),
            action=action,
            entity_type=entity_type,
            entity_id=entity_id,
            meta=audit_meta,
            request_id=request_id,
        )
    )

