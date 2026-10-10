"""/api/v1/workspaces/{id}/profile: 로고 URL CRUD + 권한 + 검증."""

import pytest


async def _make_admin(client, auth_headers, db_session, sub, workspace):
    from app.models.user_workspace_membership import UserWorkspaceMembership

    h = auth_headers(sub, groups=[workspace], active_workspace=workspace)
    await client.get("/api/v1/me", headers=h)
    m = await db_session.get(UserWorkspaceMembership, (sub, workspace))
    m.role = "admin"
    await db_session.flush()
    return h


@pytest.mark.asyncio
async def test_member_cannot_read(client, auth_headers):
    h = auth_headers("u1", groups=["acme-corp"], active_workspace="acme-corp")
    await client.get("/api/v1/me", headers=h)
    res = await client.get("/api/v1/workspaces/acme-corp/profile", headers=h)
    assert res.status_code == 403


@pytest.mark.asyncio
async def test_admin_can_read_and_update(client, auth_headers, db_session):
    h = await _make_admin(client, auth_headers, db_session, "f", "acme-corp")
    res = await client.get("/api/v1/workspaces/acme-corp/profile", headers=h)
    assert res.status_code == 200
    assert res.json()["logo_url"] is None

    put = await client.put(
        "/api/v1/workspaces/acme-corp/profile",
        headers=h,
        json={"logo_url": "https://example.com/logo.png"},
    )
    assert put.status_code == 200
    assert put.json()["logo_url"] == "https://example.com/logo.png"


@pytest.mark.asyncio
async def test_put_rejects_non_url(client, auth_headers, db_session):
    h = await _make_admin(client, auth_headers, db_session, "f", "acme-corp")
    res = await client.put(
        "/api/v1/workspaces/acme-corp/profile",
        headers=h,
        json={"logo_url": "not-a-url"},
    )
    assert res.status_code == 422


@pytest.mark.asyncio
async def test_put_null_clears(client, auth_headers, db_session):
    h = await _make_admin(client, auth_headers, db_session, "f", "acme-corp")
    await client.put(
        "/api/v1/workspaces/acme-corp/profile",
        headers=h,
        json={"logo_url": "https://example.com/logo.png"},
    )
    await client.put(
        "/api/v1/workspaces/acme-corp/profile",
        headers=h,
        json={"logo_url": None},
    )
    g = await client.get("/api/v1/workspaces/acme-corp/profile", headers=h)
    assert g.json()["logo_url"] is None


@pytest.mark.asyncio
async def test_cross_workspace_isolation(client, auth_headers, db_session):
    h = await _make_admin(client, auth_headers, db_session, "f", "acme-corp")
    res = await client.put(
        "/api/v1/workspaces/beta-co/profile",
        headers=h,
        json={"logo_url": "https://example.com/x.png"},
    )
    assert res.status_code == 403


@pytest.mark.asyncio
async def test_template_accepts_organization_logo_url_variable(
    client, auth_headers, db_session
):
    """organization_logo_url 이 화이트리스트에 추가돼 템플릿에서 사용 가능."""
    h = await _make_admin(client, auth_headers, db_session, "f", "acme-corp")
    res = await client.put(
        "/api/v1/workspaces/acme-corp/email-templates/booking_received_customer",
        headers=h,
        json={
            "subject": "{title}",
            "body": '<img src="{organization_logo_url}"/>{customer_name}',
            "is_html": True,
        },
    )
    assert res.status_code == 200, res.text


@pytest.mark.asyncio
async def test_preview_substitutes_logo_url(client, auth_headers, db_session):
    h = await _make_admin(client, auth_headers, db_session, "f", "acme-corp")
    res = await client.post(
        "/api/v1/workspaces/acme-corp/email-templates/booking_received_customer/preview",
        headers=h,
        json={
            "subject": "{title}",
            "body": "<img src='{organization_logo_url}'>",
            "is_html": True,
        },
    )
    # 워크스페이스 logo 미등록 → 변수는 빈 문자열로 치환 (더미 이미지 X)
    assert res.json()["body"] == "<img src=''>"
    assert "placehold" not in res.json()["body"]


@pytest.mark.asyncio
async def test_preview_brand_uses_img_when_logo_registered(
    client, auth_headers, db_session
):
    """워크스페이스 logo 등록 시 organization_brand 가 <img> 로 채워져야 한다."""
    h = await _make_admin(client, auth_headers, db_session, "f", "acme-corp")
    await client.put(
        "/api/v1/workspaces/acme-corp/profile",
        headers=h,
        json={"logo_url": "https://example.com/co/logo.svg"},
    )
    res = await client.post(
        "/api/v1/workspaces/acme-corp/email-templates/booking_received_customer/preview",
        headers=h,
        json={
            "subject": "{title}",
            "body": "<header>{organization_brand}</header>",
            "is_html": True,
        },
    )
    body = res.json()["body"]
    assert "<img" in body
    assert "https://example.com/co/logo.svg" in body
