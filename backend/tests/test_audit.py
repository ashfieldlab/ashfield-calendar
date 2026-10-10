"""audit_logs — mutation 후 row 생성 + admin 필요."""

from httpx import AsyncClient


async def _calendar(client, headers, name="C"):
    return (
        await client.post(
            "/api/v1/calendars",
            json={"name": name, "scope": "personal"},
            headers=headers,
        )
    ).json()

ALICE = "user-alice"
ADMIN = "user-admin"
ACME = "tenant-a"


async def test_calendar_create_writes_audit(client: AsyncClient, auth_headers):
    h = auth_headers(ALICE, groups=[ACME], active_company=ACME)
    cal_id = (await _calendar(client, h, "Foo"))["id"]

    a = auth_headers(ADMIN, groups=[ACME], roles=["admin"], active_company=ACME)
    r = await client.get("/api/v1/audit", headers=a)
    assert r.status_code == 200
    logs = r.json()["logs"]
    assert any(
        log["entity_type"] == "calendar"
        and log["action"] == "create"
        and log["entity_id"] == cal_id
        for log in logs
    )


async def test_audit_requires_admin(client: AsyncClient, auth_headers):
    h = auth_headers(ALICE, groups=[ACME], active_company=ACME)
    r = await client.get("/api/v1/audit", headers=h)
    assert r.status_code == 403


async def test_audit_filter_by_entity_type(client: AsyncClient, auth_headers):
    user = auth_headers(ALICE, groups=[ACME], active_company=ACME)
    admin = auth_headers(ADMIN, groups=[ACME], roles=["admin"], active_company=ACME)

    cal = (
        await client.post(
            "/api/v1/calendars",
            json={"name": "C", "scope": "personal"},
            headers=user,
        )
    ).json()
    await client.delete(f"/api/v1/calendars/{cal['id']}", headers=user)

    r = await client.get("/api/v1/audit?entity_type=calendar", headers=admin)
    assert r.status_code == 200
    logs = r.json()["logs"]
    assert all(log["entity_type"] == "calendar" for log in logs)
    assert any(log["action"] == "create" for log in logs)
    assert any(log["action"] == "delete" for log in logs)


async def test_company_admin_can_view_company_audit(
    client: AsyncClient, auth_headers, db_session
):
    """system admin 아닌 회사 admin 이 자기 회사 감사 로그 조회."""
    from app.models.user_company_membership import UserCompanyMembership

    # BOB 을 회사 멤버로 upsert 후 admin 승격
    bob = auth_headers("user-bob", groups=[ACME], active_company=ACME)
    await client.get("/api/v1/me", headers=bob)
    m = await db_session.get(UserCompanyMembership, ("user-bob", ACME))
    m.role = "admin"
    await db_session.flush()

    # ALICE 가 캘린더 생성 → audit row
    await _calendar(client, auth_headers(ALICE, groups=[ACME], active_company=ACME))

    r = await client.get("/api/v1/audit?scope=company", headers=bob)
    assert r.status_code == 200
    assert any(log["entity_type"] == "calendar" for log in r.json()["logs"])


async def test_company_admin_denied_system_scope(
    client: AsyncClient, auth_headers, db_session
):
    from app.models.user_company_membership import UserCompanyMembership

    bob = auth_headers("user-bob", groups=[ACME], active_company=ACME)
    await client.get("/api/v1/me", headers=bob)
    m = await db_session.get(UserCompanyMembership, ("user-bob", ACME))
    m.role = "admin"
    await db_session.flush()

    r = await client.get("/api/v1/audit?scope=system", headers=bob)
    assert r.status_code == 403


async def test_audit_filter_by_action(client: AsyncClient, auth_headers):
    user = auth_headers(ALICE, groups=[ACME], active_company=ACME)
    admin = auth_headers(ADMIN, groups=[ACME], roles=["admin"], active_company=ACME)
    cal = await _calendar(client, user)
    await client.delete(f"/api/v1/calendars/{cal['id']}", headers=user)

    r = await client.get("/api/v1/audit?action=delete", headers=admin)
    assert r.status_code == 200
    assert all(log["action"] == "delete" for log in r.json()["logs"])


async def test_audit_csv_export(client: AsyncClient, auth_headers):
    user = auth_headers(ALICE, groups=[ACME], active_company=ACME)
    admin = auth_headers(ADMIN, groups=[ACME], roles=["admin"], active_company=ACME)
    await _calendar(client, user)

    r = await client.get("/api/v1/audit/export.csv", headers=admin)
    assert r.status_code == 200
    assert "text/csv" in r.headers["content-type"]
    assert "attachment" in r.headers["content-disposition"]
    body = r.text
    assert "시각" in body  # 헤더 행
    assert "calendar" in body
