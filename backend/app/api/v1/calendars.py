"""/api/v1/calendars: 캘린더 CRUD + 개인 가시 토글 + 외부 ICS 구독.

자동 가시 (ADR-0007): 워크스페이스의 모든 shared 캘린더 + 본인 personal 캘린더 자동 노출.
ICS URL 구독 방식의 재공유 불가 한계를 우회.

외부 ICS:
  - 생성 시 `external_ics_url` 주면 즉시 fetch + parse + 이벤트 삽입.
  - source=external_ics 캘린더의 이벤트는 read-only. `/events` mutation 라우트 모두 422.
  - `POST /{id}/refresh` 로 wipe-and-reload 재동기화.
"""

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import Response
from icalendar import Calendar as IcsCalendar
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.context import UserContext
from app.auth.dependencies import get_current_user, require_active_workspace
from app.core.db import get_db
from app.models.calendar import Calendar
from app.models.calendar_event import CalendarEvent
from app.models.user_calendar_preference import UserCalendarPreference
from app.schemas.calendar import (
    CalendarCreate,
    CalendarListResponse,
    CalendarPatch,
    CalendarPreferencePatch,
    CalendarResponse,
)
from app.services.audit import write_audit
from app.services.calendars import (
    assert_calendar_access,
    ensure_holidays_calendar,
    get_calendar_or_404,
    list_visible_calendars,
    new_id,
    upsert_preference,
)
from app.services.external_ics import (
    import_ics_bytes,
    refresh_external_calendar,
)

router = APIRouter(prefix="/calendars", tags=["calendars"])


def _to_response(
    cal: Calendar, pref: UserCalendarPreference | None
) -> CalendarResponse:
    return CalendarResponse(
        id=cal.id,
        workspace_id=cal.workspace_id,
        owner_id=cal.owner_id,
        scope=cal.scope,
        source=cal.source,
        name=cal.name,
        description=cal.description,
        color=cal.color,
        managed=cal.managed,
        external_ics_url=cal.external_ics_url,
        external_ics_refresh_at=cal.external_ics_refresh_at,
        hidden=pref.hidden if pref else False,
        color_override=pref.color_override if pref else None,
    )


@router.get(
    "",
    response_model=CalendarListResponse,
    summary="자동 가시 캘린더 목록",
)
async def list_calendars(
    user: UserContext = Depends(get_current_user),
    workspace_id: str = Depends(require_active_workspace),
    db: AsyncSession = Depends(get_db),
) -> CalendarListResponse:
    # 기본 공휴일 캘린더 idempotent 시드 (없으면 생성 후 목록에 포함).
    await ensure_holidays_calendar(db, workspace_id=workspace_id, actor_sub=user.sub)
    visible = await list_visible_calendars(db, workspace_id=workspace_id, user=user)
    return CalendarListResponse(
        calendars=[_to_response(c, p) for c, p in visible]
    )


@router.post(
    "",
    response_model=CalendarResponse,
    status_code=201,
    summary="캘린더 생성 (native 또는 external_ics)",
    responses={
        400: {"description": "external_ics_url 형식 오류"},
        502: {"description": "ICS 피드 fetch 실패"},
        413: {"description": "ICS 본문 5MB 초과"},
    },
)
async def create_calendar(
    body: CalendarCreate,
    user: UserContext = Depends(get_current_user),
    workspace_id: str = Depends(require_active_workspace),
    db: AsyncSession = Depends(get_db),
) -> CalendarResponse:
    is_external = bool(body.external_ics_url)
    cal = Calendar(
        id=new_id(),
        workspace_id=workspace_id,
        owner_id=user.sub,
        scope=body.scope,
        source="external_ics" if is_external else "native",
        name=body.name,
        description=body.description,
        color=body.color,
        external_ics_url=body.external_ics_url,
    )
    db.add(cal)
    await db.flush()

    if is_external:
        # 첫 fetch: 실패하면 캘린더도 생성 안 됨 (rollback)
        await refresh_external_calendar(db, cal=cal, actor_sub=user.sub)

    await write_audit(
        db,
        workspace_id=workspace_id,
        actor=user,
        action="create",
        entity_type="calendar",
        entity_id=cal.id,
        meta={
            "name": cal.name,
            "scope": cal.scope,
            "source": cal.source,
        },
    )
    await db.commit()
    await db.refresh(cal)
    return _to_response(cal, None)


