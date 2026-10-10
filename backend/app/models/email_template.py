"""회사별 이메일 템플릿 override — 외부 고객용 3종(booking_*_customer)만 대상.

resolve 순서 (services/email_template.py):
  CompanyEmailTemplate[company_id, event_type] → app/services/email.py 의 _TEMPLATES

내부 알림(event_invited 등)은 운영자만 보므로 커스텀 가치 낮음 → 화이트리스트
외부.
"""

from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class CompanyEmailTemplate(Base):
    __tablename__ = "company_email_templates"

    company_id: Mapped[str] = mapped_column(
        String(128),
        ForeignKey("companies.id", ondelete="CASCADE"),
        primary_key=True,
    )
    event_type: Mapped[str] = mapped_column(String(64), primary_key=True)
    subject: Mapped[str] = mapped_column(String(512), nullable=False)
    body: Mapped[str] = mapped_column(Text, nullable=False)
    # body 가 HTML 인지 — True 면 multipart/alternative 로 발송
    is_html: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default="false"
    )
    # is_html=True 일 때 plain text 대체본. 비어 있으면 body 의 태그를 strip 한 자동 생성.
    text_fallback: Mapped[str | None] = mapped_column(Text, nullable=True)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )
    updated_by_sub: Mapped[str | None] = mapped_column(String(128), nullable=True)
