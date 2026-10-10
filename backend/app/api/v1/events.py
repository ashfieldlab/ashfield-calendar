"""/api/v1/events: 일정 CRUD + 범위 occurrence 조회 + .ics export + 초대.

반복 일정은 RFC 5545 RRULE 텍스트로 저장. `GET /events?from=&to=` 는 dateutil 로
구간을 expand 한 occurrence 목록을 반환 (마스터 event 가 아니라 발생 인스턴스).

초대받은 이벤트는 본인이 접근 권한 없는 캘린더의 일정이라도 occurrence 목록에 포함.
declined 응답은 제외.

source=external_ics 캘린더의 이벤트는 read-only: `POST/PATCH/DELETE` 모두 422.
"""

from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from icalendar import Calendar as IcsCalendar
from icalendar import Event as IcsEvent
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.context import UserContext
from app.auth.dependencies import get_current_user, require_active_company
from app.core.db import get_db
from app.core.errors import BusinessError
from app.models.booking import Booking
from app.models.calendar_event import CalendarEvent
from app.models.calendar_event_invitation import CalendarEventInvitation
from app.models.company import Company
from app.models.user import User
from app.schemas.calendar import (
    AttendeeConflict,
    AttendeeConflictsRequest,
    AttendeeConflictsResponse,
    EventCreate,
    EventInvitationCreate,
    EventInvitationList,
    EventInvitationPatch,
    EventInvitationResponse,
    EventOccurrence,
    EventPatch,
    EventResponse,
    OccurrenceListResponse,
)
from app.services import email
from app.services.attendee_conflicts import busy_subs
from app.services.audit import write_audit
from app.services.calendars import (
    assert_calendar_access,
    get_calendar_or_404,
    get_event_with_calendar_or_404,
    list_occurrences,
    new_id,
)
from app.services.notifications import PendingDispatch, notify
from app.services.rooms import assert_room_free

router = APIRouter(prefix="/events", tags=["events"])


def _to_response(ev: CalendarEvent, *, booking_id: str | None = None) -> EventResponse:
    resp = EventResponse.model_validate(ev, from_attributes=True)
    if booking_id is not None:
        resp.booking_id = booking_id
    return resp


async def _booking_id_for_event(db: AsyncSession, event_id: str) -> str | None:
    """이 event 가 booking 으로부터 생성된 거면 booking.id, 아니면 None."""
    stmt = select(Booking.id).where(Booking.calendar_event_id == event_id)
    return (await db.execute(stmt)).scalar_one_or_none()


async def _assert_not_booking_linked(db: AsyncSession, event_id: str) -> None:
    """예약-연결 캘린더 이벤트는 캘린더 화면에서 직접 편집·삭제 불가.

    Why: booking 과 event 가 어긋나면 고객은 예전 시간으로 안내받고 운영자는 새 시간을
    보는 데이터 분기 위험. 변경은 예약 페이지의 'reschedule', 삭제는 예약 취소를 통해서만.
    """
    bid = await _booking_id_for_event(db, event_id)
    if bid is not None:
        raise BusinessError(
            "EVENT_LINKED_TO_BOOKING",
            status=409,
            message="예약과 연결된 일정입니다. 예약 페이지에서 변경·취소해주세요.",
            params={"booking_id": bid},
        )


def _event_to_vevent(ev: CalendarEvent) -> IcsEvent:
    """CalendarEvent row → RFC 5545 VEVENT (단건/일괄 ics 공용)."""
    from icalendar.prop import vRecur

    vevent = IcsEvent()
    vevent.add("uid", f"{ev.id}@ashfield.local")
    vevent.add("summary", ev.title)
    if ev.description:
        vevent.add("description", ev.description)
    if ev.location:
        vevent.add("location", ev.location)
    vevent.add("dtstart", ev.start_at)
    vevent.add("dtend", ev.end_at)
    vevent.add("dtstamp", datetime.now(UTC))
    if ev.rrule:
        vevent.add("rrule", vRecur.from_ical(ev.rrule))
    for exc_iso in ev.recurrence_exceptions or []:
        try:
            vevent.add("exdate", datetime.fromisoformat(exc_iso))
        except ValueError:
            continue
    return vevent


