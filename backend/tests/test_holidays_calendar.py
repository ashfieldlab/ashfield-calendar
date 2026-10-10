"""기본 공휴일 캘린더: 자동 시드 + 관리형(편집·삭제 불가).

HOLIDAYS_ICS_URL 기본값은 비어 있다(시드 안 함). 시드 경로는 URL 을 지정해 검증한다.
"""

import pytest
from httpx import AsyncClient

from app.core.config import settings

HOLIDAYS_URL = "https://holidays.example.com/basic.ics"


@pytest.fixture
def holidays_url(monkeypatch):
    monkeypatch.setattr(settings, "holidays_ics_url", HOLIDAYS_URL)

ALICE = "user-alice"
ACME = "tenant-a"


async def test_no_holidays_calendar_when_url_empty(
    client: AsyncClient, auth_headers, monkeypatch
):
    monkeypatch.setattr(settings, "holidays_ics_url", "")
    a = auth_headers(ALICE, groups=[ACME], active_workspace=ACME)
    r = await client.get("/api/v1/calendars", headers=a)
    assert r.status_code == 200
    assert [c for c in r.json()["calendars"] if c["managed"]] == []


async def test_holidays_calendar_seeded_and_idempotent(
    client: AsyncClient, auth_headers, holidays_url
):
    a = auth_headers(ALICE, groups=[ACME], active_workspace=ACME)
    r = await client.get("/api/v1/calendars", headers=a)
    assert r.status_code == 200
    managed = [c for c in r.json()["calendars"] if c["managed"]]
    assert len(managed) == 1
    hol = managed[0]
    assert hol["name"] == "대한민국 공휴일"
    assert hol["source"] == "external_ics"
    assert hol["scope"] == "shared"

    # 다시 불러도 중복 시드 없음
    r2 = await client.get("/api/v1/calendars", headers=a)
    assert len([c for c in r2.json()["calendars"] if c["managed"]]) == 1


async def test_managed_calendar_undeletable_and_uneditable(
    client: AsyncClient, auth_headers, holidays_url
):
    a = auth_headers(ALICE, groups=[ACME], active_workspace=ACME)
    cals = (await client.get("/api/v1/calendars", headers=a)).json()["calendars"]
    hol = next(c for c in cals if c["managed"])

    r = await client.delete(f"/api/v1/calendars/{hol['id']}", headers=a)
    assert r.status_code == 403

    r = await client.patch(
        f"/api/v1/calendars/{hol['id']}", json={"name": "바꾸기"}, headers=a
    )
    assert r.status_code == 403


async def test_managed_calendar_hideable_via_preference(
    client: AsyncClient, auth_headers, holidays_url
):
    """삭제는 못 해도 개인 숨김(preference)은 가능해야 한다."""
    a = auth_headers(ALICE, groups=[ACME], active_workspace=ACME)
    cals = (await client.get("/api/v1/calendars", headers=a)).json()["calendars"]
    hol = next(c for c in cals if c["managed"])
    r = await client.patch(
        f"/api/v1/calendars/{hol['id']}/preferences",
        json={"hidden": True},
        headers=a,
    )
    assert r.status_code == 200
    assert r.json()["hidden"] is True
