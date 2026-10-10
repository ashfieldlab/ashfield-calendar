"""일정 변경과 취소 알림 (event_updated, event_cancelled) + 알림 응답의 일정, 초대 컨텍스트."""

from datetime import UTC, datetime, timedelta

from httpx import AsyncClient

ALICE = "user-alice"
BOB = "user-bob"
WS = "tenant-a"
BASE = datetime(2026, 11, 2, 1, 0, tzinfo=UTC)


async def _setup(client: AsyncClient, auth_headers):
    a = auth_headers(ALICE, groups=[WS], active_workspace=WS)
    b = auth_headers(BOB, groups=[WS], active_workspace=WS)
    await client.get("/api/v1/me", headers=b)
    cal = (
        await client.post(
            "/api/v1/calendars", json={"name": "팀", "scope": "shared"}, headers=a
        )
    ).json()
    ev = (
        await client.post(
            "/api/v1/events",
            json={
                "calendar_id": cal["id"],
                "title": "주간 회의",
                "start_at": BASE.isoformat(),
                "end_at": (BASE + timedelta(hours=1)).isoformat(),
                "location": "소회의실",
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
    return a, b, cal, ev, inv


async def _notifs(client, h):
    return (await client.get("/api/v1/notifications", headers=h)).json()["notifications"]


async def test_invited_notification_has_invitation_context(client, auth_headers):
    _a, b, cal, ev, inv = await _setup(client, auth_headers)
    n = next(x for x in await _notifs(client, b) if x["type"] == "event_invited")
    assert n["payload"]["invitation_id"] == inv["id"]
    assert n["invitation"] == {"id": inv["id"], "event_id": ev["id"], "response": "pending"}
    assert n["event"]["title"] == "주간 회의"
    assert n["event"]["calendar_name"] == "팀"
    assert n["event"]["deleted"] is False

    # 알림에서 바로 응답: 기존 초대 응답 API, 응답 후 컨텍스트에 반영
    r = await client.patch(
        f"/api/v1/events/{ev['id']}/invitations/{inv['id']}",
        json={"response": "tentative"},
        headers=b,
    )
    assert r.status_code == 200
    n = next(x for x in await _notifs(client, b) if x["type"] == "event_invited")
    assert n["invitation"]["response"] == "tentative"


async def test_update_notifies_attendee_with_changes(client, auth_headers):
    a, b, _cal, ev, _inv = await _setup(client, auth_headers)
    new_start = BASE + timedelta(minutes=30)
    r = await client.patch(
        f"/api/v1/events/{ev['id']}",
        json={
            "start_at": new_start.isoformat(),
            "end_at": (new_start + timedelta(hours=1)).isoformat(),
            "location": "대회의실",
        },
        headers=a,
    )
    assert r.status_code == 200
    n = next(x for x in await _notifs(client, b) if x["type"] == "event_updated")
    p = n["payload"]
    assert set(p["fields"]) == {"start_at", "end_at", "location"}
    assert p["changes"]["location"] == {"from": "소회의실", "to": "대회의실"}
    assert datetime.fromisoformat(p["old_start"]) == BASE
    assert datetime.fromisoformat(p["new_start"]) == new_start
    assert n["actor_sub"] == ALICE
    # 본인(작성자)은 자기 변경 알림을 받지 않음
    assert not [x for x in await _notifs(client, a) if x["type"] == "event_updated"]

    # 활동: update audit 에 같은 meta
    acts = (await client.get("/api/v1/me/activity", headers=a)).json()["items"]
    up = next(i for i in acts if i["action"] == "update" and i["entity_id"] == ev["id"])
    assert up["meta"]["title"] == "주간 회의"
    assert "old_start" in up["meta"]


async def test_description_only_change_is_quiet(client, auth_headers):
    a, b, _cal, ev, _inv = await _setup(client, auth_headers)
    await client.patch(
        f"/api/v1/events/{ev['id']}", json={"description": "메모"}, headers=a
    )
    assert not [x for x in await _notifs(client, b) if x["type"] == "event_updated"]


async def test_delete_notifies_attendee_cancelled(client, auth_headers):
    a, b, _cal, ev, _inv = await _setup(client, auth_headers)
    r = await client.delete(f"/api/v1/events/{ev['id']}", headers=a)
    assert r.status_code == 204
    n = next(x for x in await _notifs(client, b) if x["type"] == "event_cancelled")
    assert n["payload"]["title"] == "주간 회의"
    assert n["event"]["deleted"] is True


async def test_declined_attendee_not_notified(client, auth_headers):
    a, b, _cal, ev, inv = await _setup(client, auth_headers)
    await client.patch(
        f"/api/v1/events/{ev['id']}/invitations/{inv['id']}",
        json={"response": "declined"},
        headers=b,
    )
    await client.delete(f"/api/v1/events/{ev['id']}", headers=a)
    assert not [x for x in await _notifs(client, b) if x["type"] == "event_cancelled"]


async def test_mark_unread(client, auth_headers):
    _a, b, _cal, _ev, _inv = await _setup(client, auth_headers)
    n = (await _notifs(client, b))[0]
    r = await client.patch(f"/api/v1/notifications/{n['id']}", json={"read": True}, headers=b)
    assert r.json()["read_at"] is not None
    r = await client.patch(f"/api/v1/notifications/{n['id']}", json={"read": False}, headers=b)
    assert r.status_code == 200
    assert r.json()["read_at"] is None
    assert r.json()["invitation"] is not None


async def test_cannot_patch_others_notification(client, auth_headers):
    a, b, _cal, _ev, _inv = await _setup(client, auth_headers)
    n = (await _notifs(client, b))[0]
    r = await client.patch(f"/api/v1/notifications/{n['id']}", json={"read": False}, headers=a)
    assert r.status_code == 404
