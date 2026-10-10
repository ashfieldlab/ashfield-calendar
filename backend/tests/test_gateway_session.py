"""게이트웨이 세션(X-Ashfield-Session-ID) 인증 경로.

운영 웹은 BFF 가 ashfield_sid 를 헤더로 넘기고 백엔드가 게이트웨이 `/auth/me` 에 묻는다.
게이트웨이는 httpx MockTransport 로 대체한다.
"""

import httpx
import pytest

from app.auth import gateway_session
from app.core.config import settings

ME = {
    "sub": "gw-user",
    "email": "gw@test.local",
    "name": "게이트웨이 사용자",
    # IdP 그룹 — 소속 판정엔 안 쓴다 (디렉터리 서비스가 원천)
    "companies": ["/stale-idp-group"],
    "roles": ["admin"],
}
# 게이트웨이 /api/v1/me/context — 소속의 원천. id = Company PK, name = 표시 이름.
DIRECTORY_CONTEXT = {
    "companies": [{"id": "acme-corp", "name": "ACME 주식회사"}],
}


@pytest.fixture
def gateway(monkeypatch):
    """게이트웨이 응답을 흉내낸다. calls 에 받은 요청을 쌓는다."""
    calls: list[httpx.Request] = []
    state = {"status": 200, "body": ME, "raise": False, "directory_status": 200}

    def handler(request: httpx.Request) -> httpx.Response:
        calls.append(request)
        if state["raise"]:
            raise httpx.ConnectError("down", request=request)
        if request.url.path.endswith("/me/context"):
            return httpx.Response(state["directory_status"], json=DIRECTORY_CONTEXT)
        return httpx.Response(state["status"], json=state["body"])

    real_client = httpx.AsyncClient
    monkeypatch.setattr(
        gateway_session.httpx,
        "AsyncClient",
        lambda **kw: real_client(transport=httpx.MockTransport(handler), **kw),
    )
    monkeypatch.setattr(settings, "gateway_url", "https://gw.test")
    return calls, state


@pytest.mark.asyncio
async def test_session_header_resolves_identity(client, gateway):
    calls, _ = gateway
    res = await client.get("/api/v1/me", headers={"X-Ashfield-Session-ID": "sid-1"})
    assert res.status_code == 200
    body = res.json()
    assert body["sub"] == "gw-user"
    # 소속은 디렉터리 서비스의 회사(PK). IdP 그룹은 안 쓴다.
    assert body["groups"] == ["acme-corp"]
    assert body["is_system_admin"] is True
    assert str(calls[0].url) == "https://gw.test/auth/me"
    assert calls[0].headers["X-Ashfield-Session-ID"] == "sid-1"
    assert str(calls[1].url) == "https://gw.test/api/v1/me/context"


async def test_company_display_name_from_directory(client, gateway, db_session):
    from app.models.company import Company

    await client.get("/api/v1/me", headers={"X-Ashfield-Session-ID": "sid-names"})
    company = await db_session.get(Company, "acme-corp")
    assert company is not None and company.name == "ACME 주식회사"


async def test_directory_down_is_503_not_empty_membership(client, gateway):
    """빈 목록으로 바꾸면 사용자가 "접근 권한 없음" 으로 튕긴다."""
    _, state = gateway
    state["directory_status"] = 502
    r = await client.get("/api/v1/me", headers={"X-Ashfield-Session-ID": "sid-directory-down"})
    assert r.status_code == 503


@pytest.mark.asyncio
async def test_session_lookup_is_cached(client, gateway):
    calls, _ = gateway
    for _ in range(2):
        res = await client.get("/api/v1/me", headers={"X-Ashfield-Session-ID": "sid-2"})
        assert res.status_code == 200
    assert len(calls) == 2  # /auth/me + 소속 조회, 두 번째 요청은 캐시


@pytest.mark.asyncio
async def test_dead_session_is_401(client, gateway):
    _, state = gateway
    state["status"] = 401
    res = await client.get("/api/v1/me", headers={"X-Ashfield-Session-ID": "dead"})
    assert res.status_code == 401


@pytest.mark.asyncio
async def test_gateway_down_is_503_not_401(client, gateway):
    """401 이면 프론트가 로그인으로 튕기고 그 로그인도 실패해 무한 왕복이 된다."""
    _, state = gateway
    state["raise"] = True
    res = await client.get("/api/v1/me", headers={"X-Ashfield-Session-ID": "sid-3"})
    assert res.status_code == 503


@pytest.mark.asyncio
async def test_bearer_wins_over_session(client, gateway, auth_headers):
    calls, _ = gateway
    headers = {**auth_headers("alice", groups=["beta-co"]), "X-Ashfield-Session-ID": "sid-4"}
    res = await client.get("/api/v1/me", headers=headers)
    assert res.status_code == 200
    assert res.json()["sub"] == "alice"
    # 게이트웨이엔 안 물었다 (JWKS 공개키 조회는 같은 httpx 패치에 잡힐 수 있어 제외)
    assert [c for c in calls if c.url.host == "gw.test"] == []
