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
    assert r2.json()["detail"]["code"] == "ROOM_CONFLICT"

    # 인접(11:00~) → 허용
    r3 = await client.post("/api/v1/events", json=ev("11:00", "12:00"), headers=h)
    assert r3.status_code == 201, r3.text
