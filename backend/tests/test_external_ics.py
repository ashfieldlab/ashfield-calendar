"""외부 ICS 구독: fetch+parse+upsert, read-only 가드."""

from datetime import UTC, datetime, timedelta

import pytest
from httpx import AsyncClient

ALICE = "user-alice"
ACME = "tenant-a"


SAMPLE_ICS = """BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//test//
BEGIN:VEVENT
UID:event-1@test
SUMMARY:공휴일: 신정
DTSTART;VALUE=DATE:20260101
DTEND;VALUE=DATE:20260102
END:VEVENT
BEGIN:VEVENT
UID:event-2@test
SUMMARY:매주 표준회의
DTSTART:20260105T010000Z
DTEND:20260105T020000Z
RRULE:FREQ=WEEKLY;COUNT=3
END:VEVENT
END:VCALENDAR
""".encode()


@pytest.fixture
def mock_ics(monkeypatch):
    """external_ics._fetch 만 패치: httpx 전역 패치는 test client 망가뜨림."""
    from app.services import external_ics as svc

    async def fake_fetch(url: str) -> bytes:  # noqa: ARG001
        return SAMPLE_ICS

    monkeypatch.setattr(svc, "_fetch", fake_fetch)


async def test_create_external_ics_fetches_and_imports(
    client: AsyncClient, auth_headers, mock_ics
):
    h = auth_headers(ALICE, groups=[ACME], active_workspace=ACME)
    r = await client.post(
        "/api/v1/calendars",
        json={
            "name": "공휴일",
            "scope": "shared",
            "external_ics_url": "https://example.com/holidays.ics",
        },
        headers=h,
    )
    assert r.status_code == 201, r.text
    cal = r.json()
    assert cal["source"] == "external_ics"
    assert cal["external_ics_refresh_at"] is not None

    # 1월 1주차 ~ 1월 말 범위로 occurrence 확인: RRULE COUNT=3 으로 3주치 + all-day 1건
    params = {
        "from": "2026-01-01T00:00:00+00:00",
        "to": "2026-01-31T00:00:00+00:00",
    }
    occ = (
        await client.get("/api/v1/events", params=params, headers=h)
    ).json()["occurrences"]
    titles = [o["title"] for o in occ]
    assert "공휴일: 신정" in titles
    assert titles.count("매주 표준회의") == 3


async def test_cannot_add_event_to_external_calendar(
    client: AsyncClient, auth_headers, mock_ics
):
    h = auth_headers(ALICE, groups=[ACME], active_workspace=ACME)
    cal = (
        await client.post(
            "/api/v1/calendars",
            json={
                "name": "ext",
                "scope": "personal",
                "external_ics_url": "https://example.com/feed.ics",
            },
            headers=h,
        )
    ).json()

    base = datetime(2026, 6, 1, 9, 0, tzinfo=UTC)
    r = await client.post(
        "/api/v1/events",
        json={
            "calendar_id": cal["id"],
            "title": "수동",
            "start_at": base.isoformat(),
            "end_at": (base + timedelta(hours=1)).isoformat(),
        },
        headers=h,
    )
    assert r.status_code == 422


async def test_refresh_reloads_events(
    client: AsyncClient, auth_headers, monkeypatch
):
    """refresh 호출 시 새 응답으로 이벤트가 교체된다."""
    h = auth_headers(ALICE, groups=[ACME], active_workspace=ACME)

    state = {"body": SAMPLE_ICS}

    from app.services import external_ics as svc

    async def fake_fetch(url: str) -> bytes:  # noqa: ARG001
        return state["body"]

    monkeypatch.setattr(svc, "_fetch", fake_fetch)

    cal = (
        await client.post(
            "/api/v1/calendars",
            json={
                "name": "ext",
                "scope": "personal",
                "external_ics_url": "https://example.com/feed.ics",
            },
            headers=h,
        )
    ).json()

    # 새 ICS 본문: 이벤트 1개만 (회의 RRULE 제거됨)
    state["body"] = """BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//test//
BEGIN:VEVENT
UID:event-1@test
SUMMARY:공휴일: 신정
DTSTART;VALUE=DATE:20260101
DTEND;VALUE=DATE:20260102
END:VEVENT
END:VCALENDAR
""".encode()
    r = await client.post(f"/api/v1/calendars/{cal['id']}/refresh", headers=h)
    assert r.status_code == 200

    params = {
        "from": "2026-01-01T00:00:00+00:00",
        "to": "2026-01-31T00:00:00+00:00",
    }
    occ = (
        await client.get("/api/v1/events", params=params, headers=h)
    ).json()["occurrences"]
    titles = [o["title"] for o in occ]
    assert "공휴일: 신정" in titles
    assert "매주 표준회의" not in titles
