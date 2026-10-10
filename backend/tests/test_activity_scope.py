"""활동 범위: 볼 수 있는 캘린더 일정에 다른 사람이 한 일 + 월 범위(from/to) 조회."""

from datetime import UTC, datetime, timedelta

from httpx import AsyncClient

ALICE = "user-alice"
BOB = "user-bob"
WS = "tenant-a"
OTHER = "tenant-b"
BASE = datetime(2026, 11, 2, 1, 0, tzinfo=UTC)


async def _event(client, h, scope: str):
    cal = (
        await client.post(
            "/api/v1/calendars", json={"name": f"C-{scope}", "scope": scope}, headers=h
        )
    ).json()
    ev = (
        await client.post(
            "/api/v1/events",
            json={
                "calendar_id": cal["id"],
                "title": f"E-{scope}",
                "start_at": BASE.isoformat(),
                "end_at": (BASE + timedelta(hours=1)).isoformat(),
            },
            headers=h,
        )
    ).json()
    return cal, ev


async def test_shared_calendar_events_by_others_visible(client: AsyncClient, auth_headers):
    a = auth_headers(ALICE, groups=[WS], active_workspace=WS)
    b = auth_headers(BOB, groups=[WS], active_workspace=WS)
    _cal, shared_ev = await _event(client, a, "shared")
    _cal, personal_ev = await _event(client, a, "personal")

    items = (await client.get("/api/v1/me/activity", headers=b)).json()["items"]
    ids = {i["entity_id"] for i in items}
    assert shared_ev["id"] in ids
    # 남의 개인 캘린더 일정은 안 보임
    assert personal_ev["id"] not in ids
    row = next(i for i in items if i["entity_id"] == shared_ev["id"])
    assert row["actor_sub"] == ALICE
    assert row["meta"]["title"] == "E-shared"


async def test_other_workspace_isolated(client: AsyncClient, auth_headers):
    a = auth_headers(ALICE, groups=[WS], active_workspace=WS)
    c = auth_headers("user-carol", groups=[OTHER], active_workspace=OTHER)
    _cal, ev = await _event(client, a, "shared")
    items = (await client.get("/api/v1/me/activity", headers=c)).json()["items"]
    assert ev["id"] not in {i["entity_id"] for i in items}


async def test_date_range(client: AsyncClient, auth_headers):
    a = auth_headers(ALICE, groups=[WS], active_workspace=WS)
    await _event(client, a, "personal")
    now = datetime.now(UTC)
    inside = await client.get(
        "/api/v1/me/activity",
        params={
            "from": (now - timedelta(days=1)).isoformat(),
            "to": (now + timedelta(days=1)).isoformat(),
        },
        headers=a,
    )
    assert inside.status_code == 200
    assert inside.json()["items"]
    before = await client.get(
        "/api/v1/me/activity",
        params={
            "from": (now - timedelta(days=60)).isoformat(),
            "to": (now - timedelta(days=30)).isoformat(),
        },
        headers=a,
    )
    assert before.json()["items"] == []
    bad = await client.get(
        "/api/v1/me/activity",
        params={"from": now.isoformat(), "to": (now - timedelta(days=1)).isoformat()},
        headers=a,
    )
    assert bad.status_code == 400
