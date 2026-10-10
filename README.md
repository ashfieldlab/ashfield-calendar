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

- 로그인은 [Ashfield 계정 서버](https://github.com/ashfieldlab/ashfield-account)(OIDC)를 통한 SSO 입니다. 한 번 로그인하면 Calendar·Drive 를 오갈 때 다시 로그인하지 않습니다 ([ADR-0024](docs/adr/0024-account-server-sso.md)).
- 워크스페이스 소속과 멤버 관리는 계정 서버가 맡고, 앱은 로그인 토큰으로 소속을 동기화합니다.
- 프론트엔드 UI 는 shadcn/ui(Radix + Tailwind 4) 기반 로컬 컴포넌트입니다 — `frontend/components/ui/`(shadcn 원본), `frontend/components/ui-custom/`(앱 프레임·사용자 메뉴·확인창·토스트 훅). 외부 비공개 패키지 의존은 없습니다.

## 기능

- **일정**: CRUD, 반복(RRULE, 회차별 수정·삭제), 드래그 이동·리사이즈, 내부 멤버·외부 게스트 초대(링크 RSVP), 회의실 예약(겹침 차단), CalDAV, 외부 ICS 구독
- **예약**: 외부 고객용 공개 예약 폼, 가용 슬롯 계산, 취소·변경
- **알림**: 인앱, 이메일(유형별 on/off), 웹훅, 시작 전 리마인더
- **관리**: 멤버·권한, SMTP, 예약 메일 템플릿, 감사 로그(CSV 내보내기), 잡 실행 모니터링

## 로컬 개발

Ashfield 계정 서버(`ashfield-account`, http://localhost:3300)를 먼저 띄운 뒤 이 앱을 띄웁니다. 웹 3100, 백엔드 8100 을 씁니다.
설치 순서, 환경 변수, 포트 표, E2E 전제는 [docs/local-dev.md](docs/local-dev.md) 에 있습니다.

## 검증

```
make pytest        # 백엔드 테스트
make vitest        # 프론트 단위·스토리북 테스트
make e2e           # Playwright (계정 서버 필요, docs/local-dev.md)
make typecheck     # 프론트 타입 체크
make lint          # 프론트 eslint + 백엔드 ruff
make ci-local      # 위 전체 + 프론트 빌드
```

전체 명령은 `make help`.
