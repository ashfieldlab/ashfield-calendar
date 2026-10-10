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

- **인증은 현재 dev 모드만 지원합니다** (`SKIP_AUTH=true`, `/login` 에서 dev 사용자 선택). 기존 운영 인증 경로(외부 인증 게이트웨이 세션)는 Auth.js + Google/GitHub 로그인으로 교체할 예정입니다.
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
make migrate            # DB 스키마
```

앱은 각각 별도 터미널에서 띄웁니다.

```
make backend            # FastAPI  — http://localhost:8000 (BACKEND_PORT)
make frontend           # Next.js  — http://localhost:3000 (FRONTEND_PORT)
```

브라우저에서 `http://localhost:3000` 에 접속해 `/login` 에서 dev 사용자를 고릅니다. 공휴일 캘린더를 자동으로 붙이려면 `.env` 에 `HOLIDAYS_ICS_URL` 을 지정합니다(기본은 비어 있어 생성하지 않음).

## 검증

```
make pytest        # 백엔드 테스트 (Postgres·Redis 필요 — make infra)
make typecheck     # 프론트 타입 체크
make lint          # 프론트 eslint + 백엔드 ruff
make ci-local      # 위 전체 + 프론트 빌드
```

전체 명령은 `make help`.
