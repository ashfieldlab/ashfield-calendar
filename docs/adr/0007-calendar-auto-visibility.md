# 캘린더: multi-calendar + 자동 가시성 (Nextcloud ICS 구독 패턴 폐기)

Calendar는 별도 엔티티 (Google Calendar 패턴). 사용자 한 명은 여러 캘린더 보유 가능: 워크스페이스 캘린더는 **명시적 구독 액션 없이 자동 노출**.

## Nextcloud 문제

Nextcloud는 ICS URL 기반 공유. 워크스페이스 admin이 캘린더 만들고 URL 안내해도 각 멤버가 일일이 구독해야 함. 신규 입사자가 모든 팀 캘린더를 매번 다시 구독 셋업. 직관 X.

## 우리 모델

`calendars.scope`가 `personal | shared`:
- `personal`: owner만 자기 사이드바에 노출.
- `shared`: **같은 workspace의 모든 멤버 자동 노출**. 구독 액션 0.

신규 멤버가 워크스페이스에 추가되면 (JWT.groups 업데이트) → 해당 워크스페이스의 shared 캘린더 모두 자동 가시.

## 외부 ICS 구독도 통합

`calendars.source: 'native' | 'external_ics'` 컬럼:
- `external_ics`: 외부 URL 주기적 fetch, readonly
- `scope='shared' + source='external_ics'` 조합 가능: 한 사용자가 외부 공휴일 ICS 구독해서 워크스페이스 전체에 자동 노출. Nextcloud엔 없는 시나리오.

## UI

Google Calendar 스타일 사이드바, 체크박스 hidden 토글:
- 자동 가시 + 본인이 안 보고 싶으면 `user_calendar_preferences.hidden=true`
- 구독은 자동, 숨김만 수동: 반대 방향.

## Phase

- **Phase 1**: native multi-calendar, personal/shared scope, 자동 가시성, hidden 토글
- **Phase 1.5**: 캘린더별 권한 세분화, 명시적 사용자 간 공유, 이벤트 초대와 참석자
- **Phase 2**: 외부 ICS inbound 구독, ICS export, 그룹 단위 가시성, 알림
