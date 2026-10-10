"""/api/v1/search: 일정 검색 + 권한 격리."""

from datetime import UTC, datetime, timedelta

from httpx import AsyncClient

ALICE = "user-alice"
BOB = "user-bob"
ACME = "tenant-a"


async def _ensure(client, auth_headers, sub):
    await client.get(
        "/api/v1/me",
        headers=auth_headers(sub, groups=[ACME], active_company=ACME),
    )


async def test_search_event(client: AsyncClient, auth_headers):
    a = auth_headers(ALICE, groups=[ACME], active_company=ACME)
    cal = (
        await client.post(
            "/api/v1/calendars",
            json={"name": "C", "scope": "shared"},
            headers=a,
        )
    ).json()
    base = datetime(2026, 6, 1, 9, 0, tzinfo=UTC)
    for title in ("기획 회의", "noise"):
        await client.post(
            "/api/v1/events",
            json={
                "calendar_id": cal["id"],
                "title": title,
                "start_at": base.isoformat(),
                "end_at": (base + timedelta(hours=1)).isoformat(),
            },
            headers=a,
        )

    r = await client.get("/api/v1/search?q=기획", headers=a)
    assert r.status_code == 200
    event_titles = [e["title"] for e in r.json()["events"]]
    assert "기획 회의" in event_titles
    assert "noise" not in event_titles


async def test_search_empty_term_rejected(client: AsyncClient, auth_headers):
    a = auth_headers(ALICE, groups=[ACME], active_company=ACME)
    r = await client.get("/api/v1/search?q=", headers=a)
    assert r.status_code == 422


async def test_search_by_event_description(client: AsyncClient, auth_headers):
    a = auth_headers(ALICE, groups=[ACME], active_company=ACME)
    cal = (
        await client.post(
            "/api/v1/calendars",
            json={"name": "S", "scope": "personal"},
            headers=a,
        )
    ).json()
    base = datetime(2026, 6, 1, 9, 0, tzinfo=UTC)
    await client.post(
        "/api/v1/events",
        json={
            "calendar_id": cal["id"],
            "title": "Plain Sync",
            "description": "키워드-알파-검색",
            "start_at": base.isoformat(),
            "end_at": (base + timedelta(hours=1)).isoformat(),
        },
        headers=a,
    )
    r = await client.get("/api/v1/search?q=알파-검색", headers=a)
    assert any(e["title"] == "Plain Sync" for e in r.json()["events"])


async def test_search_isolated_per_user(client: AsyncClient, auth_headers):
    await _ensure(client, auth_headers, BOB)
    a = auth_headers(ALICE, groups=[ACME], active_company=ACME)
    b = auth_headers(BOB, groups=[ACME], active_company=ACME)

    cal = (
        await client.post(
            "/api/v1/calendars",
            json={"name": "P", "scope": "personal"},
            headers=a,
        )
    ).json()
    base = datetime(2026, 6, 1, 9, 0, tzinfo=UTC)
    await client.post(
        "/api/v1/events",
        json={
            "calendar_id": cal["id"],
            "title": "alice-personal",
            "start_at": base.isoformat(),
            "end_at": (base + timedelta(hours=1)).isoformat(),
        },
        headers=a,
    )

    r = await client.get("/api/v1/search?q=alice", headers=b)
    assert r.status_code == 200
    # Bob 은 Alice 의 personal 캘린더 일정 못 봄
    assert r.json()["events"] == []
