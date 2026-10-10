"""
환경 설정: pydantic-settings.

.env 파일 또는 환경변수에서 로드. SPEC §3.2.
"""

from typing import Literal

from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=("../.env", ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
    )

    # 환경
    environment: Literal["development", "production"] = "development"

    # Database
    database_url: str = "postgresql+asyncpg://ashfield:ashfield_dev@localhost:15542/ashfield_calendar"

    # Redis (공개 라우트 rate limit 등)
    redis_url: str = "redis://localhost:16489"

    # SMTP (Phase 3a-3): dev 에선 비활성. 운영에선 환경변수로 주입.
    smtp_enabled: bool = False
    smtp_host: str = "localhost"
    smtp_port: int = 1025
    smtp_user: str = ""
    smtp_password: str = ""
    smtp_use_tls: bool = False
    smtp_from: str = "noreply@ashfield.local"
    smtp_from_name: str = "Ashfield"
    # 이메일, 구독, CalDAV 링크 base URL (ashfield-calendar 앱 origin).
    calendar_base_url: str = "http://localhost:3100"
    # SMTP 비밀번호 등 민감 컬럼 암호화 키: Fernet 32 bytes base64.
    # 분실해도 SMTP 재설정만 하면 복구. 운영은 secret manager 에서 주입.
    smtp_encryption_key: str = ""

    # 기본 공휴일 캘린더: 워크스페이스마다 자동 시드되는 external_ics 구독 URL.
    # 빈 값이면 시드 안 함. external_ics_refresh 잡(매 5분)이 채운다.
    holidays_ics_url: str = ""

    # JobRun 원장 보관: N일 지난 cron 실행 기록은 일 1회 자동 삭제.
    job_run_retention_days: int = 14

    # 공개 라우트 (ADR-0011) rate limit. 0 = 비활성.
    # IP 분당 한도: CGNAT(모바일 캐리어와 공유 WiFi) 고려해 넉넉히. 실제 어뷰즈
    # 방어선은 per-email + honeypot. 운영 관찰 후 줄여도 무방.
    public_rate_limit_per_ip: int = 1000
    public_rate_limit_per_email: int = 1      # booking 제출 시 같은 이메일 분당 수
    # Booking PII 보관: slot 종료 + N일 후 마스킹.
    booking_pii_retention_days: int = 30

    # 인증: Ashfield 계정 서버(OIDC 제공자)가 발급한 액세스 토큰(JWT)을 JWKS 로 검증한다
    # (ADR-0024, 계약: ashfield-account docs/adr/0001). 셋 다 필수: 비어 있으면 인증 요청이 503.
    #   AUTH_JWKS_URL = ${ACCOUNT_URL}/api/auth/jwks
    #   AUTH_ISSUER   = ${ACCOUNT_URL}            (토큰 iss 와 정확히 일치)
    #   AUTH_AUDIENCE = 이 앱의 공개 주소(resource): 토큰 aud(배열)에 포함돼야 한다.
    auth_jwks_url: str = ""
    auth_issuer: str = ""
    auth_audience: str = ""

    # System Admin 이메일 (쉼표 구분). users.is_system_admin 과 OR.
    system_admin_emails: str = ""

    @property
    def system_admin_email_set(self) -> frozenset[str]:
        return _email_set(self.system_admin_emails)

    # 로깅
    log_categories: str = ""  # ""=info만, "auth,api"=특정 카테고리 debug, "*"=전부

    @model_validator(mode="after")
    def _guard_auth_in_production(self) -> "Settings":
        if self.environment == "production" and not (
            self.auth_jwks_url and self.auth_issuer and self.auth_audience
        ):
            raise RuntimeError(
                "AUTH_JWKS_URL, AUTH_ISSUER, AUTH_AUDIENCE 는 운영에서 필수입니다 (안전 가드)"
            )
        return self


def _email_set(raw: str) -> frozenset[str]:
    return frozenset(e.strip().lower() for e in raw.split(",") if e.strip())


settings = Settings()
