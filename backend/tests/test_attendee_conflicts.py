"""참석자 일정 겹침: 업무 일정(초대·공유 캘린더·주최 회의)만, 개인 캘린더는 안 본다."""

from datetime import UTC, datetime, timedelta

from httpx import AsyncClient

ALICE = "user-alice"
BOB = "user-bob"
ACME = "tenant-a"
T0 = datetime(2026, 6, 1, 9, 0, tzinfo=UTC)


async def _ensure_user(client, auth_headers, sub):
    await client.get("/api/v1/me", headers=auth_headers(sub, groups=[ACME], active_workspace=ACME))


async def _calendar(client, h, scope="personal", name="Cal") -> str:
    r = await client.post("/api/v1/calendars", json={"name": name, "scope": scope}, headers=h)
    assert r.status_code in (200, 201), r.text
    return r.json()["id"]


async def _event(client, h, cal_id, start=T0, hours=1, rrule=None) -> str:
    body = {
        "calendar_id": cal_id,
        "title": "비밀 회의",
        "start_at": start.isoformat(),
        "end_at": (start + timedelta(hours=hours)).isoformat(),
    }
    if rrule:
        body["rrule"] = rrule
    r = await client.post("/api/v1/events", json=body, headers=h)
    assert r.status_code in (200, 201), r.text
    return r.json()["id"]


async def _conflicts(client, h, subs, start=T0, hours=1, exclude=None) -> list[dict]:
    r = await client.post(
        "/api/v1/events/conflicts",
        json={
            "start_at": start.isoformat(),
            "end_at": (start + timedelta(hours=hours)).isoformat(),
            "attendee_subs": subs,
            "exclude_event_id": exclude,
        },
        headers=h,
    )
    assert r.status_code == 200, r.text
    return r.json()["conflicts"]


async def test_personal_calendar_is_not_looked_at(client: AsyncClient, auth_headers):
    await _ensure_user(client, auth_headers, BOB)
    a = auth_headers(ALICE, groups=[ACME], active_workspace=ACME)
    b = auth_headers(BOB, groups=[ACME], active_workspace=ACME)
    await _event(client, b, await _calendar(client, b))  # BOB 개인 일정 (초대 없음)
    assert await _conflicts(client, a, [BOB]) == []


async def test_invitation_makes_busy_unless_declined(client: AsyncClient, auth_headers):
    await _ensure_user(client, auth_headers, BOB)
    a = auth_headers(ALICE, groups=[ACME], active_workspace=ACME)
    b = auth_headers(BOB, groups=[ACME], active_workspace=ACME)
    ev = await _event(client, a, await _calendar(client, a))
    inv = (
        await client.post(f"/api/v1/events/{ev}/invitations", json={"invitee_sub": BOB}, headers=a)
    ).json()

    [c] = await _conflicts(client, a, [BOB])  # 미응답도 바쁨
    assert c["sub"] == BOB
    assert "title" not in c  # 제목 비노출

    await client.patch(
        f"/api/v1/events/{ev}/invitations/{inv['id']}", json={"response": "declined"}, headers=b
    )
    assert await _conflicts(client, a, [BOB]) == []


async def test_organizer_of_meeting_is_busy(client: AsyncClient, auth_headers):
    """주최 회의는 주최자 개인 캘린더에 있지만, 초대가 붙은 일정이라 주최자도 바쁨."""
    await _ensure_user(client, auth_headers, BOB)
    a = auth_headers(ALICE, groups=[ACME], active_workspace=ACME)
    ev = await _event(client, a, await _calendar(client, a))
    await client.post(f"/api/v1/events/{ev}/invitations", json={"invitee_sub": BOB}, headers=a)
    assert [c["sub"] for c in await _conflicts(client, a, [ALICE])] == [ALICE]


async def test_shared_calendar_event_counts(client: AsyncClient, auth_headers):
    await _ensure_user(client, auth_headers, BOB)
    a = auth_headers(ALICE, groups=[ACME], active_workspace=ACME)
    b = auth_headers(BOB, groups=[ACME], active_workspace=ACME)
    vacation = await _calendar(client, b, scope="shared", name="휴가")
    await _event(client, b, vacation, hours=8)
    assert [c["sub"] for c in await _conflicts(client, a, [BOB])] == [BOB]


async def test_recurring_meeting_and_exclude_self(client: AsyncClient, auth_headers):
    await _ensure_user(client, auth_headers, BOB)
    a = auth_headers(ALICE, groups=[ACME], active_workspace=ACME)
    ev = await _event(client, a, await _calendar(client, a), rrule="FREQ=WEEKLY")
    await client.post(f"/api/v1/events/{ev}/invitations", json={"invitee_sub": BOB}, headers=a)

    # 3주 뒤 같은 시각 회차와 겹침
    later = T0 + timedelta(weeks=3)
    assert [c["sub"] for c in await _conflicts(client, a, [BOB], start=later)] == [BOB]
    # 다른 시각은 안 겹침
    assert await _conflicts(client, a, [BOB], start=later + timedelta(hours=2)) == []
    # 그 회의 자신을 편집 중이면 겹침에서 뺀다
    assert await _conflicts(client, a, [BOB], start=later, exclude=ev) == []


async def test_other_workspace_cannot_see(client: AsyncClient, auth_headers):
    await _ensure_user(client, auth_headers, BOB)
    a = auth_headers(ALICE, groups=[ACME], active_workspace=ACME)
    ev = await _event(client, a, await _calendar(client, a))
    await client.post(f"/api/v1/events/{ev}/invitations", json={"invitee_sub": BOB}, headers=a)

    other = auth_headers("user-eve", groups=["tenant-b"], active_workspace="tenant-b")
    assert await _conflicts(client, other, [BOB]) == []
