"""CalendarEvent: 일정 (반복 포함).

반복: rrule (RFC 5545 텍스트). recurrence_exceptions = 이 occurrence 만 제외할 ISO datetime 목록.
단일 occurrence 삭제는 series 를 지우지 않고 exception 추가로 처리.
"""

from datetime import datetime

from sqlalchemy import (
    Boolean,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin


class CalendarEvent(Base, TimestampMixin):
    __tablename__ = "calendar_events"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    calendar_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("calendars.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    title: Mapped[str] = mapped_column(String(512), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    location: Mapped[str | None] = mapped_column(String(512), nullable=True)
    # 회의실(Room) 참조: 선택 (ADR-0019). 방 삭제 시 이벤트 보존 위해 SET NULL.
    room_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("rooms.id", ondelete="SET NULL"), nullable=True, index=True
    )

    start_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, index=True
    )
    end_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    all_day: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    timezone: Mapped[str] = mapped_column(String(64), nullable=False, default="UTC")

    rrule: Mapped[str | None] = mapped_column(Text, nullable=True)
    recurrence_exceptions: Mapped[list[str]] = mapped_column(
        JSONB, nullable=False, default=list
    )

    # 알림: 시작 N분 전 in-app 알림 발송. NULL = 알림 꺼짐.
    # 발송 멱등성은 calendar_event_reminder_dispatches 테이블이 보장 (occurrence 별 PK).
    reminder_minutes_before: Mapped[int | None] = mapped_column(
        Integer, nullable=True
    )

    created_by_sub: Mapped[str] = mapped_column(
        String(64), ForeignKey("users.id"), nullable=False
    )
    deleted_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    # CalDAV 통합 (ADR-0014). Sabre 가 URL 슬러그로 사용. 우리 UI 생성 시엔 id 와 동일하게 set.
    dav_uri: Mapped[str | None] = mapped_column(String(255), nullable=True)
    # 외부 CalDAV 클라이언트가 보낸 raw ICS: round-trip 손실 방지. 우리 UI 생성 시 NULL,
    # Sabre 가 변경 시 자기 직렬화 결과로 덮어씀.
    raw_ics: Mapped[str | None] = mapped_column(Text, nullable=True)

    __table_args__ = (
        Index("ix_events_calendar_start", "calendar_id", "start_at"),
        Index("ix_events_calendar_dav_uri", "calendar_id", "dav_uri"),
    )
