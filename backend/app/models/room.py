"""Room: 회사 회의실 등 예약 가능한 물리 자원 (ADR-0019).

Event 가 room_id 로 참조만 한다(캘린더에 묶이지 않음). 같은 Room 을 시간 겹치게
예약하면 저장 차단(이중예약 불가): 충돌 체크는 services/rooms.py.
"""

from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class Room(Base):
    __tablename__ = "rooms"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    company_id: Mapped[str] = mapped_column(
        String(128),
        ForeignKey("companies.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    # 선택: 정원("6인실"). 표시용.
    capacity: Mapped[int | None] = mapped_column(Integer, nullable=True)
    created_by_sub: Mapped[str] = mapped_column(
        String(64), ForeignKey("users.id"), nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
