# ADR-0014 — CalDAV 양방향 sync (Sabre/DAV + App Token 인증)

- **상태**: 결정 (2026-06-07)
- **컨텍스트 ADR**:
  - [0011](0011-public-route-carveout.md) 공개 라우트 카브-아웃
  - [0013](0013-ics-subscription.md) ICS subscription (단방향, 비인증, 마스킹)

## 컨텍스트

[ADR-0013](0013-ics-subscription.md) 의 ICS subscription 으로 단방향 read 는 커버되지만, 운영자가 본인 자체 호스팅 Nextcloud / Apple Calendar / Thunderbird 에서 일정을 **만들고·수정**하길 원하는 요구. 양방향 sync 가 필요.

핵심 제약:
- **외부 CalDAV 클라이언트는 HTTP Basic 만 보냄** (OAuth 받는 클라이언트 거의 없음 — DAVx5 일부 제외). NextAuth/Keycloak JWT 직접 전송 불가.
- **JWT exp 가 짧음** (수십 분). 캘린더 앱은 수년간 한 번 등록하고 쓰는 패턴.
- **CalDAV 풀구현은 1-2개월**, 클라이언트 quirk 매트릭스 큼.
- **Python 생태계에 동급 CalDAV 라이브러리 없음**. Radicale 도 호환성 충분하지만 우리 도메인 모델과 통합 시 plugin API ergonomic 떨어짐.

## 결정

### 1. Sabre/DAV (PHP) + Custom Backend

Sabre 의 12년치 클라이언트 quirk 패치 (Nextcloud·iCloud 기반) 그대로 활용. 별도 PHP 컨테이너로 운영. FastAPI 와 같은 PostgreSQL DB 공유.

```
외부 캘린더 앱 ──CalDAV──▶ nginx ─┬─▶ /caldav/* → Sabre (PHP, php-fpm)
                                  └─▶ /api/*    → FastAPI (Python)
                                                ↓ 같은 DB
                                          PostgreSQL
```

### 2. 인증 = DB-backed App Token (NextAuth JWT 와 별도)

외부 클라이언트가 OAuth 못 보내므로 long-lived 토큰 발급 모델. GitHub PAT·Nextcloud App Password 패턴.

```
CalDavToken {
  id, user_sub, company_id, secret_hash, name,
  created_at, last_used_at, revoked_at
}
```

- 토큰 발급: FastAPI 의 `/api/v1/me/caldav-tokens` (NextAuth JWT 인증 + active_company 강제)
- 발급 시 임의 secret (`secrets.token_urlsafe(32)`) 생성 → bcrypt hash 만 DB 저장 → 평문은 **한 번만** 사용자에게 표시
- 사용자가 캘린더 앱에 HTTP Basic 으로 입력:
  - username = `user_sub`
  - password = 토큰 secret 평문
- Sabre 가 매 요청마다 검증: `SELECT WHERE user_sub = ? AND revoked_at IS NULL` → bcrypt 비교 → 통과 시 `last_used_at` 갱신
- Revoke = `revoked_at` 설정. 즉시 무효 (JWT exp 대기 없음)

### 3. 회사 격리

토큰은 **(user_sub, company_id) 한 쌍**에 묶임. 같은 user 가 여러 회사 멤버여도 토큰은 회사별 분리 발급.

Sabre Custom Backend 의 `getCalendarsForUser`:
```sql
SELECT FROM calendars
WHERE company_id = $token.company_id
  AND deleted_at IS NULL
  AND (scope = 'shared' OR (scope = 'personal' AND owner_id = $token.user_sub))
```

다른 회사 캘린더는 토큰이 다르므로 노출 불가.

#### 3.1 TokenContext 폐기 — DB-only (2026-06-08)

초기 구현은 `validateUserPass` 단계에서 `(user_sub, company_id)` 를 정적 클래스 (`TokenContext`) 에 set 한 뒤 `getCalendarsForUser` 가 그 값을 읽는 형태였음. 운영 첫 배포에서 일부 호출 시점에 `TokenContext` 가 NULL 상태로 backend 가 호출되는 케이스 관찰 — 결과적으로 빈 캘린더 목록 → individual calendar 404.

vendor 코드 분석 (AuthPlugin priority 10, DAVACL 20, 다른 plugin 은 `beforeMethod` 미등록) 상 이론적으로 발생하지 않아야 하나, PHP-FPM multi-worker 환경의 race / 미확인 edge case 로 추정. 정적 변수는 process scope (worker 가 살아있는 동안 유지) 라 우리가 명시 reset 안 하면 stale 값 위험도 존재.

→ **메모리 의존 자체를 폐기**. 모든 backend 메서드가 매 호출마다:

1. **user_sub**: `$_SERVER['HTTP_AUTHORIZATION']` 의 HTTP Basic 헤더에서 직접 추출 (request-scoped global, stale 위험 없음)
2. **company_id**: `caldav_tokens WHERE user_sub = ? AND revoked_at IS NULL` 로 매번 DB lookup

성능 영향 무시 가능 — `caldav_tokens.user_sub` index 로 ~0.1ms / 호출. 정확성 > 성능.

```php
private function currentUserSub(): ?string {
    $auth = $_SERVER['HTTP_AUTHORIZATION'] ?? '';
    if (stripos($auth, 'Basic ') !== 0) return null;
    $decoded = base64_decode(substr($auth, 6), true);
    if ($decoded === false || !str_contains($decoded, ':')) return null;
    [$user] = explode(':', $decoded, 2);
    return $user !== '' ? $user : null;
}
```

