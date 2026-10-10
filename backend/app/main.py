"""ashfield-calendar Backend: FastAPI entry point (일정·예약)."""

from contextlib import asynccontextmanager

from fastapi import FastAPI

# ORM event listener 등록: import 부수 효과로 hook 활성화 (ADR-0014)
import app.services.calendar_sync_log  # noqa: F401
from app.api.public_router import public_api_router
from app.api.router import api_router
from app.core.logging import logger, setup_logging
from app.core.redis import close_redis
from app.middleware.error_handler import register_error_handlers
from app.middleware.request_id import RequestIdMiddleware


@asynccontextmanager
async def lifespan(_: FastAPI):
    setup_logging()
    logger.info("backend_starting", extra={"category": "api"})
    yield
    await close_redis()
    logger.info("backend_stopped", extra={"category": "api"})


_API_DESCRIPTION = """
ashfield-calendar 백엔드: 일정·예약 SaaS.

## 공통 요청 헤더

| 헤더 | 값 | 비고 |
|------|----|------|
| `Authorization` | `Bearer <JWT>` | Better Auth(JWT 플러그인) 발급. `AUTH_JWKS_URL` 로 서명·iss·aud 검증. |
| `X-Active-Company-Id` | 소속 회사 ID 중 하나 | 멀티 테넌트. `/api/v1/me` 의 `groups`. 소속이 아니면 403. |
| `X-Request-ID` | UUID 등 trace id | 로그/응답 헤더에 echo. 없으면 자동 발급. |

## 표준 응답 코드

| 코드 | 의미 |
|------|------|
| 200 | OK |
| 201 | 생성됨. body 에 새 리소스. |
| 204 | OK, body 없음 |
| 400 | 요청 자체가 잘못됨 |
| 401 | 인증 실패 (토큰 없음·만료·서명·iss·aud 불일치) |
| 403 | 인증은 됐지만 권한 없음 |
| 404 | 리소스 없음: 다른 회사 리소스도 404 로 마스킹 |
| 409 | 상태 충돌 (예: 회의실 시간 겹침) |
| 422 | 검증 실패 (Pydantic) |

## 공개 (인증 없음) 라우트

`/api/public/v1/*`: 예약 폼·ICS 구독·RSVP (ADR-0011).
"""

_TAGS_METADATA = [
    {"name": "auth", "description": "현재 사용자 정보 (첫 호출 시 개인 워크스페이스 생성)."},
    {"name": "calendars", "description": "캘린더 CRUD + 개인 가시 토글. 외부 ICS 구독은 source=external_ics."},
    {"name": "events", "description": "일정 CRUD + 범위 occurrence 풀어보기 + .ics export + 초대."},
    {"name": "notifications", "description": "in-app 알림 목록·읽음 처리·이메일 수신 설정."},
    {"name": "webhooks", "description": "회사 admin 전용. 외부 시스템에 알림 fan-out."},
    {"name": "audit", "description": "관리자 전용. 회사 mutation 감사 로그."},
    {"name": "activity", "description": "본인 관련 변경 타임라인 (audit_logs 중 본인 행동/본인 관련 entity)."},
    {"name": "search", "description": "일정 검색."},
    {"name": "company", "description": "회사 멤버 자동완성·멤버 관리."},
]


app = FastAPI(
    title="Ashfield Calendar API",
    version="0.4.0",
    description=_API_DESCRIPTION,
    openapi_tags=_TAGS_METADATA,
    contact={"name": "Ashfield", "url": "https://github.com/ashfieldlab/ashfield-calendar"},
    lifespan=lifespan,
)

# 미들웨어 (등록 역순으로 실행: request_id가 가장 먼저)
app.add_middleware(RequestIdMiddleware)

# 글로벌 예외 처리
register_error_handlers(app)

# 라우터
app.include_router(api_router)
app.include_router(public_api_router)  # ADR-0011: 비인증, JWT dependency 없음


@app.get("/health", tags=["meta"], summary="헬스 체크")
async def health() -> dict[str, str]:
    """LB/cron 용. 인증 불필요. 항상 `{"status": "ok"}` 반환.

    DB 연결 실패해도 200: DB 의존 핸들러에서 별도 503 응답.
    """
    return {"status": "ok"}
