"""CalendarEventInvitation: 일정 초대 + 응답.

response: pending|accepted|declined|tentative.
초대받은 사용자는 자신이 접근할 수 없는 캘린더의 일정도 볼 수 있게 됨 (list_occurrences 확장).

초대 대상 2종:
  - 내부 멤버: invitee_sub(users FK) 세팅. in-app 알림 + 이메일.
  - 외부 게스트: invitee_email + rsvp_token 세팅(invitee_sub NULL). 계정 없이
    이메일 링크(/rsvp/{token})로 수락/거절. ADR-0011 공개 라우트 패턴.
"""

from datetime import datetime
from typing import Literal

from sqlalchemy import DateTime, ForeignKey, String, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base

InvitationResponse = Literal["pending", "accepted", "declined", "tentative"]


class CalendarEventInvitation(Base):
    __tablename__ = "calendar_event_invitations"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    event_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("calendar_events.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    # 내부 멤버면 세팅, 외부 게스트면 NULL.
    invitee_sub: Mapped[str | None] = mapped_column(
        String(64), ForeignKey("users.id"), nullable=True, index=True
    )
    # 외부 게스트용: 계정 없는 이메일 초대.
    invitee_email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    invitee_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    # 외부 게스트 RSVP 토큰 (secrets.token_urlsafe). 내부 초대는 NULL.
    rsvp_token: Mapped[str | None] = mapped_column(
        String(64), nullable=True, unique=True, index=True
    )
    response: Mapped[InvitationResponse] = mapped_column(
        String(16), nullable=False, default="pending"
    )
    responded_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    __table_args__ = (
        # 내부 멤버 중복 방지 (외부는 invitee_sub NULL 이라 이 제약 미적용: 코드로 체크).
        UniqueConstraint(
            "event_id", "invitee_sub", name="uq_event_invitations_event_invitee"
        ),
    )
