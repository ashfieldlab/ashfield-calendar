# 공개(비인증) 라우트 카브-아웃 — `/api/public/v1/*`

## 컨텍스트

모든 `/api/v1/*` 호출은 백엔드가 검증한 신원(JWT 또는 게이트웨이 세션)만 신뢰한다. 의도는 **caller identity 의 진실 출처를 단일화** 하는 것이다.

새 기능(외부 고객 예약 — Booking)이 들어오면서 **신원 자체가 없는** 라우트가 필요해졌다:

- 슬롯 조회: 누구나 가능 시간 보기
- Booking 제출: 외부 고객이 자기 이름·이메일 입력
- Booking 취소: 응답 메일의 토큰으로 자기 예약 취소

이들은 JWT 가 없는 게 정상 — 우리 회사 멤버가 아닌 외부인이 호출.

## 결정

`/api/public/v1/*` 단일 prefix 안에서만 비인증 라우트 허용. 그 외 모든 prefix(`/api/v1/*`)는 인증 강제 그대로 유지.

### 의무 보호 계층 (비인증 = 무방어 아님)

| 계층 | 메커니즘 |
|---|---|
| **CAPTCHA** | env flag (`PUBLIC_CAPTCHA_PROVIDER=turnstile|none`). 기본은 `none`(MVP), 어뷰즈 보이면 Cloudflare Turnstile 즉시 활성. |
| **Honeypot 필드** | 폼에 `display:none` hidden 필드. 채워진 채 제출되면 무시 (status 200 흉내 + 로그). 0 마찰, 80% 봇 차단. |
| **Rate limit** | Redis fixed-window. IP 단위 분당 N개 + 이메일 단위 분당 1개. 운영 보고 임계 조정. |
| **CORS** | 우리 도메인 화이트리스트만. 외부 사이트 임베드는 BookingType 별 `allowed_origins` 옵션(향후). |
| **Audit log** | `actor_sub=NULL`, `actor_type="public"`. meta 에 ip·user-agent 박음. 시스템 레벨 audit (ADR D-1 의 nullable company_id 가 여기 활용됨). |
| **노출 정보 최소화** | 슬롯 응답에 운영자 신원(name/email) 포함 X. 회사 이름 + BookingType title/description/duration 만. 다른 예약자 정보 노출 X. |

### 정적 라우트 분기 (코드 강제)

```
backend/app/api/
├── router.py                    ← 기존 (api_router prefix=/api/v1)
└── public_router.py             ← 신규 (public_api_router prefix=/api/public/v1)
                                    JWT dependency 없음, rate-limit middleware 의무

main.py:
  app.include_router(api_router)         # 기존
  app.include_router(public_api_router)  # 신규 — 별도 의존성 트리
```

`Depends(get_current_user)` 가 절대 닿지 않는 라우터로 분리해 실수 방지. 미래 reader 는 prefix 만 보면 "여긴 비인증" 즉시 식별.

## 대안

### 외부 SaaS (cal.com 자체호스팅·Calendly)
- 비인증 layer 책임 외부화 가능
- 하지만 페이지·메일 커스터마이징 한계(Nextcloud 와 동일 문제). 기각 — 별도 결정 (사용자 confirm 2026-06-04).

### 부분 인증 (이메일 OTP)
- "고객 이메일 입력 → OTP 코드 → 예약" 흐름. JWT 까진 안 발급, 단기 토큰만.
- UX 큰 마찰. cal.com·Calendly·SavvyCal 다 안 함 — 시장 검증된 모델 아님.

### 별도 마이크로서비스 (booking 서버)
- 비인증 부담 별도 서비스로 분리. 우리 SMTP·캘린더와의 통합은 webhook 또는 CalDAV.
- 인프라 비용 大. MVP 엔 과한 분리.

## 의도된 결과

- 비인증 표면이 한 prefix 로 못 박힘 → 보안 감사 표면 최소화
- 미래 외부인 대상 라우트(공개 신청서·waitlist 등) 가 같은 prefix 재사용 가능
- 본질("신원 주장 시엔 검증된 자격 증명") 은 그대로 유지

## 영향

- `app/api/public_router.py` 신규
- `app/middleware/rate_limit.py` 신규 (Redis fixed-window)
- `app/services/audit.py::write_audit` 가 `actor_type="public"` 케이스 처리 — 이미 nullable company_id 라 수정 적음
- 환경변수: `PUBLIC_CAPTCHA_PROVIDER`, `PUBLIC_RATE_LIMIT_PER_IP`, `PUBLIC_RATE_LIMIT_PER_EMAIL`

## 참고

- ADR-0012 — 즉시 등록 모델 (본 prefix 위에서 동작)