@router.post(
    "/conflicts",
    response_model=AttendeeConflictsResponse,
    summary="참석자 일정 겹침: 업무 일정끼리만, 겹치는 사람만 (제목 비노출)",
)
async def attendee_conflicts(
    body: AttendeeConflictsRequest,
    user: UserContext = Depends(get_current_user),
    company_id: str = Depends(require_active_company),
    db: AsyncSession = Depends(get_db),
) -> AttendeeConflictsResponse:
    busy = await busy_subs(
        db,
        company_id=company_id,
        subs=body.attendee_subs,
        start=body.start_at,
        end=body.end_at,
        exclude_event_id=body.exclude_event_id,
    )
    names = {
        u.id: u.name or u.email
        for u in (await db.execute(select(User).where(User.id.in_(busy)))).scalars()
    }
    return AttendeeConflictsResponse(
        conflicts=[AttendeeConflict(sub=s, name=names.get(s)) for s in sorted(busy)]
    )


@router.get(
    "",
    response_model=OccurrenceListResponse,
    summary="[from, to) 범위 occurrence 풀어서 반환",
    responses={
        400: {"description": "범위 잘못됨 (to <= from) 또는 400일 초과"},
    },
)
async def list_events(
    from_: datetime = Query(..., alias="from", description="ISO datetime (tz-aware)"),
    to: datetime = Query(..., description="ISO datetime. 400일 이내."),
    calendar_ids: list[str] | None = Query(
        None,
        description="특정 캘린더만 조회. 미지정 시 가시 캘린더 전부.",
    ),
    user: UserContext = Depends(get_current_user),
    company_id: str = Depends(require_active_company),
    db: AsyncSession = Depends(get_db),
) -> OccurrenceListResponse:
    """반환 = expand 된 occurrence 평탄 목록. 반복 이벤트는 occurrence 수만큼 row.

    series 식별자는 `event_id`. occurrence 식별자는 `(event_id, start_at)`.
    """
    items = await list_occurrences(
        db,
        company_id=company_id,
        user=user,
        range_from=from_,
        range_to=to,
        calendar_ids=calendar_ids,
    )
    return OccurrenceListResponse(
        occurrences=[EventOccurrence(**x) for x in items]
    )


@router.post(
    "",
    response_model=EventResponse,
    status_code=201,
    summary="일정 생성",
    responses={
        422: {"description": "external_ics 캘린더: read-only"},
        400: {"description": "end_at < start_at"},
        403: {"description": "캘린더 write 권한 없음"},
    },
)
async def create_event(
    body: EventCreate,
    user: UserContext = Depends(get_current_user),
    company_id: str = Depends(require_active_company),
    db: AsyncSession = Depends(get_db),
) -> EventResponse:
    cal = await get_calendar_or_404(db, body.calendar_id)
    assert_calendar_access(cal, user=user, company_id=company_id, permission="write")
    if cal.source != "native":
        raise HTTPException(422, "Cannot add events to a non-native calendar")
    # 회의실 지정 시 이중예약 차단 (ADR-0019)
    if body.room_id:
        await assert_room_free(
            db,
            room_id=body.room_id,
            start_at=body.start_at,
            end_at=body.end_at,
            company_id=company_id,
        )
    ev = CalendarEvent(
        id=new_id(),
        calendar_id=cal.id,
        title=body.title,
        description=body.description,
        location=body.location,
        start_at=body.start_at,
        end_at=body.end_at,
        all_day=body.all_day,
        timezone=body.timezone,
        rrule=body.rrule,
        recurrence_exceptions=[],
        reminder_minutes_before=body.reminder_minutes_before,
        room_id=body.room_id,
        created_by_sub=user.sub,
    )
    db.add(ev)
    await write_audit(
        db,
        company_id=company_id,
        actor=user,
        action="create",
        entity_type="event",
        entity_id=ev.id,
        meta={"calendar_id": cal.id, "title": ev.title},
    )
    await db.commit()
    await db.refresh(ev)
    return _to_response(ev)


