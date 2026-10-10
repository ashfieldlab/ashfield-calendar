"""SMTP 발송: opt-out, dev 모드 스킵, fan-out 호출 검증."""

from httpx import AsyncClient

import app.services.email as email_svc

ALICE = "user-alice"
BOB = "user-bob"
ACME = "tenant-a"


async def _ensure_user(client, auth_headers, sub):
    await client.get(
        "/api/v1/me",
        headers=auth_headers(sub, groups=[ACME], active_workspace=ACME),
    )


async def test_email_fanout_invokes_send_for_invite(
    client: AsyncClient, auth_headers, monkeypatch, invite
):
    await _ensure_user(client, auth_headers, BOB)
    a = auth_headers(ALICE, groups=[ACME], active_workspace=ACME)

    monkeypatch.setattr(email_svc.settings, "smtp_enabled", True)
    captured: list = []

    async def fake_send_for_event(**kw):
        captured.append(kw)

    monkeypatch.setattr(
        "app.services.notifications.send_for_event", fake_send_for_event
    )

    await invite(client, a, BOB, "M")

    import asyncio

    for _ in range(20):
        if captured:
            break
        await asyncio.sleep(0.05)
    assert captured
    call = captured[0]
    assert call["recipient_sub"] == BOB
    assert call["event_type"] == "event_invited"


async def test_email_pref_opt_out(client: AsyncClient, auth_headers):
    b = auth_headers(BOB, groups=[ACME], active_workspace=ACME)
    r = await client.get("/api/v1/notifications/preferences", headers=b)
    assert r.status_code == 200
    assert r.json()["email_enabled"] is True

    r = await client.patch(
        "/api/v1/notifications/preferences",
        json={"email_enabled": False},
        headers=b,
    )
    assert r.json()["email_enabled"] is False

    r = await client.get("/api/v1/notifications/preferences", headers=b)
    assert r.json()["email_enabled"] is False


async def test_dev_mode_skips_send(monkeypatch):
    """smtp_enabled=False 면 발송 안 함 (그냥 로그만)."""
    monkeypatch.setattr(email_svc.settings, "smtp_enabled", False)
    called = False

    def fake_sync(*a, **kw):  # noqa: ARG001
        nonlocal called
        called = True

    monkeypatch.setattr(email_svc, "_send_sync", fake_sync)

    await email_svc.send_for_event(
        recipient_sub="user-zzz",
        actor_sub=None,
        event_type="event_invited",
        payload={"title": "x", "start_at": "2026-06-01 09:00"},
    )
    assert called is False
