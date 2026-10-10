"""CalDAV sync REPORT 변경 추적 (ADR-0014, RFC 6578).

캘린더 내 CalendarEvent 의 add/modify/delete 마다 row 1개. 클라이언트가 본인이
가진 sync_token 이후의 변경분만 받아 효율적 sync.

Sabre 가 이 테이블을 INSERT — FastAPI 측 mutation 도 같이 기록해야 양방향 정합.
TRIGGER 로 자동화 가능.
"""

from datetime import datetime

from sqlalchemy import (
    DateTime,
    ForeignKey,
    Index,
    Integer,
    SmallInteger,
    String,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class CalendarObjectChange(Base):
    __tablename__ = "calendar_object_changes"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    calendar_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("calendars.id", ondelete="CASCADE"),
        nullable=False,
    )
    # 변경된 이벤트의 dav_uri (CalendarEvent.dav_uri 또는 id+'.ics')
    object_uri: Mapped[str] = mapped_column(String(255), nullable=False)
    # 1=add, 2=modify, 3=delete (RFC 6578 호환)
    operation: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    # 변경 시점 캘린더의 sync_token (= 그 이후 모든 클라가 받아야 함)
    sync_token: Mapped[int] = mapped_column(Integer, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    __table_args__ = (
        Index("ix_calendar_changes_cal_token", "calendar_id", "sync_token"),
    )
