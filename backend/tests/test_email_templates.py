"""/api/v1/workspaces/{id}/email-templates: override CRUD + 변수 검증 + 권한."""

import pytest


async def _make_admin(client, auth_headers, db_session, sub: str, workspace: str):
    from app.models.user_workspace_membership import UserWorkspaceMembership

    h = auth_headers(sub, groups=[workspace], active_workspace=workspace)
    await client.get("/api/v1/me", headers=h)
    m = await db_session.get(UserWorkspaceMembership, (sub, workspace))
    m.role = "admin"
    await db_session.flush()
    return h


@pytest.mark.asyncio
async def test_member_cannot_manage(client, auth_headers):
    h = auth_headers("u1", groups=["acme-corp"], active_workspace="acme-corp")
    await client.get("/api/v1/me", headers=h)
    res = await client.get(
        "/api/v1/workspaces/acme-corp/email-templates", headers=h
    )
    assert res.status_code == 403


@pytest.mark.asyncio
async def test_list_shows_all_customizable(client, auth_headers, db_session):
    h = await _make_admin(client, auth_headers, db_session, "f", "acme-corp")
    res = await client.get(
        "/api/v1/workspaces/acme-corp/email-templates", headers=h
    )
    assert res.status_code == 200
    items = res.json()["items"]
    event_types = {i["event_type"] for i in items}
    assert event_types == {
        "booking_received_customer",
        "booking_cancelled_customer",
        "booking_rescheduled_customer",
        "event_invited",
        "event_invitation_response",
        "event_reminder",
    }
    for i in items:
        assert i["overridden"] is False
        # organization_brand 는 모든 customizable 종류 공통 변수
        assert "organization_brand" in i["variables"]


@pytest.mark.asyncio
async def test_get_returns_system_default_when_no_override(
    client, auth_headers, db_session
):
    h = await _make_admin(client, auth_headers, db_session, "f", "acme-corp")
    res = await client.get(
        "/api/v1/workspaces/acme-corp/email-templates/booking_received_customer",
        headers=h,
    )
    assert res.status_code == 200
    body = res.json()
    assert body["overridden"] is False
    assert "예약" in body["subject"]
    assert body["subject"] == body["default_subject"]


@pytest.mark.asyncio
async def test_put_then_get_returns_override(client, auth_headers, db_session):
    h = await _make_admin(client, auth_headers, db_session, "f", "acme-corp")
    payload = {
        "subject": "[{organization_name}] {title} 신청 완료",
        "body": "{customer_name}님, {slot_start_local} 에 만나요. 취소: {cancel_url}",
    }
    res = await client.put(
        "/api/v1/workspaces/acme-corp/email-templates/booking_received_customer",
        headers=h,
        json=payload,
    )
    assert res.status_code == 200, res.text
    assert res.json()["overridden"] is True

    g = await client.get(
        "/api/v1/workspaces/acme-corp/email-templates/booking_received_customer",
        headers=h,
    )
    assert g.json()["subject"] == payload["subject"]


@pytest.mark.asyncio
async def test_put_rejects_unknown_variable(client, auth_headers, db_session):
    h = await _make_admin(client, auth_headers, db_session, "f", "acme-corp")
    res = await client.put(
        "/api/v1/workspaces/acme-corp/email-templates/booking_received_customer",
        headers=h,
        json={"subject": "{title}", "body": "hi {ghost_var}"},
    )
    assert res.status_code == 400
    assert "ghost_var" in res.text


@pytest.mark.asyncio
async def test_put_rejects_non_customizable_event_type(
    client, auth_headers, db_session
):
    h = await _make_admin(client, auth_headers, db_session, "f", "acme-corp")
    # booking_received_operator 는 _TEMPLATES 에 있지만 운영자용 plain text 이라
    # 커스터마이즈 화이트리스트(CUSTOMIZABLE_EVENT_TYPES) 에는 미등록 → 404 기대
    res = await client.put(
        "/api/v1/workspaces/acme-corp/email-templates/booking_received_operator",
        headers=h,
        json={"subject": "x", "body": "y"},
    )
    assert res.status_code == 404


@pytest.mark.asyncio
async def test_delete_falls_back_to_default(client, auth_headers, db_session):
    h = await _make_admin(client, auth_headers, db_session, "f", "acme-corp")
    await client.put(
        "/api/v1/workspaces/acme-corp/email-templates/booking_received_customer",
        headers=h,
        json={"subject": "{title}", "body": "{customer_name}"},
    )
    res = await client.delete(
        "/api/v1/workspaces/acme-corp/email-templates/booking_received_customer",
        headers=h,
    )
    assert res.status_code == 204
    g = await client.get(
        "/api/v1/workspaces/acme-corp/email-templates/booking_received_customer",
        headers=h,
    )
    assert g.json()["overridden"] is False
    assert g.json()["subject"] == g.json()["default_subject"]


@pytest.mark.asyncio
async def test_preview_renders_sample_variables(client, auth_headers, db_session):
    h = await _make_admin(client, auth_headers, db_session, "f", "acme-corp")
    res = await client.post(
        "/api/v1/workspaces/acme-corp/email-templates/booking_received_customer/preview",
        headers=h,
        json={
            "subject": "[{organization_name}] {title}",
            "body": "{customer_name}님, {slot_start_local}",
        },
    )
    assert res.status_code == 200
    body = res.json()
    # 미리보기는 워크스페이스 등록 이름이 있으면 그걸 사용: lazy upsert 된 acme-corp
    assert "acme-corp" in body["subject"]
    assert "홍길동" in body["body"]


