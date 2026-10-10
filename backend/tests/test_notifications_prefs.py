"""이메일 알림 카테고리별 설정: resolve_recipient 게이팅 + API 병합."""

import pytest
from httpx import AsyncClient

from app.models.user import User
from app.models.user_notification_preference import UserNotificationPreference
from app.services.email import resolve_recipient

ALICE = "user-alice"
ACME = "tenant-a"


@pytest.mark.asyncio
async def test_resolve_recipient_category_gating(db_session):
    db_session.add(User(id="u-cat", email="cat@x"))
    db_session.add(
        UserNotificationPreference(
            user_sub="u-cat",
            email_enabled=True,
            email_categories={"event": False},
        )
    )
    await db_session.flush()

    # event 카테고리 off → 발송 안 함
    assert (
        await resolve_recipient(
            db_session, recipient_sub="u-cat", event_type="event_invited"
        )
        is None
    )
    # booking 카테고리는 on(기본) → 이메일 반환
    assert (
        await resolve_recipient(
            db_session, recipient_sub="u-cat", event_type="booking_received"
        )
        == "cat@x"
    )
    # 카테고리 없는 유형(event_reminder) → 게이팅 안 함, 이메일 반환
    assert (
        await resolve_recipient(
            db_session, recipient_sub="u-cat", event_type="event_reminder"
        )
        == "cat@x"
    )


@pytest.mark.asyncio
async def test_master_off_overrides_categories(db_session):
    db_session.add(User(id="u-off", email="off@x"))
    db_session.add(
        UserNotificationPreference(
            user_sub="u-off", email_enabled=False, email_categories={}
        )
    )
    await db_session.flush()
    # 마스터 off → 카테고리 무관 전체 None
    assert (
        await resolve_recipient(
            db_session, recipient_sub="u-off", event_type="event_invited"
        )
        is None
    )


@pytest.mark.asyncio
async def test_patch_preferences_merges_categories(client: AsyncClient, auth_headers):
    h = auth_headers(ALICE, groups=[ACME], active_workspace=ACME)
    # event off
    r = await client.patch(
        "/api/v1/notifications/preferences",
        json={"email_categories": {"event": False}},
        headers=h,
    )
    assert r.status_code == 200
    assert r.json()["email_categories"]["event"] is False
    assert r.json()["email_enabled"] is True  # 마스터는 안 건드림

    # booking off 추가 → event 는 유지(병합)
    r = await client.patch(
        "/api/v1/notifications/preferences",
        json={"email_categories": {"booking": False}},
        headers=h,
    )
    cats = r.json()["email_categories"]
    assert cats["event"] is False
    assert cats["booking"] is False
