"""Event invitations: 초대 → 가시화, 응답, declined 제외."""

from datetime import UTC, datetime, timedelta

from httpx import AsyncClient

ALICE = "user-alice"
BOB = "user-bob"
ACME = "tenant-a"


async def _ensure_user(client, auth_headers, sub):
    await client.get(
        "/api/v1/me",
        headers=auth_headers(sub, groups=[ACME], active_workspace=ACME),
    )


async def test_invited_event_appears_in_range_even_if_personal_calendar(
    client: AsyncClient, auth_headers
):
    await _ensure_user(client, auth_headers, BOB)
    a = auth_headers(ALICE, groups=[ACME], active_workspace=ACME)
    b = auth_headers(BOB, groups=[ACME], active_workspace=ACME)

    cal = (
        await client.post(
            "/api/v1/calendars",
            json={"name": "Alice", "scope": "personal"},
            headers=a,
        )
    ).json()
    base = datetime(2026, 6, 1, 9, 0, tzinfo=UTC)
    ev = (
        await client.post(
            "/api/v1/events",
            json={
                "calendar_id": cal["id"],
                "title": "Sync",
                "start_at": base.isoformat(),
                "end_at": (base + timedelta(hours=1)).isoformat(),
            },
            headers=a,
        )
    ).json()

    # Bob 은 이 이벤트 안 보임
    params = {
        "from": base.isoformat(),
        "to": (base + timedelta(days=1)).isoformat(),
    }
    occ = (
        await client.get("/api/v1/events", params=params, headers=b)
    ).json()["occurrences"]
    assert all(o["event_id"] != ev["id"] for o in occ)

    # Alice 가 Bob 초대
    r = await client.post(
        f"/api/v1/events/{ev['id']}/invitations",
        json={"invitee_sub": BOB},
        headers=a,
    )
    assert r.status_code == 201
    inv_id = r.json()["id"]
    assert r.json()["response"] == "pending"

    # Bob 의 occurrence 목록에 노출
    occ = (
        await client.get("/api/v1/events", params=params, headers=b)
    ).json()["occurrences"]
    assert any(o["event_id"] == ev["id"] for o in occ)

    # Bob 이 declined → 다시 사라짐
    await client.patch(
        f"/api/v1/events/{ev['id']}/invitations/{inv_id}",
        json={"response": "declined"},
        headers=b,
    )
    occ = (
        await client.get("/api/v1/events", params=params, headers=b)
    ).json()["occurrences"]
    assert all(o["event_id"] != ev["id"] for o in occ)


async def test_only_invitee_can_change_response(
    client: AsyncClient, auth_headers
):
    await _ensure_user(client, auth_headers, BOB)
    a = auth_headers(ALICE, groups=[ACME], active_workspace=ACME)

    cal = (
        await client.post(
            "/api/v1/calendars", json={"name": "C", "scope": "shared"}, headers=a
        )
    ).json()
    base = datetime(2026, 6, 1, 9, 0, tzinfo=UTC)
    ev = (
        await client.post(
            "/api/v1/events",
            json={
                "calendar_id": cal["id"],
                "title": "S",
                "start_at": base.isoformat(),
                "end_at": (base + timedelta(hours=1)).isoformat(),
            },
            headers=a,
        )
    ).json()
    inv = (
        await client.post(
            f"/api/v1/events/{ev['id']}/invitations",
            json={"invitee_sub": BOB},
            headers=a,
        )
    ).json()
    # Alice (creator) 가 응답 시도 → 403
    r = await client.patch(
        f"/api/v1/events/{ev['id']}/invitations/{inv['id']}",
        json={"response": "accepted"},
        headers=a,
    )
    assert r.status_code == 403


async def test_non_creator_cannot_invite(
    client: AsyncClient, auth_headers
):
    await _ensure_user(client, auth_headers, BOB)
    a = auth_headers(ALICE, groups=[ACME], active_workspace=ACME)
    b = auth_headers(BOB, groups=[ACME], active_workspace=ACME)
    cal = (
        await client.post(
            "/api/v1/calendars",
            json={"name": "Shared", "scope": "shared"},
            headers=a,
        )
    ).json()
    base = datetime(2026, 6, 1, 9, 0, tzinfo=UTC)
    ev = (
        await client.post(
            "/api/v1/events",
            json={
                "calendar_id": cal["id"],
                "title": "S",
                "start_at": base.isoformat(),
                "end_at": (base + timedelta(hours=1)).isoformat(),
            },
            headers=a,
        )
    ).json()
    # Bob 이 다른 사용자 초대 시도 → 403 (creator 아님)
    r = await client.post(
        f"/api/v1/events/{ev['id']}/invitations",
        json={"invitee_sub": "user-charlie"},
        headers=b,
    )
    assert r.status_code == 403


async def test_invitee_can_read_event_detail_from_personal_calendar(
    client: AsyncClient, auth_headers
):
    """초대받은 사람은 남의 개인 캘린더 일정이라도 상세, 참석자, .ics 를 볼 수 있다."""
    await _ensure_user(client, auth_headers, BOB)
    await _ensure_user(client, auth_headers, "user-carol")
    a = auth_headers(ALICE, groups=[ACME], active_workspace=ACME)
    b = auth_headers(BOB, groups=[ACME], active_workspace=ACME)
    c = auth_headers("user-carol", groups=[ACME], active_workspace=ACME)

    cal = (
        await client.post(
            "/api/v1/calendars",
            json={"name": "Alice", "scope": "personal", "color": "#2563eb"},
            headers=a,
        )
    ).json()
    base = datetime(2026, 6, 1, 9, 0, tzinfo=UTC)
    ev = (
        await client.post(
            "/api/v1/events",
            json={
                "calendar_id": cal["id"],
                "title": "Sync",
                "start_at": base.isoformat(),
                "end_at": (base + timedelta(hours=1)).isoformat(),
            },
            headers=a,
        )
    ).json()
    await client.post(
        f"/api/v1/events/{ev['id']}/invitations",
        json={"invitee_sub": BOB},
        headers=a,
    )

    r = await client.get(f"/api/v1/events/{ev['id']}", headers=b)
    assert r.status_code == 200
    body = r.json()
    assert body["calendar_name"] == "Alice"
    assert body["calendar_color"] == "#2563eb"
    assert body["organizer_email"]
    assert body["booking"] is None

    r = await client.get(f"/api/v1/events/{ev['id']}/invitations", headers=b)
    assert r.status_code == 200
    assert [i["invitee_sub"] for i in r.json()["invitations"]] == [BOB]

    r = await client.get(f"/api/v1/events/{ev['id']}/ics", headers=b)
    assert r.status_code == 200

    # 초대 안 받은 사람은 여전히 차단
    r = await client.get(f"/api/v1/events/{ev['id']}", headers=c)
    assert r.status_code == 403