@pytest.mark.asyncio
async def test_cross_workspace_isolation(client, auth_headers, db_session):
    h = await _make_admin(client, auth_headers, db_session, "f", "acme-corp")
    res = await client.put(
        "/api/v1/workspaces/beta-co/email-templates/booking_received_customer",
        headers=h,
        json={"subject": "{title}", "body": "{customer_name}"},
    )
    assert res.status_code == 403


@pytest.mark.asyncio
async def test_put_html_with_text_fallback(client, auth_headers, db_session):
    h = await _make_admin(client, auth_headers, db_session, "f", "acme-corp")
    payload = {
        "subject": "[{organization_name}] {title}",
        "body": "<p>{customer_name}님: <b>{slot_start_local}</b></p>",
        "is_html": True,
        "text_fallback": "{customer_name}님: {slot_start_local}",
    }
    res = await client.put(
        "/api/v1/workspaces/acme-corp/email-templates/booking_received_customer",
        headers=h,
        json=payload,
    )
    assert res.status_code == 200, res.text
    j = res.json()
    assert j["is_html"] is True
    assert j["text_fallback"] == payload["text_fallback"]


@pytest.mark.asyncio
async def test_delete_falls_back_to_system_default_is_html(
    client, auth_headers, db_session
):
    """DELETE 후엔 시스템 기본 따름. booking_received_customer 시스템 기본은 HTML."""
    h = await _make_admin(client, auth_headers, db_session, "f", "acme-corp")
    await client.put(
        "/api/v1/workspaces/acme-corp/email-templates/booking_received_customer",
        headers=h,
        json={
            "subject": "{title}",
            "body": "{customer_name}",
            "is_html": False,
        },
    )
    await client.delete(
        "/api/v1/workspaces/acme-corp/email-templates/booking_received_customer",
        headers=h,
    )
    g = await client.get(
        "/api/v1/workspaces/acme-corp/email-templates/booking_received_customer",
        headers=h,
    )
    j = g.json()
    assert j["overridden"] is False
    assert j["is_html"] is True
    assert j["default_is_html"] is True


@pytest.mark.asyncio
async def test_preview_returns_html_flag(client, auth_headers, db_session):
    h = await _make_admin(client, auth_headers, db_session, "f", "acme-corp")
    res = await client.post(
        "/api/v1/workspaces/acme-corp/email-templates/booking_received_customer/preview",
        headers=h,
        json={
            "subject": "{title}",
            "body": "<b>{customer_name}</b>",
            "is_html": True,
            "text_fallback": "{customer_name}",
        },
    )
    j = res.json()
    assert j["is_html"] is True
    assert "<b>홍길동</b>" in j["body"]
    assert j["text_fallback"] == "홍길동"


@pytest.mark.asyncio
async def test_render_returns_html_rendered_email(client, auth_headers, db_session):
    """services/email.render() 가 RenderedEmail(is_html=True) 로 응답."""
    h = auth_headers("u1", groups=["acme-corp"], active_workspace="acme-corp")
    await client.get("/api/v1/me", headers=h)

    from app.models.email_template import WorkspaceEmailTemplate
    from app.services.email import _html_to_text, render

    db_session.add(
        WorkspaceEmailTemplate(
            workspace_id="acme-corp",
            event_type="booking_received_customer",
            subject="HTML: {title}",
            body="<p>안녕 {customer_name}</p>",
            is_html=True,
            text_fallback=None,
        )
    )
    await db_session.commit()

    out = await render(
        db_session,
        "booking_received_customer",
        {
            "customer_name": "홍길동",
            "title": "1:1",
            "slot_start_local": "내일 3시",
            "cancel_url": "x",
            "organization_name": "Ashfield",
        },
        actor_name="",
        workspace_id="acme-corp",
    )
    assert out is not None
    assert out.is_html is True
    assert "<p>" in out.body
    # text_fallback 비어 있어도 _send_sync 가 _html_to_text 로 자동 strip 가능
    assert "홍길동" in _html_to_text(out.body)


@pytest.mark.asyncio
async def test_resolve_render_uses_workspace_override(
    client, auth_headers, db_session
):
    """services/email.render() 가 워크스페이스 override 우선 적용한다."""
    # workspace row 가 있어야 FK 통과: lazy upsert
    h = auth_headers("u1", groups=["acme-corp"], active_workspace="acme-corp")
    await client.get("/api/v1/me", headers=h)

    from app.models.email_template import WorkspaceEmailTemplate
    from app.services.email import render

    db_session.add(
        WorkspaceEmailTemplate(
            workspace_id="acme-corp",
            event_type="booking_received_customer",
            subject="OVERRIDE: {title}",
            body="안녕 {customer_name}",
        )
    )
    await db_session.commit()

    out = await render(
        db_session,
        "booking_received_customer",
        {
            "customer_name": "홍길동",
            "title": "1:1",
            "slot_start_local": "내일 3시",
            "cancel_url": "x",
            "organization_name": "Ashfield",
        },
        actor_name="",
        workspace_id="acme-corp",
    )
    assert out is not None
    assert out.subject.startswith("OVERRIDE")
    assert "홍길동" in out.body
    assert out.is_html is False
