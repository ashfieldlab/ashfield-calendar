# 즉시 등록 약속 모델: RSVP 컨펌 흐름 폐기

## 컨텍스트

외부 고객 예약 기능을 도입한다 (BookingType / Booking: CONTEXT.md). 표준 흐름은 두 갈래:

**A. 컨펌 메일 흐름** (Nextcloud Appointments)
1. 고객 폼 제출
2. 시스템이 confirm 토큰 메일 발송
3. 고객이 메일의 링크 클릭
4. 그제서야 CalendarEvent INSERT

**B. 즉시 등록 흐름** (cal.com / Calendly)
1. 고객 폼 제출
2. 즉시 CalendarEvent INSERT + 안내 메일 발송

## 결정

**B 채택**: 즉시 등록.

```
[공개 페이지] /book/{public_key}
   │
   │ 슬롯 선택 + 이름·이메일·(선택)메시지 + 동의 체크
   ▼
[POST /api/public/v1/booking/submit]
   │ ① honeypot · rate limit · 동의 검증
   │ ② Postgres advisory lock (event_type_id, slot_start)
   │ ③ 충돌 검사 (existing Booking + blocking_calendar 이벤트)
   │ ④ Booking + CalendarEvent INSERT (한 트랜잭션)
   │ ⑤ 운영자에게 in-app + 이메일 (기존 SMTP resolve)
   │ ⑥ 고객에게 안내 이메일 ("예약 접수했습니다: 일시·취소 링크")
   ▼
"감사합니다: 안내 메일 발송했습니다" 페이지
```

## 왜 A 를 안 채택했나

| Nextcloud A 의 명분 | 우리 B 에서의 대응 |
|---|---|
| 이메일 owner 검증 (위장 등록 방지) | rate limit (이메일 분당 1개) + 잘못된 이메일은 어차피 운영자가 사후 인지 (메일 bounce). B2B 예약 시나리오에선 위장 등록 동기 낮음. |
| 봇/스팸 차단 | Honeypot + rate limit. 어뷰즈 늘어나면 Turnstile 활성 (env flag). cal.com·SavvyCal 등 시장 검증 |
| GDPR/PIPA 명시 동의 | 폼 안 동의 체크박스 1개 (필수). 미동의 시 제출 차단. agreed_at 컬럼에 시각 기록 |
| 취소·변경 채널 전달 | 즉시 등록 후 보내는 안내 메일에 cancel 토큰 동봉 (응답 메일이 곧 토큰 운반체) |

→ A 의 모든 가치는 다른 메커니즘으로 회수 가능. 그 비용:
- 사용자 마찰 1단계 ↓ (메일 확인·클릭 생략)
- 이메일 인박스 접근 지연으로 인한 예약 누락 0
- "메일이 안 와요" 컴플레인 줄 (스팸 폴더·도메인 차단 등)

## 즉시 등록의 race condition

같은 슬롯 동시 클릭 → 둘 다 INSERT 시도. capacity 따라 두 메커니즘:

- **capacity=1**: `UNIQUE (booking_type_id, slot_start_at)` constraint. 두 번째 INSERT → IntegrityError → 클라이언트 409 + 슬롯 새로고침 안내
- **capacity>1**: `pg_advisory_xact_lock(hash(booking_type_id, slot_start))` + `SELECT count(*) < capacity` + INSERT 한 트랜잭션. 락은 트랜잭션 종료 시 자동 해제

## 동의·보관

PIPA 제15조 4 항목(수집 항목·이용 목적·보관 기간·거부 권리)을 폼 안에 인라인 표시. 별도 약관 페이지 X: 회사 측 부담 최소화. 동의 미체크 시 제출 차단. `Booking.agreed_at` 에 timestamp 기록.

보관 기간은 `slot_end_at + 30일`. `purge_expired_booking_pii` cron (기존 trash purge 패턴) 이 매일 1회 만료 row 의 `customer_name/customer_email/message/cancel_token` NULL 로 마스킹: row 자체는 통계용 보존.

## 대안

### A. 컨펌 메일 흐름 (Nextcloud)
- 이메일 검증 자연: 하지만 사용자 마찰·예약 누락이 단점
- 마케팅 부서의 일관된 불만 (Nextcloud GitHub issue 다수)
- 기각

### C. 운영자 사후 승인 (= 리드 폼)
- 고객 신청 → "검토 후 연락" → 운영자가 캘린더에 수동 등록
- "확정 슬롯" 가치를 안 줌. 우리 시나리오와 본질 다름
- 별도 phase 에 LeadForm 으로 추가 가능 (BookingType 와 별개)

### D. 이메일 OTP 후 등록
- 외부 SaaS 거의 안 함. 시장 검증 X
- 기각

## 의도된 결과

- 외부 고객의 예약 마찰 최소
- 우리 알림·SMTP·audit 인프라 재사용 (별도 시스템 X)
- 데이터 통제 우리 손 안에 (cal.com·Calendly 같은 외부 SaaS 의존 0)

## 영향

- `app/models/booking_type.py`, `app/models/booking.py` 신규
- `app/api/public_router.py` 안의 `booking` 모듈
- `app/api/v1/booking_types.py` (운영자 CRUD)
- `app/services/booking.py` (slot 계산 + 충돌 검사 + 트랜잭션)
- `app/jobs/purge_booking_pii.py` cron
- email template `booking_received` (고객용) + `booking_received_operator` (운영자용)
- frontend `/book/{public_key}` 공개 페이지 + `/cancel/{token}` 페이지
- frontend 운영자 페이지: BookingType CRUD + 공개 URL 복사 + Booking 목록

## 참고

- ADR-0007: 캘린더 모델 (Booking 이 여기 CalendarEvent 로 매핑)
- ADR-0010: 회사 admin 권한 (BookingType.owner_type=company 인 경우 require_company_admin)
- ADR-0011: 공개 라우트 카브-아웃 (이 모델이 위에서 동작)
