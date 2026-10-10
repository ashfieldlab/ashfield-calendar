# Ashfield Calendar

멀티테넌트 일정·예약 앱입니다. 일정, 회의실, 외부 고객 예약, 알림, CalDAV 동기화를 다루며 데이터는 회사(테넌트) 단위로 격리됩니다. 파일 앱 [ashfield-drive](https://github.com/ashfieldlab/ashfield-drive)와는 레포·백엔드·DB가 분리된 별도 서비스입니다.

문서: [CONTEXT.md](CONTEXT.md) (도메인 용어) · [docs/adr/](docs/adr/) (설계 결정) · [SPEC.md](SPEC.md)

## 구성

```
frontend/   Next.js 16 · Tailwind · FullCalendar
backend/    FastAPI · SQLAlchemy 2.0 async · Alembic · arq 워커
caldav/     Sabre/DAV (PHP) CalDAV 서버, 같은 DB 공유
infra       Postgres · Redis · Mailpit   (docker compose, dev)
```

## 현재 상태

- **로그인은 [Better Auth](https://www.better-auth.com) (Google·GitHub)** 입니다. 백엔드는 Better Auth 가 발급한 짧은 JWT 를 JWKS 로 검증합니다 ([ADR-0023](docs/adr/0023-better-auth-jwks.md)). 아래 "로그인 설정" 참조.
- 회사(워크스페이스) 소속은 앱 DB 가 관리합니다. 처음 로그인하면 **개인 워크스페이스**가 자동으로 생기고, 회사 관리자는 설정 → 멤버 관리에서 **이미 한 번 로그인한 사용자**를 이메일로 추가할 수 있습니다 (초대 메일·가입 전 초대는 아직 없음).
- 프론트엔드 UI 는 shadcn/ui(Radix + Tailwind 4) 기반 로컬 컴포넌트입니다 — `frontend/components/ui/`(shadcn 원본), `frontend/components/ui-custom/`(앱 프레임·사용자 메뉴·확인창·토스트 훅). 외부 비공개 패키지 의존은 없습니다.

## 기능

- **일정**: CRUD, 반복(RRULE, 회차별 수정·삭제), 드래그 이동·리사이즈, 내부 멤버·외부 게스트 초대(링크 RSVP), 회의실 예약(겹침 차단), CalDAV, 외부 ICS 구독
- **예약**: 외부 고객용 공개 예약 폼, 가용 슬롯 계산, 취소·변경
- **알림**: 인앱, 이메일(유형별 on/off), 웹훅, 시작 전 리마인더
- **관리**: 멤버·권한, SMTP, 예약 메일 템플릿, 감사 로그(CSV 내보내기), 잡 실행 모니터링

## 로컬 개발

```
make install           # frontend + backend 의존성
cp .env.example .env    # 포트·시크릿 필요 시 수정
make infra              # postgres(:15542), redis(:16489), mailpit(:18035), caldav(:18090), worker
make migrate            # DB 스키마 (Alembic)
make auth-migrate       # Better Auth 테이블 (Postgres 스키마 auth, Better Auth CLI)
```

앱은 각각 별도 터미널에서 띄웁니다.

```
make backend            # FastAPI  — http://localhost:8000 (BACKEND_PORT)
make frontend           # Next.js  — http://localhost:3000 (FRONTEND_PORT)
```

`frontend/.env` 는 `cp frontend/.env.example frontend/.env` 후 `BETTER_AUTH_SECRET` 을 채웁니다(`openssl rand -base64 32`). 브라우저에서 `http://localhost:3000` 에 접속해 `/login` 에서 Google/GitHub 로 로그인합니다. OAuth 앱 없이 로컬에서 써 보려면 `frontend/.env` 에 `AUTH_DEV_PASSWORD_LOGIN=true` 를 두면 이메일+비밀번호 DEV 로그인 폼이 나옵니다(운영 빌드에선 무시됨). 공휴일 캘린더를 자동으로 붙이려면 `.env` 에 `HOLIDAYS_ICS_URL` 을 지정합니다(기본은 비어 있어 생성하지 않음).

## 로그인 설정 (Better Auth)

프론트(`frontend/.env`)와 백엔드(루트 `.env`)가 같은 주소를 바라봐야 합니다.

| 위치 | 변수 | 설명 |
|------|------|------|
| frontend | `BETTER_AUTH_SECRET` | 32자 이상 무작위 (`openssl rand -base64 32`) |
| frontend | `BETTER_AUTH_URL` | 이 앱의 공개 주소 (예: `https://calendar.example.com`) |
| frontend | `DATABASE_URL` | 백엔드와 같은 Postgres (`postgresql://…`) — Better Auth 테이블은 스키마 `auth` |
| frontend | `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | 둘 다 있을 때만 "Google로 계속하기" 버튼 노출 |
| frontend | `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` | 둘 다 있을 때만 "GitHub로 계속하기" 버튼 노출 |
| 둘 다 | `ALLOWED_EMAILS` | 쉼표 구분 허용 이메일. **비워 두면 누구나 가입할 수 있습니다** (각자 개인 워크스페이스) |
| frontend | `AUTH_DEV_PASSWORD_LOGIN` | `true` 면 이메일+비밀번호 DEV 로그인 (로컬·E2E 전용, 운영에선 무시) |
| backend | `AUTH_JWKS_URL` | `${BETTER_AUTH_URL}/api/auth/jwks` |
| backend | `AUTH_ISSUER` / `AUTH_AUDIENCE` | 둘 다 `${BETTER_AUTH_URL}` |
| backend | `SYSTEM_ADMIN_EMAILS` | 쉼표 구분 System Admin 이메일 (선택) |

OAuth 앱의 콜백(리디렉션) URL:

- Google: `${BETTER_AUTH_URL}/api/auth/callback/google`
- GitHub: `${BETTER_AUTH_URL}/api/auth/callback/github`

**Google** — [Google Cloud Console](https://console.cloud.google.com/apis/credentials) → 사용자 인증 정보 → *OAuth 클라이언트 ID 만들기* → 유형 "웹 애플리케이션". *승인된 자바스크립트 원본*에 `BETTER_AUTH_URL`, *승인된 리디렉션 URI* 에 위 Google 콜백을 넣고, 발급된 ID/보안 비밀을 `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` 에 넣습니다. (처음이면 OAuth 동의 화면을 먼저 구성합니다.)

**GitHub** — GitHub → Settings → Developer settings → [OAuth Apps](https://github.com/settings/developers) → *New OAuth App*. *Homepage URL* 에 `BETTER_AUTH_URL`, *Authorization callback URL* 에 위 GitHub 콜백을 넣고, Client ID 와 새로 만든 Client secret 을 `GITHUB_CLIENT_ID`/`GITHUB_CLIENT_SECRET` 에 넣습니다. (GitHub OAuth App 은 콜백 URL 을 하나만 받으므로 로컬·운영은 앱을 따로 만듭니다.)

설정 후 `make auth-migrate` 로 Better Auth 테이블을 만들고(업그레이드 후에도 다시 실행) 프론트를 재시작합니다.

## 검증

```
make pytest        # 백엔드 테스트 (Postgres·Redis 필요 — make infra, 네트워크 불필요)
make vitest        # 프론트 단위·스토리북 테스트
make e2e           # Playwright (backend 기동 + frontend .env 에 AUTH_DEV_PASSWORD_LOGIN=true)
make typecheck     # 프론트 타입 체크
make lint          # 프론트 eslint + 백엔드 ruff
make ci-local      # 위 전체 + 프론트 빌드
```

전체 명령은 `make help`.
