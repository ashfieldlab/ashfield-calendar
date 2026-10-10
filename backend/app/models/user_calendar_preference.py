"""UserCalendarPreference: 캘린더별 개인 토글 (hidden, color override).

자동 가시 (ADR-0007): 워크스페이스 shared 캘린더는 별도 구독 없이 모두 보임. 사용자가 안 보고 싶으면 hidden=true.
"""

from sqlalchemy import Boolean, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class UserCalendarPreference(Base):
    __tablename__ = "user_calendar_preferences"

    user_sub: Mapped[str] = mapped_column(
        String(64), ForeignKey("users.id"), primary_key=True
    )
    calendar_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("calendars.id", ondelete="CASCADE"),
        primary_key=True,
    )
    hidden: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    color_override: Mapped[str | None] = mapped_column(String(16), nullable=True)
