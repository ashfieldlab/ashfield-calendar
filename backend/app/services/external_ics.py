"""외부 ICS 피드 구독 (ADR-0007).

흐름:
  1. HTTPS GET 으로 .ics 본문 fetch (5s 타임아웃, 5MB 상한)
  2. icalendar 로 VCALENDAR 파싱
  3. master VEVENT (RECURRENCE-ID 없는 것) → CalendarEvent row 1건씩 upsert (wipe-and-reload)
  4. RECURRENCE-ID 있는 VEVENT → master 의 recurrence_exceptions 에 그 시각 추가 (override 자체는 폐기)
  5. calendar.external_ics_refresh_at = now()

외부 캘린더의 이벤트는 read-only. 호출자가 직접 만들거나 수정/삭제하려 하면 422.
"""

from __future__ import annotations

import uuid
from datetime import UTC, date, datetime, time

import httpx
from fastapi import HTTPException
from icalendar import Calendar as IcsCalendar
from sqlalchemy import delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.logging import logger
from app.models.calendar import Calendar
from app.models.calendar_event import CalendarEvent

_MAX_BYTES = 5 * 1024 * 1024
_TIMEOUT = 5.0


async def _fetch(url: str) -> bytes:
    if not (url.startswith("http://") or url.startswith("https://")):
        raise HTTPException(400, "ICS URL must be http(s)")
    try:
        async with httpx.AsyncClient(timeout=_TIMEOUT, follow_redirects=True) as cli:
            r = await cli.get(url)
    except httpx.HTTPError as exc:
        raise HTTPException(502, f"ICS fetch failed: {exc}") from exc
    if r.status_code != 200:
        raise HTTPException(502, f"ICS fetch returned {r.status_code}")
    body = r.content
    if len(body) > _MAX_BYTES:
        raise HTTPException(413, "ICS feed too large (>5MB)")
    return body


def _to_utc(value: datetime | date) -> datetime:
    if isinstance(value, datetime):
        if value.tzinfo is None:
            return value.replace(tzinfo=UTC)
        return value.astimezone(UTC)
    # date — all_day. 자정으로 정규화
    return datetime.combine(value, time.min, tzinfo=UTC)


def _is_all_day(dtstart_raw) -> bool:
    return isinstance(dtstart_raw, date) and not isinstance(dtstart_raw, datetime)


def _extract_master_events(ics_body: bytes) -> list[dict]:
    cal = IcsCalendar.from_ical(ics_body)
    masters: dict[str, dict] = {}
    overrides: list[tuple[str, datetime]] = []  # (uid, recurrence-id)

    for comp in cal.walk("VEVENT"):
        uid = str(comp.get("UID") or "")
        if not uid:
            continue
        recurrence_id = comp.get("RECURRENCE-ID")
        if recurrence_id is not None:
            overrides.append((uid, _to_utc(recurrence_id.dt)))
            continue

        dtstart = comp.get("DTSTART")
        dtend = comp.get("DTEND")
        if dtstart is None:
            continue
        all_day = _is_all_day(dtstart.dt)
        start = _to_utc(dtstart.dt)
        if dtend is not None:
            end = _to_utc(dtend.dt)
        else:
            duration = comp.get("DURATION")
            if duration is not None:
                end = start + duration.dt
            elif all_day:
                end = start
            else:
                end = start

        rrule_field = comp.get("RRULE")
        rrule_text: str | None = None
        if rrule_field is not None:
            rrule_text = rrule_field.to_ical().decode("utf-8")

        exdates: list[str] = []
        exdate_field = comp.get("EXDATE")
        if exdate_field is not None:
            items = exdate_field if isinstance(exdate_field, list) else [exdate_field]
            for grp in items:
                for d in grp.dts:
                    exdates.append(_to_utc(d.dt).replace(microsecond=0).isoformat())

        masters[uid] = {
            "title": str(comp.get("SUMMARY") or "(제목 없음)"),
            "description": str(comp.get("DESCRIPTION") or "") or None,
            "location": str(comp.get("LOCATION") or "") or None,
            "start_at": start,
            "end_at": end,
            "all_day": all_day,
            "timezone": "UTC",
            "rrule": rrule_text,
            "recurrence_exceptions": exdates,
        }

    # RECURRENCE-ID override 는 master 의 exceptions 에 추가
    for uid, rid_utc in overrides:
        m = masters.get(uid)
        if m is None:
            continue
        key = rid_utc.replace(microsecond=0).isoformat()
        if key not in m["recurrence_exceptions"]:
            m["recurrence_exceptions"].append(key)

    return list(masters.values())


async def import_ics_bytes(
    db: AsyncSession, *, cal: Calendar, body: bytes, actor_sub: str
) -> int:
    """업로드된 ICS 본문을 native 캘린더에 1회성 import. 파일은 보관하지 않음."""
    if len(body) > _MAX_BYTES:
        raise HTTPException(413, "ICS file too large (>5MB)")
    masters = _extract_master_events(body)
    for m in masters:
        db.add(
            CalendarEvent(
                id=str(uuid.uuid7()),
                calendar_id=cal.id,
                title=m["title"],
                description=m["description"],
                location=m["location"],
                start_at=m["start_at"],
                end_at=m["end_at"],
                all_day=m["all_day"],
                timezone=m["timezone"],
                rrule=m["rrule"],
                recurrence_exceptions=m["recurrence_exceptions"],
                created_by_sub=actor_sub,
            )
        )
    logger.info(
        "ics_imported",
        extra={
            "category": "calendar",
            "calendar_id": cal.id,
            "events": len(masters),
        },
    )
    return len(masters)


async def refresh_external_calendar(
    db: AsyncSession, *, cal: Calendar, actor_sub: str
) -> int:
    """외부 ICS 캘린더의 이벤트를 wipe-and-reload 로 동기화. 반환: 새로 적재된 master event 수."""
    if cal.source != "external_ics" or not cal.external_ics_url:
        raise HTTPException(400, "Calendar is not an external ICS subscription")

    body = await _fetch(cal.external_ics_url)
    masters = _extract_master_events(body)

    # 기존 이벤트 모두 하드 삭제 (initial fetch + subsequent refresh 동일 동작)
    await db.execute(
        delete(CalendarEvent).where(CalendarEvent.calendar_id == cal.id)
    )

    for m in masters:
        db.add(
            CalendarEvent(
                id=str(uuid.uuid7()),
                calendar_id=cal.id,
                title=m["title"],
                description=m["description"],
                location=m["location"],
                start_at=m["start_at"],
                end_at=m["end_at"],
                all_day=m["all_day"],
                timezone=m["timezone"],
                rrule=m["rrule"],
                recurrence_exceptions=m["recurrence_exceptions"],
                created_by_sub=actor_sub,
            )
        )

    cal.external_ics_refresh_at = datetime.now(UTC)
    logger.info(
        "ics_refreshed",
        extra={
            "category": "calendar",
            "calendar_id": cal.id,
            "url": cal.external_ics_url,
            "events": len(masters),
        },
    )
    return len(masters)
