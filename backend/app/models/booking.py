"""Booking — 외부 고객이 제출한 예약 인스턴스 (ADR-0012).

각 Booking 은 1:1 로 CalendarEvent 와 연결 (calendar_event_id). 운영자는 평소
캘린더 뷰에서 그대로 본다. 취소 시 둘 다 정리.

slot_start_at / slot_end_at 은 calendar_event 의 start_at/end_at 과 동일하지만
race-safe 충돌 검사를 위해 denormalize (CalendarEvent insert 전에 slot 검증).

PII 컬럼 (customer_name/email/message/cancel_token/ip/ua) 은 slot_end + 30일 후
purge_booking_pii cron 이 NULL 마스킹. row 자체는 통계용 보존.
"""

from datetime import datetime
from typing import Literal

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin

BookingStatus = Literal["active", "cancelled"]
CancelledBy = Literal["customer", "operator"]


class Booking(Base, TimestampMixin):
    __tablename__ = "bookings"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)

    booking_type_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("booking_types.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # denormalized for slot conflict check 전에 verify
    slot_start_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, index=True
    )
    slot_end_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )

    # 1:1 with CalendarEvent. 취소 시 CalendarEvent 도 soft delete 하지만 FK 는 유지.
    calendar_event_id: Mapped[str | None] = mapped_column(
        String(36),
        ForeignKey("calendar_events.id"),
        nullable=True,
        unique=True,
    )

    # PII — 30일 후 마스킹 대상
    customer_name: Mapped[str | None] = mapped_column(String(128), nullable=True)
    customer_email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    customer_message: Mapped[str | None] = mapped_column(Text, nullable=True)

    # 동의 시각 — PIPA 제15조 동의 기록
    agreed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )

    # 취소 토큰 — secrets.token_urlsafe(16) ~ 22 chars. 취소 후 NULL.
    cancel_token: Mapped[str | None] = mapped_column(
        String(64), nullable=True, unique=True, index=True
    )

    status: Mapped[BookingStatus] = mapped_column(
        String(16), nullable=False, default="active"
    )
    cancelled_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    cancelled_by: Mapped[CancelledBy | None] = mapped_column(
        String(16), nullable=True
    )

    # 감사 — 마스킹 대상
    ip_address: Mapped[str | None] = mapped_column(String(64), nullable=True)
    user_agent: Mapped[str | None] = mapped_column(String(255), nullable=True)

    __table_args__ = (
        CheckConstraint(
            "slot_end_at > slot_start_at",
            name="ck_booking_slot_range",
        ),
    )
