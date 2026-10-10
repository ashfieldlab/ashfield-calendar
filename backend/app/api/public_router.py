"""공개(비인증) 라우터 — `/api/public/v1/*` (ADR-0011).

JWT dependency 가 절대 닿지 않는 별도 트리. honeypot + rate limit + audit log 의무.
공개 booking + 캘린더 ICS subscription (ADR-0013) 만 들어감 — 일반 도메인 라우트는 X.
"""

from fastapi import APIRouter

from app.api.public import booking as booking_public
from app.api.public import calendars as calendars_public
from app.api.public import events as events_public

public_api_router = APIRouter(prefix="/api/public/v1")
public_api_router.include_router(booking_public.router)
public_api_router.include_router(calendars_public.router)
public_api_router.include_router(events_public.router)
