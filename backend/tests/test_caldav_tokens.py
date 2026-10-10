"""CalDAV App Token API (ADR-0014) — 발급·목록·revoke + 회사 격리 + bcrypt 검증."""

import bcrypt
import pytest


@pytest.mark.asyncio
async def test_create_returns_secret_once(client, auth_headers):
    h = auth_headers("u1", groups=["acme-corp"], active_company="acme-corp")
    await client.get("/api/v1/me", headers=h)
    res = await client.post(
        "/api/v1/me/caldav-tokens",
        headers=h,
        json={"name": "Apple Calendar (iPhone)"},
    )
    assert res.status_code == 201
    j = res.json()
    assert j["username"] == "u1"
    assert j["company_id"] == "acme-corp"
    assert j["secret"].startswith("cdv_")
    assert len(j["secret"]) > 30
    assert j["server_url"].endswith("/caldav/")
    assert j["name"] == "Apple Calendar (iPhone)"


@pytest.mark.asyncio
async def test_list_excludes_secret(client, auth_headers):
    h = auth_headers("u1", groups=["acme-corp"], active_company="acme-corp")
    await client.get("/api/v1/me", headers=h)
    await client.post(
        "/api/v1/me/caldav-tokens", headers=h, json={"name": "Token A"}
    )
    res = await client.get("/api/v1/me/caldav-tokens", headers=h)
    items = res.json()["items"]
    assert len(items) == 1
    assert "secret" not in items[0]
    assert items[0]["name"] == "Token A"


@pytest.mark.asyncio
async def test_secret_bcrypt_verifiable(client, auth_headers, db_session):
    """DB 의 hash 가 발급된 평문 secret 으로 verify 가능해야."""
    from app.models.caldav_token import CalDavToken

    h = auth_headers("u1", groups=["acme-corp"], active_company="acme-corp")
    await client.get("/api/v1/me", headers=h)
    res = await client.post(
        "/api/v1/me/caldav-tokens", headers=h, json={"name": "verify-me"}
    )
    secret = res.json()["secret"]
    token_id = res.json()["id"]
    row = await db_session.get(CalDavToken, token_id)
    assert row is not None
    assert bcrypt.checkpw(secret.encode(), row.secret_hash.encode())
    # 잘못된 secret 은 거부
    assert not bcrypt.checkpw(b"wrong-password", row.secret_hash.encode())


@pytest.mark.asyncio
async def test_revoke_excludes_from_list(client, auth_headers):
    h = auth_headers("u1", groups=["acme-corp"], active_company="acme-corp")
    await client.get("/api/v1/me", headers=h)
    create = await client.post(
        "/api/v1/me/caldav-tokens", headers=h, json={"name": "to-revoke"}
    )
    tid = create.json()["id"]
    dis = await client.delete(
        f"/api/v1/me/caldav-tokens/{tid}", headers=h
    )
    assert dis.status_code == 204
    lst = await client.get("/api/v1/me/caldav-tokens", headers=h)
    assert lst.json()["items"] == []


@pytest.mark.asyncio
async def test_cannot_revoke_others_token(client, auth_headers):
    h1 = auth_headers("u1", groups=["acme-corp"], active_company="acme-corp")
    await client.get("/api/v1/me", headers=h1)
    create = await client.post(
        "/api/v1/me/caldav-tokens", headers=h1, json={"name": "u1-token"}
    )
    tid = create.json()["id"]
    # u2 가 u1 토큰 폐기 시도
    h2 = auth_headers("u2", groups=["acme-corp"], active_company="acme-corp")
    await client.get("/api/v1/me", headers=h2)
    res = await client.delete(
        f"/api/v1/me/caldav-tokens/{tid}", headers=h2
    )
    assert res.status_code == 404


@pytest.mark.asyncio
async def test_company_isolation_in_list(client, auth_headers):
    """같은 user 가 두 회사 멤버여도 active company 의 토큰만 목록에 보임."""
    h_acme = auth_headers(
        "u1", groups=["acme-corp", "beta-co"], active_company="acme-corp"
    )
    await client.get("/api/v1/me", headers=h_acme)
    await client.post(
        "/api/v1/me/caldav-tokens", headers=h_acme, json={"name": "acme-only"}
    )

    h_beta = auth_headers(
        "u1", groups=["acme-corp", "beta-co"], active_company="beta-co"
    )
    await client.get("/api/v1/me", headers=h_beta)
    await client.post(
        "/api/v1/me/caldav-tokens", headers=h_beta, json={"name": "beta-only"}
    )

    lst_acme = await client.get("/api/v1/me/caldav-tokens", headers=h_acme)
    items_acme = lst_acme.json()["items"]
    assert len(items_acme) == 1
    assert items_acme[0]["name"] == "acme-only"

    lst_beta = await client.get("/api/v1/me/caldav-tokens", headers=h_beta)
    items_beta = lst_beta.json()["items"]
    assert len(items_beta) == 1
    assert items_beta[0]["name"] == "beta-only"