@router.patch(
    "/{calendar_id}",
    response_model=CalendarResponse,
    summary="캘린더 메타 수정 (이름·색·설명)",
    responses={
        403: {"description": "write 권한 없음: personal 의 owner 아님"},
        404: {"description": "없거나 다른 워크스페이스"},
    },
)
async def patch_calendar(
    calendar_id: str,
    body: CalendarPatch,
    user: UserContext = Depends(get_current_user),
    workspace_id: str = Depends(require_active_workspace),
    db: AsyncSession = Depends(get_db),
) -> CalendarResponse:
    cal = await get_calendar_or_404(db, calendar_id)
    assert_calendar_access(cal, user=user, workspace_id=workspace_id, permission="write")
    if cal.managed:
        raise HTTPException(403, "관리형 캘린더는 편집할 수 없습니다")
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(cal, k, v)
    await db.commit()
    await db.refresh(cal)
    pref = await db.get(UserCalendarPreference, (user.sub, cal.id))
    return _to_response(cal, pref)


@router.get(
    "/{calendar_id}/ics",
    summary="캘린더 단위 .ics 일괄 다운로드 (모든 이벤트 포함)",
    responses={
        200: {"content": {"text/calendar": {}}, "description": ".ics 본문"},
        404: {"description": "캘린더 없음 또는 접근 불가"},
    },
)
async def export_calendar_ics(
    calendar_id: str,
    user: UserContext = Depends(get_current_user),
    workspace_id: str = Depends(require_active_workspace),
    db: AsyncSession = Depends(get_db),
) -> Response:
    """단일 VCALENDAR 안에 캘린더의 모든 활성 이벤트 VEVENT 로 export.

    RRULE/EXDATE 그대로 보존. 삭제(deleted_at) 이벤트는 제외.
    """
    from urllib.parse import quote

    from app.api.v1.events import _event_to_vevent

    cal = await get_calendar_or_404(db, calendar_id)
    assert_calendar_access(cal, user=user, workspace_id=workspace_id, permission="read")

    events = list(
        (
            await db.execute(
                select(CalendarEvent)
                .where(
                    CalendarEvent.calendar_id == cal.id,
                    CalendarEvent.deleted_at.is_(None),
                )
                .order_by(CalendarEvent.start_at)
            )
        ).scalars().all()
    )

    ics = IcsCalendar()
    ics.add("prodid", "-//Ashfield//Calendar Export//KR")
    ics.add("version", "2.0")
    ics.add("x-wr-calname", cal.name)
    for ev in events:
        ics.add_component(_event_to_vevent(ev))

    body = ics.to_ical()
    ascii_name = "".join(
        c if c.isascii() and c.isalnum() else "_" for c in cal.name
    )[:40] or "calendar"
    utf8_name = quote(cal.name or "calendar", safe="")
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


@router.delete(
    "/{calendar_id}",
    status_code=204,
    summary="캘린더 soft delete (이벤트도 자연 가시 제외)",
    responses={403: {"description": "권한 없음"}, 404: {"description": "없음"}},
)
async def delete_calendar(
    calendar_id: str,
    user: UserContext = Depends(get_current_user),
    workspace_id: str = Depends(require_active_workspace),
    db: AsyncSession = Depends(get_db),
) -> None:
    from datetime import UTC, datetime

    cal = await get_calendar_or_404(db, calendar_id)
    assert_calendar_access(cal, user=user, workspace_id=workspace_id, permission="write")
    if cal.managed:
        raise HTTPException(403, "관리형 캘린더는 삭제할 수 없습니다 (숨김만 가능)")
    cal.deleted_at = datetime.now(UTC)
    await write_audit(
        db,
        workspace_id=workspace_id,
        actor=user,
        action="delete",
        entity_type="calendar",
        entity_id=cal.id,
        meta={"name": cal.name},
    )
    await db.commit()


