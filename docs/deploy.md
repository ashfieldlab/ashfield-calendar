# 운영 배포

앞단 리버스 프록시(다른 기계)가 TLS 를 받고 앱 서버의 LAN 포트로 넘긴다. 앱 서버에는 저장소 키를 두지 않고, 로컬에서 `git archive HEAD` 로 올린 뒤 서버의 `scripts/prod.sh` 가 docker compose(`docker-compose.prod.yml`)로 빌드하고 띄운다. 계정 서버(ashfield-account)를 먼저 배포한다.

| 항목 | 값 |
|---|---|
| 서버 | ssh 별칭 `ovm` (`DEPLOY_HOST`), 디렉터리 `~/ashfield/calendar` (`DEPLOY_DIR`) |
| 공개 주소 | `https://calendar.ashfieldlab.dev` (= `BETTER_AUTH_URL`, 계정 서버 `CALENDAR_URL`) |
| 계정 서버 | `https://account.ashfieldlab.dev` (`ACCOUNT_URL`), client secret 은 서버의 `~/ashfield/account/.secrets/clients.local.json` |
| 서버에만 있는 것 | `.env.prod`, `backups/` (업로드 때 지우지 않음) |

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
| `make deploy-init ADMIN_EMAIL=me@example.com` | 처음 한 번. 올리고 `.env.prod` 생성. DB 비밀번호, `BETTER_AUTH_SECRET`, `SMTP_ENCRYPTION_KEY` 는 서버에서 openssl 로, `ASHFIELD_CLIENT_SECRET` 은 계정 서버 파일에서. 출력하지 않는다. `ADMIN_EMAIL` 은 `SYSTEM_ADMIN_EMAILS` 로 |
| `make deploy` | 올리기, 이미지 빌드, Alembic, Better Auth 마이그레이션, 재시작 |
| `make deploy-ps`, `deploy-logs`, `deploy-backup` | 상태, 로그, Postgres 덤프(서버 `backups/`) |

커밋하지 않은 변경은 올라가지 않는다. 메일 발송은 `SMTP_ENABLED=false` (보내지 않고 로그만).
