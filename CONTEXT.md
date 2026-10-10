# ashfield-calendar

멀티테넌트 일정·예약 앱. 파일 앱(ashfield-drive)과는 레포·백엔드·DB가 별개. FastAPI + Next.js, 워크스페이스(Tenant) 단위 격리.

로그인은 앱 안의 Better Auth(Google·GitHub)가 담당하고, 백엔드는 Better Auth JWT 를 JWKS 로 검증한다 (ADR-0023). 워크스페이스 소속은 로컬 DB 가 원천: 첫 로그인 시 개인 워크스페이스가 자동으로 생긴다 (ADR-0004).

## Language

**Workspace**:
워크스페이스(Tenant) 단위 데이터 영역. 한 사용자가 여러 워크스페이스에 속하면 워크스페이스 전환마다 다른 캘린더·예약을 봄.

**Calendar**:
이벤트들의 그룹. 사용자별 multi-calendar (예: "일반", "휴가"). `calendars.scope`로 personal/shared 구분. shared면 워크스페이스 멤버 자동 노출: 별도 구독 액션 불필요 (ADR-0007).

**Event**:
Calendar 안의 일정 항목. `calendar_events`. 시간(UTC + timezone), 반복(RRULE), 종일 여부 등.

**RRULE**:
반복 규칙. iCalendar RFC 5545 표준 문자열. 예: `FREQ=WEEKLY;BYDAY=MO,WE,FR`. 백엔드가 dateutil로 풀어서 표시 범위 occurrence 반환.

**Busy (바쁨)**:
그 시간에 업무 일정이 있다는 사실. 업무 일정 = 수락했거나 아직 응답하지 않은 초대, 본인이 워크스페이스 캘린더에 올린 일정, 본인이 주최한 회의. 개인 캘린더의 일정과 공휴일·외부 구독 캘린더는 사람을 바쁘게 만들지 않는다. 참석자 초대 시 겹침 경고에만 쓰고, 일정 제목은 드러내지 않는다.
_Avoid_: "free/busy" (개인 캘린더까지 보는 일반 개념과 혼동)

**Room (회의실)**:
워크스페이스가 관리하는 예약 가능한 물리 자원 (회의실 등). Event 가 `room_id` 로 **참조만** 함: 특정 Calendar 에 묶이지 않는다(어느 캘린더의 Event 든 Room 을 점유). 같은 Room 을 시간 겹치게 잡으면 **저장 차단**(이중예약 불가). 기존 그룹웨어의 "resource"가 방을 캘린더/attendee 로 강제해 까다로웠던 것을 대체: Room 은 이벤트가 가리키는 가벼운 목록.
_Avoid_: "Resource"(모호), "Location"(Event.location 자유텍스트와 구분: Room 은 구조화된 워크스페이스 자원)

**External ICS** (Phase 2):
외부 ICS URL을 우리 캘린더로 구독. 주기적 fetch, readonly. `calendars.source='external_ics'`. `scope='shared'`로 만들면 워크스페이스 전체 자동 노출.

**BookingType**:
외부 고객이 우리 일정에 예약할 수 있는 양식. 운영자가 정의: 가용 시간(weekly_schedule), duration, capacity, target_calendar, blocking_calendar_ids, notify_user_subs 등. owner 는 user 또는 workspace. UI 표기는 "예약 종류" / "예약 양식".
_Avoid_: "EventType" (우리 Event 와 혼동), "Appointment" (UI 톤 회피)

**Booking**:
외부 고객이 제출한 예약 한 건. 이름·이메일·메시지·동의시각 + 자동 생성된 CalendarEvent.id FK + cancel_token. PIPA 의무로 slot 종료+30일 후 개인정보 필드 자동 마스킹. UI 표기는 "예약".

**Slot**:
BookingType 의 가용 규칙에서 계산되는 예약 가능 시간 단위. **저장 안 됨**: 매 요청 시 계산. `(weekly_schedule × duration) − (이미 잡힌 Booking + blocking_calendar_ids 의 일정)`.

**공개 라우트** (Public Route):
`/api/public/v1/*` 아래 비인증 라우트. "검증된 신원만 신뢰" 원칙의 명시적 카브-아웃 (ADR-0011). booking 폼·슬롯 조회·취소 등 외부 고객 대상. CAPTCHA(향후) + honeypot + rate limit + audit log(actor_type="public") 의무.

**즉시 등록 모델** (Instant Booking):
고객이 슬롯 선택 → 컨펌 메일 단계 없이 즉시 Booking + CalendarEvent INSERT + "감사합니다" 안내 메일 발송. 컨펌 메일 기반 RSVP 흐름과 대비 (ADR-0012). 봇 방어는 별도 계층(honeypot/rate limit).

**Audit Log**:
사용자·외부 링크의 mutation 행동 기록. `audit_logs`. Phase 1엔 create/update/delete/restore/share/unshare 만. read는 기록 안 함.

## Relationships

- **Workspace**: 테넌트. 계정 서버 워크스페이스와 1:1 (`workspaces.account_workspace_id`)
- 한 **User**는 1~N개의 **Workspace**에 속함 (`user_workspace_memberships`). 소속의 원천은 Ashfield 계정 서버: 가입 때 개인 워크스페이스가 생기고, 초대·역할은 계정 서버에서 관리한다. 앱은 토큰 `workspaces` 클레임으로 로컬 멤버십을 동기화한다 (owner·admin → admin, member → member, ADR-0024).
- 한 **User**는 한 **Workspace** 안에 N개의 personal **Calendar** 보유 가능
- **Workspace** 안에 N개의 shared **Calendar**: 워크스페이스 전 멤버 자동 노출
- **Event**는 한 **Calendar**에 속함
- **BookingType** 의 owner 는 **User** 또는 **Workspace**. 1 BookingType → N **Booking**.
- **Booking** 은 1 **CalendarEvent** 와 1:1 매핑 (생성·취소 같이 처리). target_calendar 는 BookingType 이 지정.
- **Slot** 은 엔티티 아님: BookingType 에서 매 요청 시 계산.

## Flagged ambiguities

- "**Workspace**"는 테넌트 단위. UI 측은 "현재 워크스페이스", "활성 워크스페이스"로 호칭.
- "**캘린더 공유**"는 Phase 1엔 `scope='shared'`만 의미. Phase 1.5에 명시 grant 도입.
- "**예약**"이 (1) 외부 고객의 Booking (2) 운영자가 본인 캘린더에 만든 일정 두 가지로 호칭될 수 있음. 본 문서는 (1)만 Booking, (2)는 Event 로 명확 구분. 한국어 UI 도 일관: "예약 양식" 은 BookingType, "예약" 은 Booking, 운영자 직접 입력은 "일정".
- "**Admin**" 이 (1) System Admin (`users.is_system_admin` 또는 `SYSTEM_ADMIN_EMAILS`) (2) `user_workspace_memberships.role='admin'` = Workspace Admin 두 축. UI 에서 "관리자"라고 단독 호칭 시엔 (1) 디폴트, "워크스페이스 관리자"는 (2).
- "**알림**" 이 (1) NotificationBell in-app (`Notification` 테이블) (2) 이메일 발송 (`send_for_event`) (3) Webhook 발송 (4) 캘린더 reminder cron 네 채널 다 의미. emit 시 셋 다 자동 fan-out 되도록 dispatcher 가 묶음: 직접 호출 X.
