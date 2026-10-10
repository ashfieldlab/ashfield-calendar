"""Redis 기반 fixed-window rate limit — 공개 라우트 (ADR-0011) 용.

키 패턴:
  rl:public:ip:{ip}:{minute}        — IP 분당 N개
  rl:public:email:{email}:{minute}  — 이메일 분당 1개 (booking 시점에 추가 검사)

윈도우는 60초 fixed. Redis SETNX + EX. 다음 분에 자동 초기화.
"""

from __future__ import annotations

import time

from fastapi import HTTPException

from app.core.config import settings
from app.core.logging import logger
from app.core.redis import get_redis


async def check_ip_limit(ip: str, limit_per_minute: int) -> None:
    """IP 단위 분당 limit_per_minute 회 제한. 초과 시 429 raise."""
    if limit_per_minute <= 0:
        return
    minute_bucket = int(time.time() // 60)
    key = f"rl:public:ip:{ip}:{minute_bucket}"
    try:
        r = get_redis()
        n = await r.incr(key)
        if n == 1:
            await r.expire(key, 65)  # 1분 + 여유
    except Exception as exc:
        # Redis 다운 시 fail-open — 차단 안 함, warning 로그.
        logger.warning(
            "rate_limit_redis_unavailable",
            extra={"category": "api", "error": str(exc)},
        )
        return
    if n > limit_per_minute:
        logger.info(
            "rate_limit_blocked",
            extra={"category": "api", "scope": "ip", "ip": ip, "count": n},
        )
        raise HTTPException(429, "Too many requests")


async def check_email_limit(email: str, limit_per_minute: int) -> None:
    """같은 이메일 분당 limit_per_minute 회 제한 (보통 1)."""
    if limit_per_minute <= 0 or not email:
        return
    minute_bucket = int(time.time() // 60)
    key = f"rl:public:email:{email.lower()}:{minute_bucket}"
    try:
        r = get_redis()
        n = await r.incr(key)
        if n == 1:
            await r.expire(key, 65)
    except Exception as exc:
        logger.warning(
            "rate_limit_redis_unavailable",
            extra={"category": "api", "error": str(exc)},
        )
        return
    if n > limit_per_minute:
        logger.info(
            "rate_limit_blocked",
            extra={"category": "api", "scope": "email", "email": email, "count": n},
        )
        raise HTTPException(429, "Too many requests")


def get_rate_limits() -> tuple[int, int]:
    """settings 또는 env → (per_ip, per_email) per minute."""
    return (
        getattr(settings, "public_rate_limit_per_ip", 10),
        getattr(settings, "public_rate_limit_per_email", 1),
    )
