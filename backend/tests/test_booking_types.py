"""/api/v1/booking-types: 운영자 CRUD + 권한 분기 (E-1)."""

import pytest


async def _make_personal_calendar(client, headers) -> str:
    res = await client.post(
        "/api/v1/calendars",
        headers=headers,
        json={"name": "My Cal", "scope": "personal", "color": "#3b82f6"},
    )
    assert res.status_code in (200, 201), res.text
    return res.json()["id"]


async def _make_shared_calendar(client, headers) -> str:
    res = await client.post(
        "/api/v1/calendars",
        headers=headers,
        json={"name": "Team Cal", "scope": "shared", "color": "#10b981"},
    )
    assert res.status_code in (200, 201), res.text
    return res.json()["id"]


_BASE_PAYLOAD = {
    "title": "30분 상담",
    "duration_minutes": 30,
    "timezone": "Asia/Seoul",
    "weekly_schedule": {"mon": [["09:00", "12:00"], ["13:00", "18:00"]]},
    "minimum_notice_minutes": 1440,
    "capacity": 1,
}


@pytest.mark.asyncio
async def test_create_user_owned(client, auth_headers):
    h = auth_headers("alice", groups=["acme-corp"], active_company="acme-corp")
    cal_id = await _make_personal_calendar(client, h)
    res = await client.post(
        "/api/v1/booking-types",
        headers=h,
        json={**_BASE_PAYLOAD, "owner_type": "user", "target_calendar_id": cal_id},
    )
    assert res.status_code == 201, res.text
    body = res.json()
    assert body["owner_type"] == "user"
    assert body["owner_user_sub"] == "alice"
    assert body["owner_company_id"] is None
    assert len(body["public_key"]) > 8
    # notify_user_subs 기본은 본인
    assert body["notify_user_subs"] == ["alice"]


@pytest.mark.asyncio
async def test_create_company_owned_requires_admin(client, auth_headers, db_session):
    from app.models.user_company_membership import UserCompanyMembership

    h = auth_headers("alice", groups=["acme-corp"], active_company="acme-corp")
    cal_id = await _make_shared_calendar(client, h)

    # 일반 멤버 → 403
    res = await client.post(
        "/api/v1/booking-types",
        headers=h,
        json={
            **_BASE_PAYLOAD,
            "owner_type": "company",
            "target_calendar_id": cal_id,
        },
    )
    assert res.status_code == 403

    # admin 승격 후 → 201
    m = await db_session.get(UserCompanyMembership, ("alice", "acme-corp"))
    m.role = "admin"
    await db_session.flush()

    res = await client.post(
        "/api/v1/booking-types",
        headers=h,
        json={
            **_BASE_PAYLOAD,
            "owner_type": "company",
            "target_calendar_id": cal_id,
        },
    )
    assert res.status_code == 201, res.text
    body = res.json()
    assert body["owner_type"] == "company"
    assert body["owner_company_id"] == "acme-corp"


@pytest.mark.asyncio
async def test_company_owned_requires_shared_calendar(client, auth_headers, db_session):
    """owner_type=company 면 target_calendar 가 shared 여야 함."""

    h = auth_headers("alice", groups=["acme-corp"], active_company="acme-corp", roles=["admin"])
    await client.get("/api/v1/me", headers=h)
    cal_id = await _make_personal_calendar(client, h)  # personal: 거부돼야

    res = await client.post(
        "/api/v1/booking-types",
        headers=h,
        json={
            **_BASE_PAYLOAD,
            "owner_type": "company",
            "target_calendar_id": cal_id,
        },
    )
    assert res.status_code == 400
    _ = db_session  # noqa


@pytest.mark.asyncio
async def test_weekly_schedule_validation(client, auth_headers):
    h = auth_headers("alice", groups=["acme-corp"], active_company="acme-corp")
    cal_id = await _make_personal_calendar(client, h)
    bad = {
        **_BASE_PAYLOAD,
        "owner_type": "user",
        "target_calendar_id": cal_id,
        "weekly_schedule": {"funday": [["09:00", "18:00"]]},  # 잘못된 요일
    }
    res = await client.post("/api/v1/booking-types", headers=h, json=bad)
    assert res.status_code == 422


@pytest.mark.asyncio
async def test_patch_and_delete(client, auth_headers):
    h = auth_headers("alice", groups=["acme-corp"], active_company="acme-corp")
    cal_id = await _make_personal_calendar(client, h)
    res = await client.post(
        "/api/v1/booking-types",
        headers=h,
        json={**_BASE_PAYLOAD, "owner_type": "user", "target_calendar_id": cal_id},
    )
    bt_id = res.json()["id"]

    # PATCH title
    res = await client.patch(
        f"/api/v1/booking-types/{bt_id}",
        headers=h,
        json={"title": "1시간 컨설팅", "duration_minutes": 60},
    )
    assert res.status_code == 200
    assert res.json()["title"] == "1시간 컨설팅"
    assert res.json()["duration_minutes"] == 60

    # rotate-key
    old_key = res.json()["public_key"]
    res = await client.post(
        f"/api/v1/booking-types/{bt_id}/rotate-key", headers=h
    )
    assert res.status_code == 200
    assert res.json()["public_key"] != old_key

    # DELETE
    res = await client.delete(f"/api/v1/booking-types/{bt_id}", headers=h)
    assert res.status_code == 204

    # 삭제 후 조회 404
    res = await client.get(f"/api/v1/booking-types/{bt_id}", headers=h)
    assert res.status_code == 404


@pytest.mark.asyncio
async def test_other_user_cannot_manage(client, auth_headers):
    """alice 의 BookingType 을 bob 이 못 만진다."""
    h_a = auth_headers("alice", groups=["acme-corp"], active_company="acme-corp")
    h_b = auth_headers("bob", groups=["acme-corp"], active_company="acme-corp")
    cal_id = await _make_personal_calendar(client, h_a)
    res = await client.post(
        "/api/v1/booking-types",
        headers=h_a,
        json={**_BASE_PAYLOAD, "owner_type": "user", "target_calendar_id": cal_id},
    )
    bt_id = res.json()["id"]

    res = await client.get(f"/api/v1/booking-types/{bt_id}", headers=h_b)
    assert res.status_code == 403

    res = await client.patch(
        f"/api/v1/booking-types/{bt_id}", headers=h_b, json={"title": "hack"}
    )
    assert res.status_code == 403
