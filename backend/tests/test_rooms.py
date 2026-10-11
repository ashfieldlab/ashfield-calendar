"""회의실(Room) CRUD, 권한 + 이중예약 차단 (ADR-0019)."""

import pytest
from httpx import AsyncClient

ALICE = "user-alice"
BOB = "user-bob"
ACME = "tenant-a"


@pytest.mark.asyncio
async def test_room_crud_and_permissions(client: AsyncClient, auth_headers):
    admin = auth_headers(ALICE, groups=[ACME], roles=["admin"], active_workspace=ACME)
    member = auth_headers(BOB, groups=[ACME], active_workspace=ACME)

    r = await client.post(
        "/api/v1/rooms", json={"name": "회의실 A", "capacity": 6}, headers=admin
    )
    assert r.status_code == 201, r.text
    rid = r.json()["id"]
    assert r.json()["capacity"] == 6

    # 멤버는 목록 조회 가능 (이벤트 폼에서 선택용)
    r = await client.get("/api/v1/rooms", headers=member)
    assert r.status_code == 200
    assert any(x["id"] == rid for x in r.json()["rooms"])

    # 멤버는 생성 불가 (워크스페이스 관리자만)
    r = await client.post("/api/v1/rooms", json={"name": "회의실 B"}, headers=member)
    assert r.status_code == 403


@pytest.mark.asyncio
async def test_room_double_booking_blocked(client: AsyncClient, auth_headers):
    h = auth_headers(ALICE, groups=[ACME], roles=["admin"], active_workspace=ACME)
    room = (
        await client.post("/api/v1/rooms", json={"name": "회의실 A"}, headers=h)
    ).json()
    cal = (
        await client.post(
            "/api/v1/calendars",
            json={"name": "C", "scope": "personal"},
            headers=h,
        )
    ).json()

    def ev(start, end):
        return {
            "calendar_id": cal["id"],
            "title": "회의",
            "start_at": f"2026-08-03T{start}:00+00:00",
            "end_at": f"2026-08-03T{end}:00+00:00",
            "room_id": room["id"],
        }

    r1 = await client.post("/api/v1/events", json=ev("10:00", "11:00"), headers=h)
    assert r1.status_code == 201, r1.text

    # 겹침 → 차단
    r2 = await client.post("/api/v1/events", json=ev("10:30", "11:30"), headers=h)
    assert r2.status_code == 409
    assert r2.json()["code"] == "ROOM_CONFLICT"
    assert r2.json()["params"]["title"] == "회의"
    assert r2.json()["params"]["start_at"].startswith("2026-08-03T10:00")

    # 인접(11:00~) → 허용
    r3 = await client.post("/api/v1/events", json=ev("11:00", "12:00"), headers=h)
    assert r3.status_code == 201, r3.text


@pytest.mark.asyncio
async def test_room_conflict_title_only_if_readable(client: AsyncClient, auth_headers):
    """겹친 일정 제목은 요청자가 읽을 수 있을 때만 (남의 개인 일정 제목 노출 방지)."""
    alice = auth_headers(ALICE, groups=[ACME], roles=["admin"], active_workspace=ACME)
    bob = auth_headers(BOB, groups=[ACME], active_workspace=ACME)
    room = (
        await client.post("/api/v1/rooms", json={"name": "회의실 A"}, headers=alice)
    ).json()

    async def calendar(headers, scope):
        r = await client.post(
            "/api/v1/calendars", json={"name": scope, "scope": scope}, headers=headers
        )
        assert r.status_code == 201, r.text
        return r.json()["id"]

    def ev(cal_id, title, start, end):
        return {
            "calendar_id": cal_id,
            "title": title,
            "start_at": f"2026-08-04T{start}:00+00:00",
            "end_at": f"2026-08-04T{end}:00+00:00",
            "room_id": room["id"],
        }

    alice_personal = await calendar(alice, "personal")
    shared = await calendar(alice, "shared")
    bob_personal = await calendar(bob, "personal")

    r = await client.post(
        "/api/v1/events", json=ev(alice_personal, "비밀 면담", "10:00", "11:00"), headers=alice
    )
    assert r.status_code == 201, r.text
    r = await client.post(
        "/api/v1/events", json=ev(shared, "전체 회의", "13:00", "14:00"), headers=alice
    )
    assert r.status_code == 201, r.text

    # 남의 개인 일정과 겹침: 시간만, 제목 없음
    r = await client.post(
        "/api/v1/events", json=ev(bob_personal, "x", "10:30", "11:30"), headers=bob
    )
    assert r.status_code == 409
    assert r.json()["code"] == "ROOM_CONFLICT"
    assert "title" not in r.json()["params"]
    assert r.json()["params"]["start_at"].startswith("2026-08-04T10:00")

    # 공유 캘린더 일정과 겹침: 제목 포함
    r = await client.post(
        "/api/v1/events", json=ev(bob_personal, "x", "13:30", "14:30"), headers=bob
    )
    assert r.status_code == 409
    assert r.json()["params"]["title"] == "전체 회의"


@pytest.mark.asyncio
async def test_room_conflicts_preview(client: AsyncClient, auth_headers):
    """이벤트 폼 미리보기: 시간대에 사용 중인 방과 겹친 일정."""
    alice = auth_headers(ALICE, groups=[ACME], roles=["admin"], active_workspace=ACME)
    bob = auth_headers(BOB, groups=[ACME], active_workspace=ACME)
    room_a = (await client.post("/api/v1/rooms", json={"name": "A"}, headers=alice)).json()
    room_b = (await client.post("/api/v1/rooms", json={"name": "B"}, headers=alice)).json()
    cal = (
        await client.post(
            "/api/v1/calendars", json={"name": "C", "scope": "personal"}, headers=alice
        )
    ).json()
    ev = (
        await client.post(
            "/api/v1/events",
            json={
                "calendar_id": cal["id"],
                "title": "비밀 면담",
                "start_at": "2026-08-05T10:00:00+00:00",
                "end_at": "2026-08-05T11:00:00+00:00",
                "room_id": room_a["id"],
            },
            headers=alice,
        )
    ).json()

    def query(start, end, exclude=None):
        body = {
            "start_at": f"2026-08-05T{start}:00+00:00",
            "end_at": f"2026-08-05T{end}:00+00:00",
        }
        if exclude:
            body["exclude_event_id"] = exclude
        return body

    r = await client.post("/api/v1/rooms/conflicts", json=query("10:30", "11:30"), headers=alice)
    assert r.status_code == 200, r.text
    [c] = r.json()["conflicts"]
    assert c["room_id"] == room_a["id"]
    assert c["title"] == "비밀 면담"
    assert room_b["id"] not in {x["room_id"] for x in r.json()["conflicts"]}

    # 남의 개인 일정: 제목 없이
    r = await client.post("/api/v1/rooms/conflicts", json=query("10:30", "11:30"), headers=bob)
    [c] = r.json()["conflicts"]
    assert c["title"] is None

    # 인접 시간, 자기 자신 제외 → 겹침 없음
    r = await client.post("/api/v1/rooms/conflicts", json=query("11:00", "12:00"), headers=alice)
    assert r.json()["conflicts"] == []
    r = await client.post(
        "/api/v1/rooms/conflicts", json=query("10:00", "11:00", ev["id"]), headers=alice
    )
    assert r.json()["conflicts"] == []
