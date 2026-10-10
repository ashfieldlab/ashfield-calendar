"""BookingType API 스키마.

weekly_schedule 형태: {"mon": [["09:00","18:00"]], "tue": [...], ...}
각 시간 블록은 "HH:MM" 두 개. 빈 요일은 키 자체 생략 또는 빈 리스트.
"""

from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, Field, field_validator, model_validator

BookingTypeOwner = Literal["user", "workspace"]
_DAYS = {"mon", "tue", "wed", "thu", "fri", "sat", "sun"}


def _validate_weekly_schedule(v: dict) -> dict:
    for day, blocks in v.items():
        if day not in _DAYS:
            raise ValueError(f"unknown day key: {day}")
        if not isinstance(blocks, list):
            raise ValueError(f"{day} blocks must be a list")
        for b in blocks:
            if not (isinstance(b, list) and len(b) == 2):
                raise ValueError(f"{day} block must be [start, end]")
            for t in b:
                if not (isinstance(t, str) and len(t) == 5 and t[2] == ":"):
                    raise ValueError(f"{day} time must be HH:MM string")
    return v


class BookingTypeResponse(BaseModel):
    id: str
    owner_type: BookingTypeOwner
    owner_user_sub: str | None
    owner_workspace_id: str | None
    public_key: str
    title: str
    description: str | None
    privacy_policy_url: str | None
    duration_minutes: int
    timezone: str
    weekly_schedule: dict
    available_from: date | None
    available_to: date | None
    minimum_notice_minutes: int
    lookahead_days: int
    target_calendar_id: str
    blocking_calendar_ids: list[str]
    capacity: int
    notify_user_subs: list[str]
    enabled: bool


class BookingTypeListItem(BookingTypeResponse):
    """목록 전용: 예약 통계 계산 필드 (컬럼 아님)."""

    upcoming_count: int = 0
    next_booking_at: datetime | None = None
    last_30d_count: int = 0


class BookingTypeListResponse(BaseModel):
    items: list[BookingTypeListItem]


class OperatorSlotItem(BaseModel):
    """운영자 슬롯: 마감(정원 참, 다른 일정과 겹침, 최소 예약 시점 이전) 포함."""

    start_at: datetime
    end_at: datetime
    remaining: int
    open: bool


class OperatorSlotListResponse(BaseModel):
    slots: list[OperatorSlotItem]


class BookingTypeCreate(BaseModel):
    owner_type: BookingTypeOwner
    # owner_type=user → 현재 사용자 사용. owner_type=workspace → 활성 워크스페이스 사용.
    title: str = Field(min_length=1, max_length=255)
    description: str | None = None
    privacy_policy_url: str | None = Field(default=None, max_length=512)
    duration_minutes: int = Field(ge=5, le=24 * 60)
    timezone: str = "Asia/Seoul"
    weekly_schedule: dict = Field(default_factory=dict)
    available_from: date | None = None
    available_to: date | None = None
    minimum_notice_minutes: int = Field(default=24 * 60, ge=0, le=365 * 24 * 60)
    lookahead_days: int = Field(default=30, ge=1, le=90)
    target_calendar_id: str
    blocking_calendar_ids: list[str] = Field(default_factory=list)
    capacity: int = Field(default=1, ge=1, le=1000)
    notify_user_subs: list[str] = Field(default_factory=list)

    @field_validator("weekly_schedule")
    @classmethod
    def _check_weekly(cls, v: dict) -> dict:
        return _validate_weekly_schedule(v)

    @model_validator(mode="after")
    def _check_dates(self) -> "BookingTypeCreate":
        if (
            self.available_from
            and self.available_to
            and self.available_to < self.available_from
        ):
            raise ValueError("available_to must be >= available_from")
        return self


class BookingTypePatch(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = None
    privacy_policy_url: str | None = None
    duration_minutes: int | None = Field(default=None, ge=5, le=24 * 60)
    timezone: str | None = None
    weekly_schedule: dict | None = None
    available_from: date | None = None
    available_to: date | None = None
    minimum_notice_minutes: int | None = Field(
        default=None, ge=0, le=365 * 24 * 60
    )
    lookahead_days: int | None = Field(default=None, ge=1, le=90)
    target_calendar_id: str | None = None
    blocking_calendar_ids: list[str] | None = None
    capacity: int | None = Field(default=None, ge=1, le=1000)
    notify_user_subs: list[str] | None = None
    enabled: bool | None = None

    @field_validator("weekly_schedule")
    @classmethod
    def _check_weekly(cls, v: dict | None) -> dict | None:
        return _validate_weekly_schedule(v) if v is not None else None
