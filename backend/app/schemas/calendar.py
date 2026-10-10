"""Calendar / Event 스키마."""

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, EmailStr, Field, model_validator

CalendarScope = Literal["personal", "shared"]
CalendarSource = Literal["native", "external_ics"]


class CalendarResponse(BaseModel):
    id: str
    company_id: str
    owner_id: str
    scope: CalendarScope
    source: CalendarSource
    name: str
    description: str | None
    color: str
    # 시스템 관리형(공휴일 등) — 편집·삭제 불가, 숨김만 가능.
    managed: bool = False
    external_ics_url: str | None = None
    external_ics_refresh_at: datetime | None = None
    # 호출자의 개인 토글 — null이면 미설정 (= 기본 가시, 색 그대로)
    hidden: bool = False
    color_override: str | None = None


class CalendarCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    scope: CalendarScope = "personal"
    color: str = "#4f46e5"
    description: str | None = None
    # 외부 ICS 구독 — URL 이 주어지면 source=external_ics 로 즉시 fetch.
    external_ics_url: str | None = None


class CalendarPatch(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    color: str | None = None
    description: str | None = None


class CalendarPreferencePatch(BaseModel):
    hidden: bool | None = None
    color_override: str | None = None


# --- Events ---


class EventResponse(BaseModel):
    id: str
    calendar_id: str
    title: str
    description: str | None
    location: str | None
    start_at: datetime
    end_at: datetime
    all_day: bool
    timezone: str
    rrule: str | None
    recurrence_exceptions: list[str]
    reminder_minutes_before: int | None
    room_id: str | None = None
    created_by_sub: str
    # booking 으로부터 생성된 이벤트면 booking.id (캘린더 UI는 readonly).
    booking_id: str | None = None


class EventOccurrence(BaseModel):
    """Expanded occurrence — 마스터 event 의 한 발생.

    series 식별자는 event_id (불변), occurrence 식별자는 start_at (ISO).
    """

    event_id: str
    calendar_id: str
    title: str
    description: str | None
    location: str | None
    start_at: datetime
    end_at: datetime
    all_day: bool
    timezone: str
    is_recurring: bool
    # booking 으로부터 생성된 이벤트면 booking.id (캘린더 UI는 readonly).
    booking_id: str | None = None


class EventCreate(BaseModel):
    calendar_id: str
    title: str = Field(min_length=1, max_length=512)
    description: str | None = None
    location: str | None = None
    start_at: datetime
    end_at: datetime
    all_day: bool = False
    timezone: str = "UTC"
    rrule: str | None = None
    reminder_minutes_before: int | None = Field(default=None, ge=0, le=10080)
    room_id: str | None = None

    @model_validator(mode="after")
    def _check_range(self) -> "EventCreate":
        if self.end_at < self.start_at:
            raise ValueError("end_at must be >= start_at")
        return self


class EventPatch(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=512)
    description: str | None = None
    location: str | None = None
    start_at: datetime | None = None
    end_at: datetime | None = None
    all_day: bool | None = None
    timezone: str | None = None
    rrule: str | None = None
    reminder_minutes_before: int | None = Field(default=None, ge=0, le=10080)
    # room_id 는 별도 취급 (충돌 체크). None="변경 안 함"과 "방 해제"를 구분하려면
    # 프론트가 명시적으로 보냄 — exclude_unset 로 구분.
    room_id: str | None = None


class CalendarListResponse(BaseModel):
    calendars: list[CalendarResponse]


class OccurrenceListResponse(BaseModel):
    occurrences: list[EventOccurrence]


# --- Invitations ---


InvitationResponse = Literal["pending", "accepted", "declined", "tentative"]


class EventInvitationResponse(BaseModel):
    id: str
    event_id: str
    invitee_sub: str | None = None
    invitee_email: str | None = None
    invitee_name: str | None = None
    # 외부 게스트(계정 없는 이메일 초대) 여부. UI 배지 표시용.
    external: bool = False
    response: InvitationResponse
    responded_at: datetime | None
    created_at: datetime


class EventInvitationCreate(BaseModel):
    # 둘 중 정확히 하나 — 내부 멤버(sub) 또는 외부 게스트(email).
    invitee_sub: str | None = None
    invitee_email: EmailStr | None = None


class EventInvitationPatch(BaseModel):
    response: InvitationResponse


class EventInvitationList(BaseModel):
    invitations: list[EventInvitationResponse]


class AttendeeConflictsRequest(BaseModel):
    start_at: datetime
    end_at: datetime
    attendee_subs: list[str] = Field(max_length=100)
    # 수정 중인 일정 자신은 겹침에서 뺀다
    exclude_event_id: str | None = None


class AttendeeConflict(BaseModel):
    sub: str
    name: str | None = None


class AttendeeConflictsResponse(BaseModel):
    conflicts: list[AttendeeConflict]
