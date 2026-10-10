"""Calendar: 회사 단위 일정 컨테이너 (ADR-0007).

scope=personal: 본인만 접근, 자동 가시 (본인이 만들면 본인에게 자동 보임).
scope=shared: 같은 company 멤버 모두 자동 가시: URL 별 ICS 구독 모델 대체.
source=native: 사용자가 작성. source=external_ics: Phase 2 (read-only 외부 동기화).
"""

from datetime import datetime
from typing import Literal

from sqlalchemy import Boolean, DateTime, ForeignKey, Index, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin

CalendarScope = Literal["personal", "shared"]
CalendarSource = Literal["native", "external_ics"]


class Calendar(Base, TimestampMixin):
    __tablename__ = "calendars"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    company_id: Mapped[str] = mapped_column(
        String(128), ForeignKey("companies.id"), nullable=False, index=True
    )
    owner_id: Mapped[str] = mapped_column(
        String(64), ForeignKey("users.id"), nullable=False, index=True
    )
    scope: Mapped[CalendarScope] = mapped_column(String(16), nullable=False)
    source: Mapped[CalendarSource] = mapped_column(
        String(16), nullable=False, default="native"
    )

    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(String(1024), nullable=True)
    color: Mapped[str] = mapped_column(String(16), nullable=False, default="#4f46e5")

    # 시스템 관리형 캘린더(공휴일 등). 자동 시드되며 사용자가 편집·삭제 불가(숨김만 가능).
    managed: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default="false"
    )

    # Phase 2 external_ics 전용
    external_ics_url: Mapped[str | None] = mapped_column(String(2048), nullable=True)
    external_ics_refresh_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    deleted_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    # ICS subscription (ADR-0013): opt-in. 활성 시 토큰 발급, 비활성 시 토큰 null + endpoint 404.
    # booking-linked event 는 응답 시 강제 마스킹 (PIPA).
    subscription_enabled: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default="false"
    )
    subscription_token: Mapped[str | None] = mapped_column(
        String(64), nullable=True, unique=True
    )

    # CalDAV sync (ADR-0014): RFC 6578 collection-sync REPORT 의 sync-token 값.
    # 캘린더 내 객체 변경 시 1 씩 증가. 클라이언트는 이 값 기준으로 변경분만 동기화.
    sync_token: Mapped[int] = mapped_column(
        Integer, nullable=False, server_default="1"
    )

    __table_args__ = (
        Index("ix_calendars_company_scope", "company_id", "scope"),
        Index("ix_calendars_subscription_token", "subscription_token"),
    )