@router.get(
    "/{event_id}/ics",
    summary=".ics 단건 다운로드 (RFC 5545)",
    responses={
        200: {"content": {"text/calendar": {}}, "description": ".ics 본문"},
        404: {"description": "이벤트 없음"},
    },
)
async def export_event_ics(
    event_id: str,
    user: UserContext = Depends(get_current_user),
    company_id: str = Depends(require_active_company),
    db: AsyncSession = Depends(get_db),
) -> Response:
    """단건 .ics 다운로드: RFC 5545. master + RRULE + EXDATE 그대로 export."""
    ev, cal = await get_event_with_calendar_or_404(db, event_id)
    assert_calendar_access(cal, user=user, company_id=company_id, permission="read")

    ics = IcsCalendar()
    ics.add("prodid", "-//Ashfield//Event Export//KR")
    ics.add("version", "2.0")
    ics.add_component(_event_to_vevent(ev))
    body = ics.to_ical()
    # HTTP 헤더는 latin-1: ASCII fallback + RFC 5987 UTF-8 percent-encoded.
    # 브라우저는 filename* 우선 사용해 한글 파일명 그대로 표시.
    from urllib.parse import quote

    ascii_name = "".join(
        c if c.isascii() and c.isalnum() else "_" for c in ev.title
    )[:40] or "event"
    utf8_name = quote(ev.title or "event", safe="")
    return Response(
        content=body,
        media_type="text/calendar; charset=utf-8",
        headers={
            "Content-Disposition": (
                f'attachment; filename="{ascii_name}.ics"; '
                f"filename*=UTF-8''{utf8_name}.ics"
            )
        },
    )


@router.get(
    "/{event_id}",
    response_model=EventResponse,
    summary="이벤트 마스터 row 조회",
    responses={404: {"description": "이벤트/캘린더 없음 또는 접근 불가"}},
)
async def get_event(
    event_id: str,
    user: UserContext = Depends(get_current_user),
    company_id: str = Depends(require_active_company),
    db: AsyncSession = Depends(get_db),
) -> EventResponse:
    ev, cal = await get_event_with_calendar_or_404(db, event_id)
    assert_calendar_access(cal, user=user, company_id=company_id, permission="read")
    bid = await _booking_id_for_event(db, event_id)
    return _to_response(ev, booking_id=bid)


@router.patch(
    "/{event_id}",
    response_model=EventResponse,
    summary="이벤트 수정 (series 전체 또는 단일 occurrence 분리)",
    responses={
        422: {"description": "external_ics 캘린더"},
        400: {"description": "end_at < start_at"},
        403: {"description": "write 권한 없음"},
    },
)
async def patch_event(
    event_id: str,
    body: EventPatch,
    occurrence: datetime | None = Query(
        None,
        description="ISO datetime. rrule 이벤트에서 주어지면 그 회차만 분리 수정: "
        "series 는 해당 회차를 EXDATE 처리하고 새 단일 이벤트를 만들어 반환.",
    ),
    user: UserContext = Depends(get_current_user),
    company_id: str = Depends(require_active_company),
    db: AsyncSession = Depends(get_db),
) -> EventResponse:
    ev, cal = await get_event_with_calendar_or_404(db, event_id)
    assert_calendar_access(cal, user=user, company_id=company_id, permission="write")
    if cal.source != "native":
        raise HTTPException(422, "Cannot modify events on a non-native calendar")
    await _assert_not_booking_linked(db, event_id)
    fields = body.model_dump(exclude_unset=True)

    if occurrence and ev.rrule:
        return await _detach_occurrence(
            db,
            ev=ev,
            occurrence=occurrence,
            fields=fields,
            user=user,
            company_id=company_id,
        )

    for k, v in fields.items():
        setattr(ev, k, v)
    if ev.end_at < ev.start_at:
        raise HTTPException(400, "end_at must be >= start_at")
    # 회의실 지정 시 이중예약 차단 (변경 후 값 기준, 자기 자신 제외): ADR-0019
    if ev.room_id:
        await assert_room_free(
            db,
            room_id=ev.room_id,
            start_at=ev.start_at,
            end_at=ev.end_at,
            company_id=company_id,
            exclude_event_id=ev.id,
        )
    await db.commit()
    await db.refresh(ev)
    return _to_response(ev)


