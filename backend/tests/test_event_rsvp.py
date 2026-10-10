"""외부 게스트 일정 초대: 이메일 초대 + 공개 RSVP 토큰 (ADR-0011)."""

from datetime import UTC, datetime, timedelta

from httpx import AsyncClient
from sqlalchemy import select

from app.models.calendar_event_invitation import CalendarEventInvitation

ALICE = "user-alice"
BOB = "user-bob"
ACME = "tenant-a"


async def _ensure_user(client, auth_headers, sub):
    await client.get(
        "/api/v1/me",
        headers=auth_headers(sub, groups=[ACME], active_company=ACME),
    )


async def _make_event(client, headers) -> dict:
    cal = (
        await client.post(
            "/api/v1/calendars",
            json={"name": "C", "scope": "shared"},
            headers=headers,
        )
    ).json()
    base = datetime(2026, 6, 1, 9, 0, tzinfo=UTC)
    return (
        await client.post(
            "/api/v1/events",
            json={
                "calendar_id": cal["id"],
                "title": "외부미팅",
                "start_at": base.isoformat(),
                "end_at": (base + timedelta(hours=1)).isoformat(),
            },
            headers=headers,
        )
    ).json()


async def test_external_guest_invite_and_rsvp(
    client: AsyncClient, auth_headers, db_session
):
    a = auth_headers(ALICE, groups=[ACME], active_company=ACME)
    ev = await _make_event(client, a)

    r = await client.post(
        f"/api/v1/events/{ev['id']}/invitations",
        json={"invitee_email": "guest@ext.example"},
        headers=a,
    )
    assert r.status_code == 201
    body = r.json()
    assert body["external"] is True
    assert body["invitee_sub"] is None
    assert body["invitee_email"] == "guest@ext.example"
    assert body["response"] == "pending"

    # rsvp_token 은 응답에 노출되지 않음: DB 에서만 확인.
    inv = (
        await db_session.execute(
            select(CalendarEventInvitation).where(
                CalendarEventInvitation.event_id == ev["id"]
            )
        )
    ).scalar_one()
    token = inv.rsvp_token
    assert token and len(token) >= 16

    # 공개 GET: 로그인 없이 요약.
    r = await client.get(f"/api/public/v1/events/rsvp/{token}")
    assert r.status_code == 200
    assert r.json()["title"] == "외부미팅"
    assert r.json()["response"] == "pending"

    # 공개 POST: 수락.
    r = await client.post(
        f"/api/public/v1/events/rsvp/{token}", json={"response": "accepted"}
    )
    assert r.status_code == 200
    assert r.json()["response"] == "accepted"

    # 잘못된 토큰 → 404.
    r = await client.get("/api/public/v1/events/rsvp/" + "x" * 24)
    assert r.status_code == 404


async def test_invite_existing_member_email_becomes_internal(
    client: AsyncClient, auth_headers, make_jwt
):
    # BOB 를 유효 도메인 이메일로 upsert (기본 @test.local 은 EmailStr 예약 TLD 거부).
    bob_email = "bob@corp.example"
    bob_token = make_jwt(BOB, groups=[ACME], email=bob_email)
    await client.get(
        "/api/v1/me",
        headers={
            "Authorization": f"Bearer {bob_token}",
            "X-Active-Company-Id": ACME,
        },
    )
    a = auth_headers(ALICE, groups=[ACME], active_company=ACME)
    ev = await _make_event(client, a)

    r = await client.post(
        f"/api/v1/events/{ev['id']}/invitations",
        json={"invitee_email": bob_email},
        headers=a,
    )
    assert r.status_code == 201
    body = r.json()
    assert body["external"] is False
    assert body["invitee_sub"] == BOB


async def test_invite_requires_exactly_one_target(
    client: AsyncClient, auth_headers
):
    a = auth_headers(ALICE, groups=[ACME], active_company=ACME)
    ev = await _make_event(client, a)

    # 둘 다 지정 → 400
    r = await client.post(
        f"/api/v1/events/{ev['id']}/invitations",
        json={"invitee_sub": BOB, "invitee_email": "x@y.example"},
        headers=a,
    )
    assert r.status_code == 400

    # 아무것도 없음 → 400
    r = await client.post(
        f"/api/v1/events/{ev['id']}/invitations", json={}, headers=a
    )
    assert r.status_code == 400


async def test_duplicate_external_invite_returns_same_row(
    client: AsyncClient, auth_headers
):
    a = auth_headers(ALICE, groups=[ACME], active_company=ACME)
    ev = await _make_event(client, a)
    first = (
        await client.post(
            f"/api/v1/events/{ev['id']}/invitations",
            json={"invitee_email": "dup@ext.example"},
            headers=a,
        )
    ).json()
    second = (
        await client.post(
            f"/api/v1/events/{ev['id']}/invitations",
            json={"invitee_email": "dup@ext.example"},
            headers=a,
        )
    ).json()
    assert first["id"] == second["id"]
