"""공개 캘린더 ICS subscription: 비인증 (ADR-0013).

GET /calendars/{token}.ics: 토큰만으로 캘린더 ICS 응답. PIPA 마스킹 강제 (booking-linked).
활성화 X 거나 토큰 일치 X 면 404. IP rate limit 적용.
"""

from __future__ import annotations

from typing import Annotated
from urllib.parse import quote

from fastapi import APIRouter, Depends, Header, HTTPException, Path, Request, Response
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_db
from app.core.logging import logger
from app.middleware.rate_limit import check_ip_limit, get_rate_limits
from app.models.calendar import Calendar
from app.services.ics_subscription import render_subscription_ics

router = APIRouter(prefix="/calendars", tags=["public-calendars"])


def _client_ip(request: Request, x_forwarded_for: str | None) -> str:
    if x_forwarded_for:
        return x_forwarded_for.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


@router.get(
    "/{token}.ics",
    summary="ICS subscription (비인증, 토큰 기반)",
    responses={
        404: {"description": "활성화되지 않았거나 토큰 무효"},
        429: {"description": "Rate limit"},
    },
)
async def public_calendar_ics(
    request: Request,
    token: str = Path(..., min_length=20, max_length=64),
    x_forwarded_for: Annotated[str | None, Header()] = None,
    db: AsyncSession = Depends(get_db),
) -> Response:
    ip = _client_ip(request, x_forwarded_for)
    per_ip, _ = get_rate_limits()
    await check_ip_limit(ip, per_ip)

    stmt = select(Calendar).where(
        Calendar.subscription_token == token,
        Calendar.subscription_enabled.is_(True),
        Calendar.deleted_at.is_(None),
    )
    cal = (await db.execute(stmt)).scalar_one_or_none()
    if cal is None:
        # 활성화 안 됨 / 폐기 / 미존재 모두 동일 404: 토큰 추측 공격 정보 누설 방지
        raise HTTPException(404, "Not found")

    body = await render_subscription_ics(db, cal)

    ascii_name = "".join(
        c if c.isascii() and c.isalnum() else "_" for c in cal.name
    )[:40] or "calendar"
    utf8_name = quote(cal.name or "calendar", safe="")

    logger.info(
        "ics_subscription_served",
        extra={
            "category": "biz",
            "calendar_id": cal.id,
            "ip": ip,
            "bytes": len(body),
        },
    )

    return Response(
        content=body,
        media_type="text/calendar; charset=utf-8",
        headers={
            "Content-Disposition": (
                f'inline; filename="{ascii_name}.ics"; '
                f"filename*=UTF-8''{utf8_name}.ics"
            ),
            # 외부 캐시(CDN) 금지, 클라이언트만 캐시 15분
            "Cache-Control": "private, max-age=900",
        },
    )