async def _detach_occurrence(
    db: AsyncSession,
    *,
    ev: CalendarEvent,
    occurrence: datetime,
    fields: dict,
    user: UserContext,
    company_id: str,
) -> EventResponse:
    """반복 일정의 한 회차만 수정: 원 series 에서 그 회차를 EXDATE 하고,
    수정된 값으로 rrule 없는 독립 이벤트를 새로 만들어 반환한다."""
    # 1) 원 series 에서 이 회차 제외 (삭제와 동일한 EXDATE 규칙).
    key = occurrence.astimezone(UTC).replace(microsecond=0).isoformat()
    excs = list(ev.recurrence_exceptions or [])
    if key not in excs:
        excs.append(key)
        ev.recurrence_exceptions = excs

    # 2) 이 회차 = master 복제 + patch override, rrule 제거.
    #    시간 미변경 시 회차 자체의 날짜/시간(occurrence + 원 duration)을 사용.
    duration = ev.end_at - ev.start_at
    new_start = fields.get("start_at", occurrence)
    new_end = fields.get("end_at") or (new_start + duration)
    new_ev = CalendarEvent(
        id=new_id(),
        calendar_id=ev.calendar_id,
        title=fields.get("title", ev.title),
        description=fields.get("description", ev.description),
        location=fields.get("location", ev.location),
        start_at=new_start,
        end_at=new_end,
        all_day=fields.get("all_day", ev.all_day),
        timezone=fields.get("timezone", ev.timezone),
        rrule=None,
        recurrence_exceptions=[],
        reminder_minutes_before=fields.get(
            "reminder_minutes_before", ev.reminder_minutes_before
        ),
        room_id=fields.get("room_id", ev.room_id),
        created_by_sub=ev.created_by_sub,
    )
    if new_ev.end_at < new_ev.start_at:
        raise HTTPException(400, "end_at must be >= start_at")
    db.add(new_ev)
    if new_ev.room_id:
        await assert_room_free(
            db,
            room_id=new_ev.room_id,
            start_at=new_ev.start_at,
            end_at=new_ev.end_at,
            company_id=company_id,
        )
    await write_audit(
        db,
        company_id=company_id,
        actor=user,
        action="update",
        entity_type="event",
        entity_id=ev.id,
        meta={
            "detached_occurrence": key,
            "new_event_id": new_ev.id,
            "title": new_ev.title,
        },
    )
    await db.commit()
    await db.refresh(new_ev)
    return _to_response(new_ev)


@router.delete(
    "/{event_id}",
    status_code=204,
    summary="이벤트 삭제 (series 전체 또는 단일 occurrence)",
    responses={
        422: {"description": "external_ics 캘린더"},
        403: {"description": "write 권한 없음"},
    },
)
async def delete_event(
    event_id: str,
    occurrence: datetime | None = Query(
        None,
        description="ISO datetime. 주어지면 그 occurrence 만 EXDATE 처리: series 유지.",
    ),
    user: UserContext = Depends(get_current_user),
    company_id: str = Depends(require_active_company),
    db: AsyncSession = Depends(get_db),
) -> None:
    ev, cal = await get_event_with_calendar_or_404(db, event_id)
    assert_calendar_access(cal, user=user, company_id=company_id, permission="write")
    if cal.source != "native":
        raise HTTPException(422, "Cannot delete events on a non-native calendar")
    await _assert_not_booking_linked(db, event_id)
    if occurrence and ev.rrule:
        # 단일 occurrence 만 제외: series 유지
        key = occurrence.astimezone(UTC).replace(microsecond=0).isoformat()
        excs = list(ev.recurrence_exceptions or [])
        if key not in excs:
            excs.append(key)
            ev.recurrence_exceptions = excs
        await write_audit(
            db,
            company_id=company_id,
            actor=user,
            action="update",
            entity_type="event",
            entity_id=ev.id,
            meta={"excluded_occurrence": key, "title": ev.title},
        )
        await db.commit()
        return
    ev.deleted_at = datetime.now(UTC)
    await write_audit(
        db,
        company_id=company_id,
        actor=user,
        action="delete",
        entity_type="event",
        entity_id=ev.id,
        meta={"calendar_id": cal.id, "title": ev.title},
    )
    await db.commit()


# ---------------------------------------------------------------------------
# 초대 (CalendarEventInvitation)
# ---------------------------------------------------------------------------


def _inv_to_response(
    inv: CalendarEventInvitation, user_row: User | None
) -> EventInvitationResponse:
    external = inv.invitee_sub is None
    return EventInvitationResponse(
        id=inv.id,
        event_id=inv.event_id,
        invitee_sub=inv.invitee_sub,
        # 외부 게스트는 row 의 이메일/이름, 내부 멤버는 users 캐시.
        invitee_email=inv.invitee_email if external else (user_row.email if user_row else None),
        invitee_name=inv.invitee_name if external else (user_row.name if user_row else None),
        external=external,
        response=inv.response,
        responded_at=inv.responded_at,
        created_at=inv.created_at,
    )


