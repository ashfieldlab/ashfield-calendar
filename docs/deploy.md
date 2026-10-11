# 운영 배포

앞단 리버스 프록시(다른 기계)가 TLS 를 받고 앱 서버의 LAN 포트로 넘긴다. 앱 서버는 GitHub `origin/main` 을 레포 전용 읽기 전용 deploy key 로 직접 받고, 서버의 `scripts/prod.sh` 가 docker compose(`docker-compose.prod.yml`)로 빌드하고 띄운다. 로컬 `make deploy` 는 ssh 로 이 과정을 실행할 뿐이라, 배포되는 것은 로컬 `HEAD` 가 아니라 push 된 `main` 이다. 계정 서버(ashfield-account)를 먼저 배포한다.

| 항목 | 값 |
|---|---|
| 서버 | ssh 별칭 `ovm` (`DEPLOY_HOST`), 디렉터리 `~/ashfield/calendar` (`DEPLOY_DIR`) |
| 공개 주소 | `https://calendar.ashfieldlab.dev` (= `BETTER_AUTH_URL`, 계정 서버 `CALENDAR_URL`) |
| 계정 서버 | `https://account.ashfieldlab.dev` (`ACCOUNT_URL`), client secret 은 서버의 `~/ashfield/account/.secrets/clients.local.json` |
| 서버에만 있는 것 | `.env.prod`, `backups/` (git 이 추적하지 않아 배포 때 그대로 남음) |

## 포트와 프록시

| 서버 포트 | 서비스 | 프록시 경로 |
|---|---|---|
| `3100` | frontend (Next.js, BFF) | 나머지 전부 |
| `3101` | caldav-nginx (Sabre/DAV) | `/caldav/*`, `/.well-known/caldav` |
| 없음 | backend, worker, postgres, redis, caldav-php | 내부 네트워크만 (backend 는 BFF 만 부른다) |

CalDAV 주소는 `https://calendar.ashfieldlab.dev/caldav/` (설정 > 외부 캘린더 앱).

## 명령 (로컬)

| 명령 | 하는 일 |
|---|---|
| `make deploy-git-init` | 처음 한 번 (서버마다). 서버에 deploy key(`~/.ssh/deploy_<repo>`)와 ssh 별칭(`github-<repo>`)을 만들고 배포 디렉터리를 GitHub 체크아웃으로 바꾼다. 키가 등록 안 됐으면 공개 키를 출력한다: GitHub 레포 Settings > Deploy keys 에 쓰기 권한 없이 등록하고 다시 실행 |
| `make deploy-init ADMIN_EMAIL=me@example.com` | 처음 한 번. GitHub 에서 받고 `.env.prod` 생성. DB 비밀번호, `BETTER_AUTH_SECRET`, `SMTP_ENCRYPTION_KEY` 는 서버에서 openssl 로, `ASHFIELD_CLIENT_SECRET` 은 계정 서버 파일에서. 출력하지 않는다. `ADMIN_EMAIL` 은 `SYSTEM_ADMIN_EMAILS` 로 |
| `make deploy` | GitHub `origin/main` 받기, 이미지 빌드, Alembic, Better Auth 마이그레이션, 재시작 |
| `make deploy-ps`, `deploy-logs`, `deploy-backup` | 상태, 로그, Postgres 덤프(서버 `backups/`) |

push 하지 않은 커밋은 배포되지 않는다 (`make deploy` 가 경고). 서버에서 추적 파일을 직접 고치면 다음 배포가 덮어쓴다. 메일 발송은 `SMTP_ENABLED=false` (보내지 않고 로그만).