@router.patch(
    "/{calendar_id}/preferences",
    response_model=CalendarResponse,
    summary="개인 가시/색 토글",
    responses={404: {"description": "캘린더 없음 또는 접근 불가"}},
)
async def patch_preferences(
    calendar_id: str,
    body: CalendarPreferencePatch,
    user: UserContext = Depends(get_current_user),
    workspace_id: str = Depends(require_active_workspace),
    db: AsyncSession = Depends(get_db),
) -> CalendarResponse:
    cal = await get_calendar_or_404(db, calendar_id)
    assert_calendar_access(cal, user=user, workspace_id=workspace_id, permission="read")
    fields = body.model_dump(exclude_unset=True)
    pref = await upsert_preference(
        db,
        user_sub=user.sub,
        calendar_id=cal.id,
        hidden=fields.get("hidden"),
        color_override=fields.get("color_override"),
    )
    await db.commit()
    await db.refresh(pref)
    return _to_response(cal, pref)


@router.post(
    "/{calendar_id}/refresh",
    response_model=CalendarResponse,
    summary="외부 ICS 재동기화 (wipe-and-reload)",
    responses={
        400: {"description": "external_ics 가 아닌 캘린더"},
        502: {"description": "ICS 피드 fetch 실패"},
        413: {"description": "ICS 본문 5MB 초과"},
    },
)
async def refresh_calendar(
    calendar_id: str,
    user: UserContext = Depends(get_current_user),
    workspace_id: str = Depends(require_active_workspace),
    db: AsyncSession = Depends(get_db),
) -> CalendarResponse:
    """외부 ICS 캘린더 재동기화: owner 또는 admin 만."""
    cal = await get_calendar_or_404(db, calendar_id)
    assert_calendar_access(cal, user=user, workspace_id=workspace_id, permission="write")
    await refresh_external_calendar(db, cal=cal, actor_sub=user.sub)
    await write_audit(
        db,
        workspace_id=workspace_id,
        actor=user,
        action="update",
        entity_type="calendar",
        entity_id=cal.id,
        meta={"refresh": True},
    )
    await db.commit()
    await db.refresh(cal)
    pref = await db.get(UserCalendarPreference, (user.sub, cal.id))
    return _to_response(cal, pref)


class IcsImportResponse(BaseModel):
    imported: int


@router.post(
    "/{calendar_id}/import-ics",
    response_model=IcsImportResponse,
    summary="ICS 파일 1회성 import: 파일은 보관하지 않음",
    responses={
        400: {"description": "외부 ICS 구독 캘린더에는 import 불가"},
        413: {"description": "파일 5MB 초과"},
    },
)
async def import_ics(
    calendar_id: str,
    file: UploadFile = File(..., description="ICS 파일"),
    user: UserContext = Depends(get_current_user),
    workspace_id: str = Depends(require_active_workspace),
    db: AsyncSession = Depends(get_db),
) -> IcsImportResponse:
    """업로드된 .ics 파일의 master VEVENT 들을 캘린더에 적재. 파일 자체는 저장 안 함."""
    cal = await get_calendar_or_404(db, calendar_id)
    assert_calendar_access(cal, user=user, workspace_id=workspace_id, permission="write")
    if cal.source != "native":
        raise HTTPException(400, "Only native calendars accept ICS import")
    body = await file.read()
    imported = await import_ics_bytes(db, cal=cal, body=body, actor_sub=user.sub)
    await write_audit(
        db,
        workspace_id=workspace_id,
        actor=user,
        action="import_ics",
        entity_type="calendar",
        entity_id=cal.id,
        meta={"events": imported, "filename": file.filename},
    )
    await db.commit()
    return IcsImportResponse(imported=imported)


# ---------------------------------------------------------------------------
# ICS subscription (ADR-0013): opt-in 토큰 기반 외부 미러
# ---------------------------------------------------------------------------


class SubscriptionResponse(BaseModel):
    enabled: bool
    token: str | None
    url: str | None


async def _assert_can_manage_subscription(
    db: AsyncSession, cal: Calendar, user: UserContext
) -> None:
    """ADR-0013 권한 분기: personal=소유자, shared=workspace admin."""
    if cal.scope == "personal":
        if cal.owner_id != user.sub:
            raise HTTPException(403, "Forbidden")
        return
    # shared
    if user.is_system_admin:
        return
    from app.models.user_workspace_membership import UserWorkspaceMembership

    membership = await db.get(UserWorkspaceMembership, (user.sub, cal.workspace_id))
    if membership is not None and membership.role == "admin":
        return
    raise HTTPException(403, "Forbidden")