@router.get(
    "/{event_id}/invitations",
    response_model=EventInvitationList,
    summary="이벤트 초대자 목록",
    responses={404: {"description": "이벤트 없음"}},
)
async def list_invitations(
    event_id: str,
    user: UserContext = Depends(get_current_user),
    company_id: str = Depends(require_active_company),
    db: AsyncSession = Depends(get_db),
) -> EventInvitationList:
    from sqlalchemy import select

    ev, cal = await get_event_with_calendar_or_404(db, event_id)
    assert_calendar_access(cal, user=user, company_id=company_id, permission="read")
    stmt = (
        select(CalendarEventInvitation, User)
        .outerjoin(User, User.id == CalendarEventInvitation.invitee_sub)
        .where(CalendarEventInvitation.event_id == ev.id)
        .order_by(CalendarEventInvitation.created_at)
    )
    rows = (await db.execute(stmt)).all()
    return EventInvitationList(
        invitations=[_inv_to_response(i, u) for i, u in rows]
    )


@router.post(
    "/{event_id}/invitations",
    response_model=EventInvitationResponse,
    status_code=201,
    summary="초대 추가: 작성자/캘린더 owner 만",
    responses={
        403: {"description": "creator/owner 아님"},
        404: {"description": "이벤트 없음"},
    },
)
async def create_invitation(
    event_id: str,
    body: EventInvitationCreate,
    user: UserContext = Depends(get_current_user),
    company_id: str = Depends(require_active_company),
    db: AsyncSession = Depends(get_db),
) -> EventInvitationResponse:
    import secrets
    import uuid

    from sqlalchemy import func, select

    ev, cal = await get_event_with_calendar_or_404(db, event_id)
    assert_calendar_access(cal, user=user, company_id=company_id, permission="write")
    if ev.created_by_sub != user.sub and cal.owner_id != user.sub:
        raise HTTPException(403, "Only creator can invite")

    # 대상 확정: 정확히 하나. 이메일이 이미 아는 사용자면 내부 초대로 승격.
    invitee_sub = body.invitee_sub
    invitee_email = str(body.invitee_email).lower() if body.invitee_email else None
    if (invitee_sub is None) == (invitee_email is None):
        raise HTTPException(400, "invitee_sub 또는 invitee_email 중 하나만 지정하세요")
    if invitee_email is not None:
        matched = (
            await db.execute(
                select(User).where(func.lower(User.email) == invitee_email)
            )
        ).scalar_one_or_none()
        if matched is not None:
            invitee_sub, invitee_email = matched.id, None

    if invitee_sub is not None:
        return await _create_internal_invitation(
            db, ev=ev, company_id=company_id, user=user, invitee_sub=invitee_sub
        )

    # --- 외부 게스트 초대 ---
    assert invitee_email is not None
    dup = (
        await db.execute(
            select(CalendarEventInvitation).where(
                CalendarEventInvitation.event_id == ev.id,
                func.lower(CalendarEventInvitation.invitee_email) == invitee_email,
            )
        )
    ).scalar_one_or_none()
    if dup is not None:
        return _inv_to_response(dup, None)

    inv = CalendarEventInvitation(
        id=str(uuid.uuid7()),
        event_id=ev.id,
        invitee_sub=None,
        invitee_email=invitee_email,
        rsvp_token=secrets.token_urlsafe(24),
        response="pending",
    )
    db.add(inv)
    await write_audit(
        db,
        company_id=company_id,
        actor=user,
        action="share",
        entity_type="event",
        entity_id=ev.id,
        meta={"invitee_email": invitee_email, "external": True},
    )
    await db.commit()
    await db.refresh(inv)
    # 외부 게스트는 in-app 알림 대상이 아니므로 이메일만 (best-effort).
    company = await db.get(Company, company_id)
    await email.send_to_address(
        to_email=invitee_email,
        event_type="event_guest_invited",
        company_id=company_id,
        payload={
            "title": ev.title,
            "start_at": ev.start_at.isoformat(),
            "inviter_name": user.name or user.email or "담당자",
            "organization_name": company.name if company else "Ashfield",
            "rsvp_token": inv.rsvp_token,
        },
    )
    return _inv_to_response(inv, None)


