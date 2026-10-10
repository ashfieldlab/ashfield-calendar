# ADR-0013: 캘린더 ICS subscription (외부 미러 + PIPA 마스킹)

- **상태**: 결정 (2026-06-07)
- **컨텍스트 ADR**: [0011](0011-public-route-carveout.md) 공개 라우트 카브-아웃

## 컨텍스트

운영자가 자체 호스팅하는 Nextcloud / 외부 캘린더 클라이언트(Google, Apple, Outlook)에서
Ashfield 일정을 일방향 미러링하려는 요구. CalDAV 풀구현은 헤비(RFC 4791, 별도 서버)
이지만 ICS subscription 은 대부분 외부 캘린더 앱이 지원하는 단방향 사용 케이스에 충분.

핵심 위험은 외부 라우트가 다음 두 가지를 동시에 노출한다는 점:
- **자격 증명 부재**: 외부 캘린더 클라이언트는 OAuth/세션 인증을 못 보냄.
  토큰-in-URL 만 가능 (Google Calendar private ICS URL, Outlook publish URL 패턴 동일).
- **고객 PII**: booking 으로부터 만든 `CalendarEvent` 의 title/description 에
  외부 고객의 이름과 자유 텍스트 메시지가 들어 있음. 그대로 노출하면
  PIPA "수집 목적 외 이용" 위반 (고객은 "예약 처리" 동의했지 "운영자의 외부 캘린더 앱
  서버로 전송" 까지 동의 X).

## 결정

### 1. 단방향 ICS subscription 만 지원 (CalDAV 미구현)

`GET /api/public/v1/calendars/{token}.ics`: 인증 없는 외부 라우트, ICS 응답.
CalDAV 는 양방향 sync 가 정말 필요해질 때 별도 ADR.

### 2. 보안 안전장치 (필수)

| 항목 | 정책 |
|---|---|
| 토큰 길이 | `secrets.token_urlsafe(32)` (≈ 43자) |
| 활성화 | **opt-in**: 기본 OFF, 운영자 명시적 활성화 (활성 안 됐으면 endpoint 404) |
| HTTPS | 운영에서 강제 (배포 단 reverse proxy) |
| 회전 | 운영자가 "토큰 재발급" 클릭 시 새 토큰. 기존 URL 즉시 무효 |
| 비활성화 | 토큰 null + endpoint 404 |
| Rate limit | public IP rate limit 재사용 ([ADR-0011](0011-public-route-carveout.md)) |
| Cache-Control | `private, max-age=900` (외부 캐시 금지, 클라이언트만 캐시) |
| Audit | 활성화, 회전, 비활성화 모두 `audit_logs` 기록 |

### 3. 권한 분기

| 캘린더 종류 | subscription 관리 권한 |
|---|---|
| 개인 (scope=personal) | 소유자만 |
| 워크스페이스 (scope=shared) | Workspace Admin 만 (활동이 외부 노출되는 결정이라 보수적) |
| 초대받은(invited) | 불가: 본인 데이터 아니므로 |

### 4. PIPA 마스킹: **booking-linked event 는 비협상 강제 마스킹**

ICS subscription 응답에서 `Booking.calendar_event_id` 로 연결된 `CalendarEvent` 는:

| 필드 | 노출 |
|---|---|
| `SUMMARY` (제목) | `BookingType.title` 만 (고객명 제거) |
| `DESCRIPTION` (본문) | 비움 (customer_message 노출 금지) |
| `LOCATION` | 비움 |
| `DTSTART` / `DTEND` / `RRULE` | 그대로 (BUSY 표시 용도) |

운영자가 직접 만든 event 는 마스킹 X. 토글 없음(코드 상수).
운영자 실수로 풀모드 켜면 PIPA 위반 + 회복 불가(외부 서버에 sync 된 데이터 회수 X).
필요해지면 별도 ADR + 위탁 동의 약관 갱신 후 추가.

### 5. 운영자에게 노출되는 카피

- "이 URL 은 비밀번호와 같이 다루세요. 유출 시 캘린더 일정이 외부에 노출됩니다."
- "외부 고객 예약 정보(이름과 메시지)는 자동으로 가려져 시간과 제목만 노출됩니다."
- "Google, Apple 같은 외부 서비스 캘린더에도 등록 가능하지만, 자체 호스팅 캘린더
  (Nextcloud 등)에 사용을 권장합니다."

## 대안 비교

| 안 | 채택 여부 | 이유 |
|---|---|---|
| CalDAV 풀구현 (RFC 4791) | X | 헤비, 양방향 sync 미요구. 별도 서버(Radicale 등) 도입 필요 |
| 토글로 풀모드 / 마스킹 선택 | X | PIPA 회복 불가능한 위반 위험. 운영자 실수 차단 |
| 토큰 in `?token=` 쿼리스트링 | X | 서버 로그, referer 노출 위험. 경로(.ics) 가 표준 |
| Bearer 헤더 인증 | X | 외부 캘린더 클라이언트가 헤더 인증 미지원 |

## 결과

- `calendars.subscription_enabled` (bool, default false) + `subscription_token` (str|null)
- `POST /api/v1/calendars/{id}/subscription` 활성화, `.../rotate` 회전,
  `DELETE .../subscription` 비활성화
- `GET /api/public/v1/calendars/{token}.ics` (rate limited, no auth)
- ICS 생성 헬퍼가 booking-linked 자동 join + 마스킹
- 운영자 UI: 캘린더 편집 모달에 "외부 구독" 섹션
- 모든 변화 audit_logs
