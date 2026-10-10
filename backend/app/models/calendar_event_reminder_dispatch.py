"""CalendarEventReminderDispatch — 알림 발송 멱등성 테이블.

cron 디스패처가 매 분 RRULE 확장 결과를 훑어 (event_id, occurrence_start) 키로
이 테이블에 row insert + Notification insert 를 한 트랜잭션으로 처리. PK 충돌 = 이미 보냄.

단일(비반복) 이벤트면 row 1개, 반복이면 occurrence 마다 row 1개.
"""

from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, PrimaryKeyConstraint, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class CalendarEventReminderDispatch(Base):
    __tablename__ = "calendar_event_reminder_dispatches"

    event_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("calendar_events.id", ondelete="CASCADE"),
        nullable=False,
    )
    occurrence_start: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )
    sent_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    __table_args__ = (
        PrimaryKeyConstraint(
            "event_id", "occurrence_start", name="pk_reminder_dispatch"
        ),
    )
