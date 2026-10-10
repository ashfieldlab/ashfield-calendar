"""FastAPI 측 CalendarEvent mutation 이 calendar_object_changes 에 자동 기록되는지.

ADR-0014: 외부 캘린더 앱이 sync REPORT 효율 sync 받으려면 우리 측 변경도
같은 로그에 들어가야 함. SQLAlchemy ORM event listener 가 hook.
"""

from datetime import UTC, datetime, timedelta

import pytest
from sqlalchemy import select

from app.models.calendar import Calendar
from app.models.calendar_event import CalendarEvent
from app.models.calendar_object_change import CalendarObjectChange


async def _make_calendar(client, auth_headers, db_session, sub="u1"):
    h = auth_headers(sub, groups=["acme-corp"], active_company="acme-corp")
    await client.get("/api/v1/me", headers=h)
    res = await client.post(
        "/api/v1/calendars",
        headers=h,
        json={"name": "테스트", "scope": "personal"},
    )
    return res.json()["id"], h


async def _changes_for(db, calendar_id: str):
    stmt = (
        select(CalendarObjectChange)
        .where(CalendarObjectChange.calendar_id == calendar_id)
        .order_by(CalendarObjectChange.sync_token)
    )
    return list((await db.execute(stmt)).scalars().all())


@pytest.mark.asyncio
async def test_event_create_records_change(client, auth_headers, db_session):
    cal_id, h = await _make_calendar(client, auth_headers, db_session)
    start = datetime.now(UTC) + timedelta(days=1)
    end = start + timedelta(hours=1)
    res = await client.post(
        "/api/v1/events",
        headers=h,
        json={
            "calendar_id": cal_id,
            "title": "회의",
            "start_at": start.isoformat(),
            "end_at": end.isoformat(),
            "timezone": "UTC",
            "all_day": False,
        },
    )
    assert res.status_code == 201, res.text
    changes = await _changes_for(db_session, cal_id)
    assert len(changes) == 1
    assert changes[0].operation == 1
    assert changes[0].sync_token >= 2  # 캘린더 생성 시 1 → 이벤트 시 ≥2


@pytest.mark.asyncio
async def test_event_update_records_modify(client, auth_headers, db_session):
    cal_id, h = await _make_calendar(client, auth_headers, db_session)
    start = datetime.now(UTC) + timedelta(days=1)
    create = await client.post(
        "/api/v1/events",
        headers=h,
        json={
            "calendar_id": cal_id,
            "title": "원본",
            "start_at": start.isoformat(),
            "end_at": (start + timedelta(hours=1)).isoformat(),
            "timezone": "UTC",
            "all_day": False,
        },
    )
    ev_id = create.json()["id"]

    res = await client.patch(
        f"/api/v1/events/{ev_id}",
        headers=h,
        json={"title": "수정됨"},
    )
    assert res.status_code == 200, res.text

    changes = await _changes_for(db_session, cal_id)
    assert len(changes) == 2
    assert changes[1].operation == 2  # modified


@pytest.mark.asyncio
async def test_event_delete_records_deleted(client, auth_headers, db_session):
    cal_id, h = await _make_calendar(client, auth_headers, db_session)
    start = datetime.now(UTC) + timedelta(days=1)
    create = await client.post(
        "/api/v1/events",
        headers=h,
        json={
            "calendar_id": cal_id,
            "title": "곧 삭제",
            "start_at": start.isoformat(),
            "end_at": (start + timedelta(hours=1)).isoformat(),
            "timezone": "UTC",
            "all_day": False,
        },
    )
    ev_id = create.json()["id"]

    res = await client.delete(f"/api/v1/events/{ev_id}", headers=h)
    assert res.status_code == 204

    changes = await _changes_for(db_session, cal_id)
    assert len(changes) == 2
    assert changes[0].operation == 1
    assert changes[1].operation == 3  # deleted


@pytest.mark.asyncio
async def test_sync_token_increments_monotonically(
    client, auth_headers, db_session
):
    cal_id, h = await _make_calendar(client, auth_headers, db_session)
    start = datetime.now(UTC) + timedelta(days=1)
    for i in range(3):
        await client.post(
            "/api/v1/events",
            headers=h,
            json={
                "calendar_id": cal_id,
                "title": f"이벤트 {i}",
                "start_at": (start + timedelta(hours=i)).isoformat(),
                "end_at": (start + timedelta(hours=i + 1)).isoformat(),
                "timezone": "UTC",
                "all_day": False,
            },
        )

    cal = await db_session.get(Calendar, cal_id)
    assert cal.sync_token >= 4  # 캘린더 생성 시 1 + 이벤트 3개

    changes = await _changes_for(db_session, cal_id)
    tokens = [c.sync_token for c in changes]
    assert tokens == sorted(tokens)
    assert len(set(tokens)) == len(tokens)  # 중복 없음


@pytest.mark.asyncio
async def test_uri_uses_dav_uri_or_event_id(client, auth_headers, db_session):
    """우리 UI 가 만든 이벤트는 dav_uri=NULL → '{id}.ics' fallback."""
    cal_id, h = await _make_calendar(client, auth_headers, db_session)
    start = datetime.now(UTC) + timedelta(days=1)
    create = await client.post(
        "/api/v1/events",
        headers=h,
        json={
            "calendar_id": cal_id,
            "title": "URI 확인",
            "start_at": start.isoformat(),
            "end_at": (start + timedelta(hours=1)).isoformat(),
            "timezone": "UTC",
            "all_day": False,
        },
    )
    ev_id = create.json()["id"]
    ev = await db_session.get(CalendarEvent, ev_id)
    assert ev.dav_uri is None  # 우리 UI 는 dav_uri 안 채움

    changes = await _changes_for(db_session, cal_id)
    assert changes[-1].object_uri == f"{ev_id}.ics"
