"""캘린더 알림 디스패처 — 매 분 cron.

전략:
  1. reminder_minutes_before 가 설정된 모든 이벤트 후보 fetch (deleted 제외).
     단일(rrule=NULL) 이벤트는 start_at 으로 lookback 윈도우 만큼 좁힘.
     반복 이벤트는 전체 — expand_event 가 다음 occurrence 만 추림.
  2. 각 후보에 대해 expand_event(range=[T + N - lookback, T + N + lookahead]).
     N = reminder_minutes_before.
  3. 각 occurrence 에 대해 dispatches PK insert 시도.
     - 충돌(ON CONFLICT DO NOTHING) → 이미 보냈음, skip.
     - 성공 → 수신자(작성자 + 초대 accepted/pending/tentative)에 Notification insert.

워커 다운/재시작 대비로 lookback=5분 (cron 1분 간격이지만 안전 마진).
멱등성은 dispatches PK 가 보장 → 같은 occurrence 가 여러 cron 사이클에서 재처리돼도
Notification 은 1번만 생성됨.
"""

from datetime import UTC, datetime, timedelta

from sqlalchemy import or_, select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import AsyncSessionLocal
from app.core.logging import logger
from app.models.calendar import Calendar
from app.models.calendar_event import CalendarEvent
from app.models.calendar_event_invitation import CalendarEventInvitation
from app.models.calendar_event_reminder_dispatch import (
    CalendarEventReminderDispatch,
)
from app.services.calendars import expand_event
from app.services.email import send_for_event
from app.services.notifications import emit_notification

LOOKBACK = timedelta(minutes=5)
LOOKAHEAD = timedelta(seconds=60)
MAX_REMINDER_MINUTES = 10080  # 1주 — schema ge/le 와 동일


async def _recipients(db: AsyncSession, ev: CalendarEvent) -> set[str]:
    """이벤트 작성자 + 초대 응답이 declined 가 아닌 사용자."""
    subs: set[str] = {ev.created_by_sub}
    rows = (
        await db.execute(
            select(CalendarEventInvitation.invitee_sub).where(
                CalendarEventInvitation.event_id == ev.id,
                CalendarEventInvitation.response != "declined",
            )
        )
    ).scalars().all()
    subs.update(rows)
    return subs


async def _dispatch_one(
    db: AsyncSession,
    ev: CalendarEvent,
    cal: Calendar,
    occurrence_start: datetime,
    email_jobs: list[tuple[str, str, dict]],
) -> bool:
    """dispatch row insert + in-app 알림 발송. 이메일은 email_jobs 에 적재 (commit 후).
    email_jobs entry = (recipient_sub, company_id, payload).
    이미 보낸 occurrence 면 False 반환."""
    stmt = (
        pg_insert(CalendarEventReminderDispatch)
        .values(event_id=ev.id, occurrence_start=occurrence_start)
        .on_conflict_do_nothing(constraint="pk_reminder_dispatch")
        .returning(CalendarEventReminderDispatch.event_id)
    )
    inserted = (await db.execute(stmt)).first()
    if inserted is None:
        return False

    recipients = await _recipients(db, ev)
    payload = {
        "title": ev.title,
        "location": ev.location,
        "occurrence_start": occurrence_start.isoformat(),
        "minutes_before": ev.reminder_minutes_before,
        "calendar_id": cal.id,
    }
    for sub in recipients:
        await emit_notification(
            db,
            recipient_sub=sub,
            company_id=cal.company_id,
            actor_sub=None,  # 시스템 발송 — 본인에게도 가야 함
            type_="event_reminder",
            entity_type="event",
            entity_id=ev.id,
            payload=payload,
        )
        email_jobs.append((sub, cal.company_id, payload))
    return True


async def dispatch_due_reminders(ctx: dict) -> int:
    """cron 매 분 호출. 발송한 Notification 수 반환 (로그용).

    in-app Notification + 이메일 둘 다 발송. 이메일 resolve 우선순위:
      company override (cal.company_id) → system DB → env.
    수신자의 UserNotificationPreference.email_enabled=False 면 이메일 skip.
    """
    now = datetime.now(UTC)
    bound_lo = now - timedelta(minutes=MAX_REMINDER_MINUTES) - LOOKBACK
    # (recipient_sub, company_id, payload) commit 후 발송
    email_jobs: list[tuple[str, str, dict]] = []

    async with AsyncSessionLocal() as db:
        # 후보: reminder 설정 + 활성. 단일 이벤트는 start_at 기준으로 멀리 미래/과거 컷.
        rows = (
            await db.execute(
                select(CalendarEvent, Calendar)
                .join(Calendar, Calendar.id == CalendarEvent.calendar_id)
                .where(
                    CalendarEvent.reminder_minutes_before.is_not(None),
                    CalendarEvent.deleted_at.is_(None),
                    or_(
                        CalendarEvent.rrule.is_not(None),
                        CalendarEvent.start_at >= bound_lo,
                    ),
                )
            )
        ).all()

        sent = 0
        for ev, cal in rows:
            n = ev.reminder_minutes_before or 0
            window_lo = now + timedelta(minutes=n) - LOOKBACK
            window_hi = now + timedelta(minutes=n) + LOOKAHEAD
            occs = expand_event(ev, range_from=window_lo, range_to=window_hi)
            for occ in occs:
                if await _dispatch_one(db, ev, cal, occ["start_at"], email_jobs):
                    sent += 1
        if sent:
            await db.commit()
            logger.info(
                "event_reminders_dispatched",
                extra={"category": "biz", "count": sent},
            )
        else:
            await db.rollback()

    # commit 후 이메일 발송 — 실패해도 dispatch row 는 남음 (재시도 X, in-app 은 정상).
    for recipient_sub, company_id, payload in email_jobs:
        await send_for_event(
            recipient_sub=recipient_sub,
            actor_sub=None,
            event_type="event_reminder",
            payload=payload,
            company_id=company_id,
        )
    return sent
