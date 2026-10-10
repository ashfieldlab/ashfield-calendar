import { describe, expect, it } from "vitest"

import type { NotificationItem } from "@/lib/types/notification"

import { partsText } from "./activity-format"
import { formatDay, formatTime } from "./day-format"
import { changeRows, needsResponse, notifDetail, notifHref, notifSentence, toView } from "./notification-format"

const start = new Date(2026, 9, 12, 10, 0).toISOString()
const end = new Date(2026, 9, 12, 11, 0).toISOString()

function notif(p: Partial<NotificationItem>): NotificationItem {
  return {
    id: "n1",
    type: "event_invited",
    actor_sub: "u-2",
    actor_name: "김하늘",
    entity_type: "event",
    entity_id: "e1",
    payload: { title: "주간 제품 회의", start_at: start },
    read_at: null,
    created_at: new Date(2026, 9, 10, 9, 0).toISOString(),
    event: {
      id: "e1",
      title: "주간 제품 회의",
      start_at: start,
      end_at: end,
      all_day: false,
      location: "대회의실",
      calendar_id: "c1",
      calendar_name: "팀",
      calendar_color: "#3b82f6",
      deleted: false,
    },
    invitation: { id: "i1", event_id: "e1", response: "pending" },
    ...p,
  }
}

describe("toView", () => {
  it("초대: 내 응답과 응답 필요", () => {
    const v = toView(notif({}))
    expect(v.invitationId).toBe("i1")
    expect(needsResponse(v)).toBe(true)
    expect(partsText(notifSentence(v))).toBe("김하늘님이 주간 제품 회의에 초대했습니다")
    expect(notifDetail(v)).toBe(`${formatDay(start)} ${formatTime(start)} ~ ${formatTime(end)}, 대회의실`)
    expect(notifHref(v)).toBe(`/calendar?${new URLSearchParams({ event: "e1", start, end })}`)
    expect(needsResponse(toView(notif({ invitation: { id: "i1", event_id: "e1", response: "accepted" } })))).toBe(false)
  })

  it("취소된 일정은 열 수 없음", () => {
    const v = toView(
      notif({
        type: "event_cancelled",
        invitation: null,
        event: { ...notif({}).event!, deleted: true },
      }),
    )
    expect(v.eventId).toBeNull()
    expect(notifHref(v)).toBe("/calendar")
    expect(partsText(notifSentence(v))).toBe("김하늘님이 주간 제품 회의를 취소했습니다")
  })

  it("변경: 전후 표", () => {
    const oldStart = new Date(2026, 9, 12, 9, 30).toISOString()
    const payload = {
      title: "주간 제품 회의",
      fields: ["start_at", "end_at", "location"],
      changes: { location: { from: "소회의실", to: "대회의실" } },
      old_start: oldStart,
      new_start: start,
    }
    const rows = changeRows(payload)
    expect(rows).toEqual([
      { label: "시간", from: `${formatDay(oldStart)} ${formatTime(oldStart)}`, to: `${formatDay(start)} ${formatTime(start)}` },
      { label: "장소", from: "소회의실", to: "대회의실" },
    ])
    const v = toView(notif({ type: "event_updated", payload, invitation: null }))
    expect(v.oldStart).toBe(oldStart)
    expect(notifDetail(v)).toContain("장소 대회의실")
  })

  it("예약: 손님 정보와 예약 양식 주소", () => {
    const v = toView(
      notif({
        type: "booking_received",
        actor_sub: null,
        actor_name: null,
        entity_type: "booking",
        entity_id: "b1",
        payload: { title: "30분 상담", customer_name: "윤가람", booking_type_id: "bt1" },
        invitation: null,
        booking: {
          id: "b1",
          booking_type_id: "bt1",
          status: "active",
          slot_start_at: start,
          slot_end_at: end,
          customer_name: "윤가람",
          customer_email: "garam@example.com",
          calendar_event_id: "e1",
        },
      }),
    )
    expect(partsText(notifSentence(v))).toBe("윤가람님이 30분 상담을 예약했습니다")
    expect(v.customerEmail).toBe("garam@example.com")
    expect(notifHref(v)).toBe("/booking-types/bt1")
  })

  it("리마인더", () => {
    const v = toView(
      notif({ type: "event_reminder", actor_sub: null, actor_name: null, payload: { title: "스탠드업", minutes_before: 15, occurrence_start: start }, invitation: null }),
    )
    expect(partsText(notifSentence(v))).toBe("주간 제품 회의 시작 15분 전")
  })
})
