"""BookingType: 외부 고객 예약 양식 (ADR-0012).

운영자가 정의: 공개 URL, 가용 시간, duration, capacity, 충돌 체크 캘린더,
booking 알림 받을 사람. 공개 페이지(`/book/{public_key}`) 에서 슬롯 계산 후
고객이 선택 → Booking 생성.

owner_type:
  'user'   : 개인 양식. owner_user_sub 가짐. 권한: 본인만.
  'workspace': 워크스페이스 양식. owner_workspace_id 가짐. 권한: 그 워크스페이스 admin.

CHECK 제약: 정확히 owner_user_sub XOR owner_workspace_id.
"""

from datetime import date, datetime
from typing import Literal

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin

BookingTypeOwner = Literal["user", "workspace"]


class BookingType(Base, TimestampMixin):
    __tablename__ = "booking_types"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)

    # 소유권
    owner_type: Mapped[BookingTypeOwner] = mapped_column(String(16), nullable=False)
    owner_user_sub: Mapped[str | None] = mapped_column(
        String(64), ForeignKey("users.id"), nullable=True
    )
    owner_workspace_id: Mapped[str | None] = mapped_column(
        String(128), ForeignKey("workspaces.id"), nullable=True
    )

    # 공개 URL: secrets.token_urlsafe(8) ~ 11 chars, 유추 불가
    public_key: Mapped[str] = mapped_column(
        String(32), nullable=False, unique=True, index=True
    )

    # 표시
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    privacy_policy_url: Mapped[str | None] = mapped_column(String(512), nullable=True)

    # 시간 정의
    duration_minutes: Mapped[int] = mapped_column(Integer, nullable=False)
    timezone: Mapped[str] = mapped_column(String(64), nullable=False, default="Asia/Seoul")
    # {"mon": [["09:00","12:00"], ["13:00","18:00"]], "tue": [...]}
    weekly_schedule: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    available_from: Mapped[date | None] = mapped_column(Date, nullable=True)
    available_to: Mapped[date | None] = mapped_column(Date, nullable=True)
    minimum_notice_minutes: Mapped[int] = mapped_column(
        Integer, nullable=False, default=24 * 60
    )
    # 공개 페이지가 보여줄 미래 기간. 기본 30일, 최대 90일.
    lookahead_days: Mapped[int] = mapped_column(
        Integer, nullable=False, server_default="30"
    )

    # 캘린더: 예약은 target_calendar 에 INSERT, blocking_calendar 들은 충돌 체크용
    target_calendar_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("calendars.id"), nullable=False
    )
    blocking_calendar_ids: Mapped[list[str]] = mapped_column(
        JSONB, nullable=False, default=list
    )

    # 정원
    capacity: Mapped[int] = mapped_column(Integer, nullable=False, default=1)

    # 알림: booking 들어오면 in-app + 이메일 보낼 사용자들
    notify_user_subs: Mapped[list[str]] = mapped_column(
        JSONB, nullable=False, default=list
    )

    # 활성 / 삭제
    enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    deleted_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    __table_args__ = (
        # 정확히 둘 중 하나만 NULL 아님
        CheckConstraint(
            "(owner_user_sub IS NOT NULL AND owner_workspace_id IS NULL) OR "
            "(owner_user_sub IS NULL AND owner_workspace_id IS NOT NULL)",
            name="ck_booking_type_owner_exclusive",
        ),
        CheckConstraint(
            "capacity >= 1", name="ck_booking_type_capacity_positive"
        ),
        CheckConstraint(
            "duration_minutes >= 5", name="ck_booking_type_duration_min"
        ),
        CheckConstraint(
            "lookahead_days BETWEEN 1 AND 90",
            name="ck_booking_type_lookahead_range",
        ),
    )