def _subscription_response(cal: Calendar) -> SubscriptionResponse:
    from app.core.config import settings

    if not cal.subscription_enabled or not cal.subscription_token:
        return SubscriptionResponse(enabled=False, token=None, url=None)
    base = settings.calendar_base_url
    url = f"{base.rstrip('/')}/api/public/v1/calendars/{cal.subscription_token}.ics"
    return SubscriptionResponse(
        enabled=True, token=cal.subscription_token, url=url
    )


@router.get(
    "/{calendar_id}/subscription",
    response_model=SubscriptionResponse,
    summary="ICS subscription 상태 조회",
)
async def get_subscription(
    calendar_id: str,
    user: UserContext = Depends(get_current_user),
    workspace_id: str = Depends(require_active_workspace),
    db: AsyncSession = Depends(get_db),
) -> SubscriptionResponse:
    cal = await get_calendar_or_404(db, calendar_id)
    assert_calendar_access(cal, user=user, workspace_id=workspace_id, permission="read")
    await _assert_can_manage_subscription(db, cal, user)
    return _subscription_response(cal)


@router.post(
    "/{calendar_id}/subscription",
    response_model=SubscriptionResponse,
    summary="ICS subscription 활성화 (토큰 발급)",
)
async def enable_subscription(
    calendar_id: str,
    user: UserContext = Depends(get_current_user),
    workspace_id: str = Depends(require_active_workspace),
    db: AsyncSession = Depends(get_db),
) -> SubscriptionResponse:
    from app.services.ics_subscription import new_subscription_token

    cal = await get_calendar_or_404(db, calendar_id)
    assert_calendar_access(cal, user=user, workspace_id=workspace_id, permission="write")
    await _assert_can_manage_subscription(db, cal, user)
    if not cal.subscription_token:
        cal.subscription_token = new_subscription_token()
    cal.subscription_enabled = True
    await write_audit(
        db,
        workspace_id=workspace_id,
        actor=user,
        action="ics_subscription_enable",
        entity_type="calendar",
        entity_id=cal.id,
        meta={"scope": cal.scope},
    )
    await db.commit()
    return _subscription_response(cal)


@router.post(
    "/{calendar_id}/subscription/rotate",
    response_model=SubscriptionResponse,
    summary="ICS subscription 토큰 회전: 기존 URL 즉시 무효",
)
async def rotate_subscription(
    calendar_id: str,
    user: UserContext = Depends(get_current_user),
    workspace_id: str = Depends(require_active_workspace),
    db: AsyncSession = Depends(get_db),
) -> SubscriptionResponse:
    from app.services.ics_subscription import new_subscription_token

    cal = await get_calendar_or_404(db, calendar_id)
    assert_calendar_access(cal, user=user, workspace_id=workspace_id, permission="write")
    await _assert_can_manage_subscription(db, cal, user)
    if not cal.subscription_enabled:
        raise HTTPException(400, "Subscription is not enabled")
    cal.subscription_token = new_subscription_token()
    await write_audit(
        db,
        workspace_id=workspace_id,
        actor=user,
        action="ics_subscription_rotate",
        entity_type="calendar",
        entity_id=cal.id,
        meta={},
    )
    await db.commit()
    return _subscription_response(cal)


@router.delete(
    "/{calendar_id}/subscription",
    status_code=204,
    summary="ICS subscription 비활성화 (토큰 폐기)",
)
async def disable_subscription(
    calendar_id: str,
    user: UserContext = Depends(get_current_user),
    workspace_id: str = Depends(require_active_workspace),
    db: AsyncSession = Depends(get_db),
) -> None:
    cal = await get_calendar_or_404(db, calendar_id)
    assert_calendar_access(cal, user=user, workspace_id=workspace_id, permission="write")
    await _assert_can_manage_subscription(db, cal, user)
    cal.subscription_enabled = False
    cal.subscription_token = None
    await write_audit(
        db,
        workspace_id=workspace_id,
        actor=user,
        action="ics_subscription_disable",
        entity_type="calendar",
        entity_id=cal.id,
        meta={},
    )
    await db.commit()
