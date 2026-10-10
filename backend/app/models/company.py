"""Company 캐시 테이블 — JWT groups에서 lazy upsert.

권한 결정은 JWT groups가 함. 이 테이블은 표시·외래키용 캐시. ADR-0004 참조.
"""

from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin


class Company(Base, TimestampMixin):
    __tablename__ = "companies"

    id: Mapped[str] = mapped_column(String(128), primary_key=True)  # JWT groups[i]
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    # 외부 고객 이메일(예약 등)에 표시할 로고 URL. https://… 만 허용.
    # 회사 admin 이 /api/v1/companies/{id}/profile 로 수정.
    logo_url: Mapped[str | None] = mapped_column(String(1024), nullable=True)