`TokenContext.php` 클래스 삭제. AuthPlugin 이 method handler 호출 전에 검증을 완료하므로 backend 에 도달한 시점의 Authorization 헤더 username 신뢰 가능.

### 4. 마스킹 X — 인증 채널이라 PIPA 마스킹 불필요

[ADR-0013](0013-ics-subscription.md) 의 마스킹은 **token-in-URL 비인증** 라우트의 destination 불명 위험 때문. CalDAV 는:
- 인증 채널 (HTTP Basic + DB 검증)
- 운영자가 본인 자격으로 본인 데이터 받음 (데이터 컨트롤러가 자기 인가한 채널)
- destination 책임 = 운영자 (어느 캘린더 앱에 토큰 박을지 본인 결정)

→ 풀 데이터 응답. 마스킹 없음. customer 이름·메시지 그대로 노출. 운영자가 약관에 동의 시 본인 책임.

대신 안전장치:
- 토큰 발급 시 약관 명시: "이 토큰은 운영자 본인의 트러스트 안에서만 사용. 외부 SaaS (Google/Apple iCloud) 에 등록 시 PIPA 위탁 검토 필요"
- App Token 별 access log (`last_used_at` + IP 별 audit) — 의심스러우면 revoke
- 분리 권고: 외부 공개용 = ICS subscription (마스킹), 본인 통합용 = CalDAV (풀모드)

### 5. write 경로 정책

외부 클라이언트 → Sabre → DB:
- 일반 native event: 자유 (생성·수정·삭제 모두 OK)
- **booking-linked event = 외부 수정 차단 (403)** — booking 시스템과의 일관성 유지. read 만 허용
- external_ics calendar 도 외부 write 차단 (기존 정책 유지)
- 모든 mutation audit_logs 기록

### 6. PHP 코드 분량

- Custom Backend 클래스 (`AbstractBackend` 구현): 8-10개 메서드, ~400줄
- 인증 Plugin (HTTP Basic → CalDavToken 검증): ~100줄
- ICS ↔ 우리 schema 변환 (icalendar PHP lib): ~150줄
- 합계 ~600-700줄 PHP. sync 어댑터 없음 (같은 DB).

### 7. Schema 추가

- `caldav_tokens` 테이블 신규
- `calendar_events.dav_uri` (Sabre URL 슬러그)
- `calendar_events.raw_ics` (nullable, round-trip 손실 방지)
- `calendars.sync_token` (정수 증가, RFC 6578)
- `calendar_object_changes` 테이블 (sync REPORT 변경 추적)

## 대안 비교

| 안 | 채택 여부 | 이유 |
|---|---|---|
| Radicale (Python) + custom plugin | X | plugin API ergonomic 약함. 클라이언트 호환성 운영 검증 적음 |
| Baïkal (PHP Sabre 래퍼) + DB sync | X | sync 어댑터가 CalDAV 절반 작업. Baïkal storage 가 master 라 우리 도메인 모델과 어긋남 |
| Python 으로 CalDAV 풀구현 | X | 1-2개월 + 클라이언트 quirk 매트릭스. Sabre 12년치 무시 |
| App Token 대신 NextAuth JWT 직전송 | X | 외부 클라 OAuth 못 함, exp 짧음 |
| App Token 대신 self-contained JWT | X | revoke 어려움 (blacklist 운영 부담) |
| 회사 격리 = 모든 회사 통합 view | X | 같은 user 가 회사 A·B 멤버일 때 캘린더 섞임. 토큰 분리가 명확 |

## 결과

### 사용자 흐름

1. 우리 앱 → 설정 → "외부 캘린더 앱 연결" → [토큰 발급]
2. 화면에 한 번만 표시:
   - URL: `https://calendar.example.com/caldav/`
   - Username: `user.sub`
   - Password: `cdv_aB3xK9...`
3. 본인 캘린더 앱에서 위 3가지 입력 → 자동 연결
4. 양방향 sync 시작

### 운영 측면

- docker-compose 에 PHP 컨테이너 추가 (php-fpm + Sabre/DAV + composer)
- nginx 가 `/caldav/*` → PHP, 나머지 → FastAPI 라우팅
- 외부 노출 URL = `https://calendar.example.com/caldav/` (CalDAV 표준 well-known 도 같이 응답)
- DB 는 FastAPI 와 공유. Sabre 가 직접 PDO_PGSQL 로 연결

### 보안

- 토큰 = 평문 노출 1회, DB 엔 bcrypt hash
- HTTPS 강제 (운영)
- IP 별 rate limit (재사용)
- last_used_at 추적 → 사용자가 본인 토큰 사용 history 확인 가능
- 비활성 토큰 자동 만료 (옵션, 6개월 미사용 시 알림 + 12개월 후 revoke)

### Trade-off

- PHP 운영 환경 추가 (디버그·로그·배포 한 단계 더)
- Sabre/DAV 라이브러리 패치 follow-up
- 양방향 sync 의 정합성 책임 (booking-linked write 차단 같은 정책 hook 위치 잘 박기)

다만 Python 으로 CalDAV 다시 짜는 것에 비하면 압도적으로 작은 부담.
