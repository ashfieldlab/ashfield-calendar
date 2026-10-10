"""CalDAV App Token (ADR-0014) — long-lived bcrypt 해시 토큰.

외부 캘린더 클라이언트가 HTTP Basic 으로 보낼 username:password 의 password 자리.
웹 로그인 JWT(Better Auth)와 별도 (외부 클라 OAuth 못 보냄, JWT exp 짧음).

발급:
  - 사용자가 우리 앱에서 발급 → 평문은 응답 1회만 노출 → bcrypt hash 만 DB 저장
  - (user_sub, company_id) 쌍에 묶임 — 회사 격리

검증 (Sabre PHP 가 직접 PostgreSQL 조회):
  - WHERE user_sub = ? AND revoked_at IS NULL → bcrypt 비교 → last_used_at 갱신
"""

from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Index, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class CalDavToken(Base):
    __tablename__ = "caldav_tokens"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    user_sub: Mapped[str] = mapped_column(
        String(64), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    company_id: Mapped[str] = mapped_column(
        String(128), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False
    )
    secret_hash: Mapped[str] = mapped_column(String(256), nullable=False)
    name: Mapped[str] = mapped_column(String(128), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    last_used_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    revoked_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    __table_args__ = (
        Index("ix_caldav_tokens_user_active", "user_sub", "revoked_at"),
    )