async def _create_internal_invitation(
    db: AsyncSession,
    *,
    ev: CalendarEvent,
    company_id: str,
    user: UserContext,
    invitee_sub: str,
) -> EventInvitationResponse:
    """내부 멤버 초대: in-app 알림 + 이메일 (기존 동작)."""
    import uuid

    from sqlalchemy import select

    stmt = select(CalendarEventInvitation).where(
        CalendarEventInvitation.event_id == ev.id,
        CalendarEventInvitation.invitee_sub == invitee_sub,
    )
    existing = (await db.execute(stmt)).scalar_one_or_none()
    if existing is not None:
        user_row = await db.get(User, existing.invitee_sub)
        return _inv_to_response(existing, user_row)

    inv = CalendarEventInvitation(
        id=str(uuid.uuid7()),
        event_id=ev.id,
        invitee_sub=invitee_sub,
        response="pending",
    )
    db.add(inv)
    await write_audit(
        db,
        company_id=company_id,
        actor=user,
        action="share",
        entity_type="event",
        entity_id=ev.id,
        meta={"invitee": invitee_sub},
    )
    pending = PendingDispatch()
    await notify(
        db,
        pending,
        recipient_sub=invitee_sub,
        company_id=company_id,
        actor_sub=user.sub,
        type_="event_invited",
        entity_type="event",
        entity_id=ev.id,
        payload={"title": ev.title, "start_at": ev.start_at.isoformat()},
    )
    await db.commit()
    await pending.fire()
    await db.refresh(inv)
    user_row = await db.get(User, inv.invitee_sub)
    return _inv_to_response(inv, user_row)


@router.patch(
    "/{event_id}/invitations/{invitation_id}",
    response_model=EventInvitationResponse,
    summary="초대 응답 (수락/거절/임시)",
    responses={
        403: {"description": "invitee 본인 아님"},
        404: {"description": "초대 없음"},
    },
)
async def patch_invitation(
    event_id: str,
    invitation_id: str,
    body: EventInvitationPatch,
    user: UserContext = Depends(get_current_user),
    company_id: str = Depends(require_active_company),
    db: AsyncSession = Depends(get_db),
) -> EventInvitationResponse:
    inv = await db.get(CalendarEventInvitation, invitation_id)
    if inv is None or inv.event_id != event_id:
        raise HTTPException(404, "Invitation not found")
    if inv.invitee_sub != user.sub:
        raise HTTPException(403, "Only invitee can respond")
    # company 검증
    _ev, cal = await get_event_with_calendar_or_404(db, event_id)
    if cal.company_id != company_id:
        raise HTTPException(404, "Invitation not found")

    inv.response = body.response
    inv.responded_at = datetime.now(UTC)
    pending = PendingDispatch()
    ev_full = await db.get(CalendarEvent, inv.event_id)
    if ev_full is not None:
        await notify(
            db,
            pending,
            recipient_sub=ev_full.created_by_sub,
            company_id=company_id,
            actor_sub=user.sub,
            type_="event_invitation_response",
            entity_type="event",
            entity_id=ev_full.id,
            payload={"title": ev_full.title, "response": body.response},
        )
    await db.commit()
    await pending.fire()
    await db.refresh(inv)
    user_row = await db.get(User, inv.invitee_sub)
    return _inv_to_response(inv, user_row)


@router.delete(
    "/{event_id}/invitations/{invitation_id}",
    status_code=204,
    summary="초대 제거: 작성자/owner 만",
    responses={
        403: {"description": "creator/owner 아님"},
        404: {"description": "초대 없음"},
    },
)
async def delete_invitation(
    event_id: str,
    invitation_id: str,
    user: UserContext = Depends(get_current_user),
    company_id: str = Depends(require_active_company),
    db: AsyncSession = Depends(get_db),
) -> None:
    inv = await db.get(CalendarEventInvitation, invitation_id)
    if inv is None or inv.event_id != event_id:
        raise HTTPException(404, "Invitation not found")
    ev, cal = await get_event_with_calendar_or_404(db, event_id)
    if cal.company_id != company_id:
        raise HTTPException(404, "Invitation not found")
    if ev.created_by_sub != user.sub and cal.owner_id != user.sub:
        raise HTTPException(403, "Only creator can remove invitation")
    await db.delete(inv)
    await write_audit(
        db,
        company_id=company_id,
        actor=user,
        action="unshare",
        entity_type="event",
        entity_id=ev.id,
        meta={"invitee": inv.invitee_sub},
    )
    await db.commit()
