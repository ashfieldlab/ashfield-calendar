"""외부 ICS 구독 캘린더의 주기 refresh: 외부 캘린더 측 변경 반영.

cron 매 5분 실행. 활성 external_ics 캘린더를 순회하면서 refresh_external_calendar
를 호출 (wipe-and-reload). 개별 캘린더 실패는 warning 로그만, 다음 cycle 에 재시도.

캘린더별 별도 트랜잭션: 한 캘린더의 fetch 실패가 다른 캘린더에 영향 X.
"""

from __future__ import annotations

from sqlalchemy import select

from app.core.db import AsyncSessionLocal
from app.core.logging import logger
from app.models.calendar import Calendar
from app.services.external_ics import refresh_external_calendar


async def refresh_all_external_ics(ctx: dict) -> int:
    """모든 active external_ics 캘린더를 순회 refresh. 반환: 성공한 캘린더 수."""
    # 1) 캘린더 id 목록만 별도 세션으로 수집 (refresh 시 각 cal 별 트랜잭션 격리).
    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(Calendar.id).where(
                Calendar.source == "external_ics",
                Calendar.external_ics_url.is_not(None),
                Calendar.deleted_at.is_(None),
            )
        )
        cal_ids = list(result.scalars().all())

    refreshed = 0
    failures = 0
    for cal_id in cal_ids:
        try:
            async with AsyncSessionLocal() as db:
                cal = await db.get(Calendar, cal_id)
                if cal is None or cal.source != "external_ics":
                    continue
                if not cal.external_ics_url:
                    continue
                await refresh_external_calendar(
                    db, cal=cal, actor_sub=cal.owner_id
                )
                await db.commit()
            refreshed += 1
        except Exception as exc:  # noqa: BLE001: 개별 실패는 다음 cycle 재시도
            failures += 1
            logger.warning(
                "ics_refresh_failed",
                extra={
                    "category": "biz",
                    "calendar_id": cal_id,
                    "error": str(exc),
                },
            )

    logger.info(
        "ics_refresh_cycle",
        extra={
            "category": "biz",
            "refreshed": refreshed,
            "failures": failures,
            "total": len(cal_ids),
        },
    )
    return refreshed
