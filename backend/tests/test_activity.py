"""/api/v1/me/activity — 본인 행동 + 본인 알림 entity 만 노출."""

from datetime import UTC, datetime, timedelta

from httpx import AsyncClient

ALICE = "user-alice"
BOB = "user-bob"
ACME = "tenant-a"


async def _event(client, headers):
    cal = (
        await client.post(
            "/api/v1/calendars",
            json={"name": "C", "scope": "personal"},
            headers=headers,
        )
    ).json()
    base = datetime(2026, 6, 1, 9, 0, tzinfo=UTC)
    return (
        await client.post(
            "/api/v1/events",
            json={
                "calendar_id": cal["id"],
                "title": "E",
                "start_at": base.isoformat(),
                "end_at": (base + timedelta(hours=1)).isoformat(),
            },
            headers=headers,
        )
    ).json()


async def _ensure(client, auth_headers, sub):
    await client.get(
        "/api/v1/me",
        headers=auth_headers(sub, groups=[ACME], active_company=ACME),
    )


async def test_activity_shows_self_actions(client: AsyncClient, auth_headers):
    a = auth_headers(ALICE, groups=[ACME], active_company=ACME)
    ev = await _event(client, a)
    await client.delete(f"/api/v1/events/{ev['id']}", headers=a)

    r = await client.get("/api/v1/me/activity", headers=a)
    assert r.status_code == 200
    items = r.json()["items"]
    assert any(
        it["action"] == "create" and it["entity_id"] == ev["id"] for it in items
    )
    assert any(
        it["action"] == "delete" and it["entity_id"] == ev["id"] for it in items
    )


async def test_activity_empty_for_fresh_user(client: AsyncClient, auth_headers):
    fresh = auth_headers("user-fresh", groups=[ACME], active_company=ACME)
    r = await client.get("/api/v1/me/activity", headers=fresh)
    assert r.status_code == 200
    assert r.json()["items"] == []


async def test_activity_shows_received_invite(client: AsyncClient, auth_headers):
    await _ensure(client, auth_headers, BOB)
    a = auth_headers(ALICE, groups=[ACME], active_company=ACME)
    b = auth_headers(BOB, groups=[ACME], active_company=ACME)
    ev = await _event(client, a)
    await client.post(
        f"/api/v1/events/{ev['id']}/invitations",
        json={"invitee_sub": BOB},
        headers=a,
    )
    # Bob 의 activity 에는 본인이 한 일이 없지만 받은 알림 entity = 이벤트 id 매칭으로
    # Alice 의 share(초대) audit row 가 노출되어야 함
    r = await client.get("/api/v1/me/activity", headers=b)
    items = r.json()["items"]
    assert any(
        it["action"] == "share" and it["entity_id"] == ev["id"] for it in items
    )
