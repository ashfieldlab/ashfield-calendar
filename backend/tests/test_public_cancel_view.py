"""공개 취소 링크 요약: GET /api/public/v1/booking/cancel/{token} (ADR-0011 노출 최소화)."""

import pytest

from tests.test_public_booking import _MON, _setup_bt


async def _book(client, auth_headers) -> str:
    pk = await _setup_bt(client, auth_headers)
    res = await client.post(
        f"/api/public/v1/booking/{pk}/submit",
        json={
            "slot_start_at": _MON.isoformat(),
            "customer_name": "윤가람",
            "customer_email": "garam@example.com",
            "consent": True,
        },
    )
    assert res.status_code == 201, res.text
    return res.json()["cancel_token"]


@pytest.mark.asyncio
async def test_cancel_view_shows_own_booking(client, auth_headers):
    token = await _book(client, auth_headers)
    res = await client.get(f"/api/public/v1/booking/cancel/{token}")
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["title"] == "30분 상담"
    assert body["customer_email"] == "garam@example.com"
    assert body["status"] == "active"
    assert body["slot_start_at"].startswith(_MON.strftime("%Y-%m-%d"))
    # 운영자 신원, 예약자 이름, 메모는 내보내지 않는다
    assert set(body) == {
        "title",
        "organization_name",
        "slot_start_at",
        "slot_end_at",
        "customer_email",
        "status",
    }


@pytest.mark.asyncio
async def test_cancel_view_after_cancel_is_cancelled(client, auth_headers):
    token = await _book(client, auth_headers)
    await client.post(f"/api/public/v1/booking/cancel/{token}")
    res = await client.get(f"/api/public/v1/booking/cancel/{token}")
    assert res.status_code == 200
    assert res.json()["status"] == "cancelled"


@pytest.mark.asyncio
async def test_cancel_view_unknown_token_404(client):
    res = await client.get("/api/public/v1/booking/cancel/not-a-real-token")
    assert res.status_code == 404


@pytest.mark.asyncio
async def test_public_booking_audit_has_names(client, auth_headers):
    """예약 audit meta 에 예약자 이름, 양식 이름: 활동 문장용."""
    await _book(client, auth_headers)
    h = auth_headers("alice", groups=["acme-corp"], active_workspace="acme-corp")
    res = await client.get("/api/v1/me/activity", headers=h)
    items = [i for i in res.json()["items"] if i["entity_type"] == "booking"]
    assert items, res.json()
    meta = items[0]["meta"]
    assert meta["guest_name"] == "윤가람"
    assert meta["booking_type"] == "30분 상담"
    assert "ip" not in meta
    assert items[0]["actor_type"] == "public"
