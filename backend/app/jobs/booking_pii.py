"""Booking PII 자동 마스킹 cron: ADR-0012 + PIPA 제21조 (지체 없이 파기).

slot_end_at + settings.booking_pii_retention_days(기본 30) 지난 row 의
개인정보 필드(name/email/message/cancel_token/ip/user_agent) NULL 로 마스킹.
row 자체는 통계용 보존 (count, capacity 사용량 등).

이미 마스킹된 row 는 다시 update 안 함 (customer_email IS NOT NULL 조건).
"""

from datetime import UTC, datetime, timedelta

from sqlalchemy import update

from app.core.config import settings
from app.core.db import AsyncSessionLocal
from app.core.logging import logger
from app.models.booking import Booking


async def purge_expired_booking_pii(ctx: dict) -> int:
    """retention 지난 booking 의 PII 컬럼 마스킹. 영향 받은 row 수 반환."""
    cutoff = datetime.now(UTC) - timedelta(days=settings.booking_pii_retention_days)

    async with AsyncSessionLocal() as db:
        stmt = (
            update(Booking)
            .where(
                Booking.slot_end_at < cutoff,
                # 아직 미마스킹된 row 만
                Booking.customer_email.is_not(None),
            )
            .values(
                customer_name=None,
                customer_email=None,
                customer_message=None,
                cancel_token=None,
                ip_address=None,
                user_agent=None,
            )
            .execution_options(synchronize_session=False)
        )
        result = await db.execute(stmt)
        await db.commit()
        affected = result.rowcount or 0
        if affected:
            logger.info(
                "booking_pii_purged",
                extra={
                    "category": "biz",
                    "count": affected,
                    "retention_days": settings.booking_pii_retention_days,
                },
            )
        return affected
