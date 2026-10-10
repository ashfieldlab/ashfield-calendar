from datetime import datetime

from pydantic import BaseModel


class NotificationEventContext(BaseModel):
    """알림 대상 일정의 지금 상태 (상세 패널의 일정 카드용). 삭제됐으면 deleted=True."""

    id: str
    title: str
    start_at: datetime
    end_at: datetime
    all_day: bool
    location: str | None
    calendar_id: str
    calendar_name: str | None
    calendar_color: str | None
    deleted: bool


class NotificationInvitationContext(BaseModel):
    """초대 알림: 받는 사람 본인의 초대 (바로 응답용)."""

    id: str
    event_id: str
    response: str


class NotificationBookingContext(BaseModel):
    id: str
    booking_type_id: str
    status: str
    slot_start_at: datetime
    slot_end_at: datetime
    customer_name: str | None
    customer_email: str | None
    calendar_event_id: str | None


class NotificationResponse(BaseModel):
    id: str
    type: str
    actor_sub: str | None
    actor_name: str | None  # users 캐시 표시명 (UI 친화)
    entity_type: str
    entity_id: str
    payload: dict
    read_at: datetime | None
    created_at: datetime
    event: NotificationEventContext | None = None
    invitation: NotificationInvitationContext | None = None
    booking: NotificationBookingContext | None = None


class NotificationListResponse(BaseModel):
    notifications: list[NotificationResponse]
    unread_count: int
    has_more: bool = False  # offset+limit 다음 페이지 존재 여부


class NotificationPatch(BaseModel):
    read: bool


class MarkAllReadResponse(BaseModel):
    marked: int


class EmailPreferenceResponse(BaseModel):
    email_enabled: bool  # 마스터: off 면 카테고리 무관 전체 off
    # 카테고리별 이메일 on/off. 키 없으면 on(기본). 카테고리: event|booking
    email_categories: dict[str, bool] = {}


class EmailPreferencePatch(BaseModel):
    email_enabled: bool | None = None
    email_categories: dict[str, bool] | None = None
