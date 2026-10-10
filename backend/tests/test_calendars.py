"""calendars / events — 자동 가시, RRULE expand, occurrence 예외."""

from datetime import UTC, datetime, timedelta

from httpx import AsyncClient

ALICE = "user-alice"
BOB = "user-bob"
ACME = "tenant-a"


async def test_auto_visibility_shared_seen_by_all(
    client: AsyncClient, auth_headers
):
    a = auth_headers(ALICE, groups=[ACME], active_company=ACME)
    b = auth_headers(BOB, groups=[ACME], active_company=ACME)

    # Alice 가 회사 공유 캘린더 생성
    r = await client.post(
        "/api/v1/calendars",
        json={"name": "Holidays", "scope": "shared", "color": "#ff0000"},
        headers=a,
    )
    assert r.status_code == 201

    # Bob 도 자동 가시
    r = await client.get("/api/v1/calendars", headers=b)
    names = [c["name"] for c in r.json()["calendars"]]
    assert "Holidays" in names


async def test_personal_calendar_hidden_from_other_user(
    client: AsyncClient, auth_headers
):
    a = auth_headers(ALICE, groups=[ACME], active_company=ACME)
    b = auth_headers(BOB, groups=[ACME], active_company=ACME)

    r = await client.post(
        "/api/v1/calendars",
        json={"name": "Alice Personal", "scope": "personal"},
        headers=a,
    )
    assert r.status_code == 201

    cals = (await client.get("/api/v1/calendars", headers=b)).json()["calendars"]
    assert all(c["name"] != "Alice Personal" for c in cals)


async def test_hidden_preference_excludes_occurrences(
    client: AsyncClient, auth_headers
):
    a = auth_headers(ALICE, groups=[ACME], active_company=ACME)
    cal = (
        await client.post(
            "/api/v1/calendars",
            json={"name": "X", "scope": "personal"},
            headers=a,
        )
    ).json()
    now = datetime.now(UTC).replace(microsecond=0)
    await client.post(
        "/api/v1/events",
        json={
            "calendar_id": cal["id"],
            "title": "Solo",
            "start_at": now.isoformat(),
            "end_at": (now + timedelta(hours=1)).isoformat(),
        },
        headers=a,
    )

    params = {
        "from": (now - timedelta(hours=1)).isoformat(),
        "to": (now + timedelta(hours=2)).isoformat(),
    }
    occ = (
        await client.get("/api/v1/events", params=params, headers=a)
    ).json()["occurrences"]
    assert len(occ) == 1

    # hidden 토글
    await client.patch(
        f"/api/v1/calendars/{cal['id']}/preferences",
        json={"hidden": True},
        headers=a,
    )
    occ = (
        await client.get("/api/v1/events", params=params, headers=a)
    ).json()["occurrences"]
    assert occ == []


async def test_rrule_expansion_weekly(client: AsyncClient, auth_headers):
    a = auth_headers(ALICE, groups=[ACME], active_company=ACME)
    cal = (
        await client.post(
            "/api/v1/calendars",
            json={"name": "Weekly", "scope": "personal"},
            headers=a,
        )
    ).json()
    base = datetime(2026, 6, 1, 10, 0, tzinfo=UTC)
    await client.post(
        "/api/v1/events",
        json={
            "calendar_id": cal["id"],
            "title": "Standup",
            "start_at": base.isoformat(),
            "end_at": (base + timedelta(minutes=30)).isoformat(),
            "rrule": "FREQ=WEEKLY;COUNT=5",
        },
        headers=a,
    )

    params = {
        "from": base.isoformat(),
        "to": (base + timedelta(weeks=10)).isoformat(),
    }
    occ = (
        await client.get("/api/v1/events", params=params, headers=a)
    ).json()["occurrences"]
    assert len(occ) == 5
    assert all(o["title"] == "Standup" for o in occ)
    assert all(o["is_recurring"] for o in occ)


async def test_event_ics_export(client: AsyncClient, auth_headers):
    a = auth_headers(ALICE, groups=[ACME], active_company=ACME)
    cal = (
        await client.post(
            "/api/v1/calendars",
            json={"name": "X", "scope": "personal"},
            headers=a,
        )
    ).json()
    base = datetime(2026, 6, 1, 10, 0, tzinfo=UTC)
    ev = (
        await client.post(
            "/api/v1/events",
            json={
                "calendar_id": cal["id"],
                "title": "Demo",
                "start_at": base.isoformat(),
                "end_at": (base + timedelta(hours=1)).isoformat(),
                "rrule": "FREQ=WEEKLY;COUNT=3",
            },
            headers=a,
        )
    ).json()
    r = await client.get(f"/api/v1/events/{ev['id']}/ics", headers=a)
    assert r.status_code == 200
    assert r.headers["content-type"].startswith("text/calendar")
    text = r.text
    assert "BEGIN:VCALENDAR" in text
    assert "SUMMARY:Demo" in text
    assert "RRULE:FREQ=WEEKLY;COUNT=3" in text


async def test_delete_single_occurrence_keeps_series(
    client: AsyncClient, auth_headers
):
    a = auth_headers(ALICE, groups=[ACME], active_company=ACME)
    cal = (
        await client.post(
            "/api/v1/calendars",
            json={"name": "C", "scope": "personal"},
            headers=a,
        )
    ).json()
    base = datetime(2026, 6, 1, 10, 0, tzinfo=UTC)
    ev = (
        await client.post(
            "/api/v1/events",
            json={
                "calendar_id": cal["id"],
                "title": "Daily",
                "start_at": base.isoformat(),
                "end_at": (base + timedelta(minutes=30)).isoformat(),
                "rrule": "FREQ=DAILY;COUNT=3",
            },
            headers=a,
        )
    ).json()

    # 가운데 occurrence 만 제거
    second = base + timedelta(days=1)
    r = await client.delete(
        f"/api/v1/events/{ev['id']}",
        params={"occurrence": second.isoformat()},
        headers=a,
    )
    assert r.status_code == 204

    params = {
        "from": base.isoformat(),
        "to": (base + timedelta(days=5)).isoformat(),
    }
    occ = (
        await client.get("/api/v1/events", params=params, headers=a)
    ).json()["occurrences"]
    starts = [o["start_at"] for o in occ]
    assert len(occ) == 2
    assert all(second.isoformat() not in s for s in starts)
