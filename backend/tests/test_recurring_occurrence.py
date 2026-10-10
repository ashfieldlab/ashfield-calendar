"""반복 일정 '이 회차만 수정' — series EXDATE + 독립 이벤트 분리."""

from datetime import UTC, datetime, timedelta

from httpx import AsyncClient

ALICE = "user-alice"
ACME = "tenant-a"


async def _weekly_event(client, headers) -> dict:
    cal = (
        await client.post(
            "/api/v1/calendars",
            json={"name": "C", "scope": "shared"},
            headers=headers,
        )
    ).json()
    base = datetime(2026, 6, 1, 9, 0, tzinfo=UTC)  # 월요일
    return (
        await client.post(
            "/api/v1/events",
            json={
                "calendar_id": cal["id"],
                "title": "주간 회의",
                "start_at": base.isoformat(),
                "end_at": (base + timedelta(hours=1)).isoformat(),
                "rrule": "FREQ=WEEKLY",
            },
            headers=headers,
        )
    ).json()


async def test_edit_single_occurrence_detaches(client: AsyncClient, auth_headers):
    a = auth_headers(ALICE, groups=[ACME], active_company=ACME)
    ev = await _weekly_event(client, a)
    occ2 = datetime(2026, 6, 8, 9, 0, tzinfo=UTC)  # 둘째 회차

    # 이 회차만 제목/시간 변경
    r = await client.patch(
        f"/api/v1/events/{ev['id']}",
        params={"occurrence": occ2.isoformat()},
        json={
            "title": "주간 회의 (특별)",
            "start_at": datetime(2026, 6, 8, 14, 0, tzinfo=UTC).isoformat(),
            "end_at": datetime(2026, 6, 8, 15, 0, tzinfo=UTC).isoformat(),
        },
        headers=a,
    )
    assert r.status_code == 200
    new_ev = r.json()
    assert new_ev["id"] != ev["id"]
    assert new_ev["rrule"] is None  # 독립 이벤트
    assert new_ev["title"] == "주간 회의 (특별)"

    # 원 series 는 그 회차를 EXDATE 처리
    master = (await client.get(f"/api/v1/events/{ev['id']}", headers=a)).json()
    assert "2026-06-08T09:00:00+00:00" in master["recurrence_exceptions"]
    assert master["rrule"] == "FREQ=WEEKLY"

    # occurrence 목록: 6/1 원회차 有, 6/8 09:00 원회차 無, 6/8 14:00 독립 有
    params = {
        "from": datetime(2026, 6, 1, tzinfo=UTC).isoformat(),
        "to": datetime(2026, 6, 15, tzinfo=UTC).isoformat(),
    }
    occ = (
        await client.get("/api/v1/events", params=params, headers=a)
    ).json()["occurrences"]
    starts = {(o["event_id"], o["start_at"]) for o in occ}
    # 원 series 첫 회차 유지
    assert any(eid == ev["id"] and "2026-06-01T09:00" in s for eid, s in starts)
    # 원 series 둘째 회차(09:00)는 제거됨
    assert not any(
        eid == ev["id"] and "2026-06-08T09:00" in s for eid, s in starts
    )
    # 분리된 독립 이벤트(14:00) 노출
    assert any(
        eid == new_ev["id"] and "2026-06-08T14:00" in s for eid, s in starts
    )


async def test_edit_without_occurrence_still_series_wide(
    client: AsyncClient, auth_headers
):
    a = auth_headers(ALICE, groups=[ACME], active_company=ACME)
    ev = await _weekly_event(client, a)
    # occurrence 없이 PATCH → 전체 series 수정 (id 그대로)
    r = await client.patch(
        f"/api/v1/events/{ev['id']}",
        json={"title": "전체 변경"},
        headers=a,
    )
    assert r.status_code == 200
    assert r.json()["id"] == ev["id"]
    assert r.json()["title"] == "전체 변경"
    assert r.json()["rrule"] == "FREQ=WEEKLY"
