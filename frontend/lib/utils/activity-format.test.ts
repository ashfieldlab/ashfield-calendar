import { describe, expect, it } from "vitest"

import type { ActivityItem } from "@/lib/types/activity"

import { activityKind, activitySentence, categoryOf, inScope, partsText } from "./activity-format"
import { formatDay, formatTime } from "./day-format"

const ME = "u-me"

function item(p: Partial<ActivityItem>): ActivityItem {
  return {
    id: "a",
    actor_sub: "u-2",
    actor_name: "김하늘",
    actor_type: "user",
    action: "update",
    entity_type: "event",
    entity_id: "e1",
    meta: {},
    created_at: new Date(2026, 9, 10, 10, 0).toISOString(),
    ...p,
  }
}

const say = (it: ActivityItem) => partsText(activitySentence(it, { meSub: ME }))

describe("activityKind", () => {
  it("일정 시간만 바뀌면 reschedule, 다른 필드가 섞이면 update", () => {
    const iso = new Date(2026, 9, 15, 14, 0).toISOString()
    expect(activityKind(item({ meta: { fields: ["start_at", "end_at"], old_start: iso, new_start: iso } }))).toBe("reschedule")
    expect(activityKind(item({ meta: { fields: ["start_at", "location"], old_start: iso, new_start: iso } }))).toBe("update")
  })

  it("종류별 분류", () => {
    expect(activityKind(item({ action: "share", meta: { invitee: "u-3" } }))).toBe("invite")
    expect(activityKind(item({ meta: { rsvp: "accepted" } }))).toBe("rsvp")
    expect(activityKind(item({ meta: { excluded_occurrence: "2026-10-24T01:00:00+00:00" } }))).toBe("skip")
    expect(activityKind(item({ entity_type: "booking", action: "create" }))).toBe("booked")
    expect(activityKind(item({ entity_type: "booking", action: "update" }))).toBe("booking_reschedule")
    expect(activityKind(item({ entity_type: "calendar", action: "create", meta: { source: "external_ics" } }))).toBe("cal_subscribe")
    expect(activityKind(item({ entity_type: "calendar", action: "update", meta: { refresh: true } }))).toBe("cal_refresh")
    expect(activityKind(item({ entity_type: "caldav_token", action: "caldav_token_revoke" }))).toBe("caldav_revoke")
    expect(categoryOf(item({ action: "unshare" }))).toBe("people")
    expect(categoryOf(item({ entity_type: "booking_type", action: "rotate_token" }))).toBe("booking")
  })
})

describe("activitySentence", () => {
  it("내가 만든 일정", () => {
    expect(say(item({ actor_sub: ME, action: "create", meta: { title: "치과" } }))).toBe("내가 치과를 만들었습니다")
  })

  it("필드 하나 변경은 새 값까지", () => {
    const it1 = item({ meta: { title: "주간 제품 회의", fields: ["location"], changes: { location: { from: "소회의실", to: "대회의실" } } } })
    expect(say(it1)).toBe("김하늘님이 주간 제품 회의의 장소를 대회의실로 바꿨습니다")
  })

  it("시간 변경", () => {
    const to = new Date(2026, 9, 15, 14, 0).toISOString()
    const s = say(item({ meta: { title: "서버 점검", fields: ["start_at", "end_at"], old_start: to, new_start: to } }))
    expect(s).toBe(`김하늘님이 서버 점검을 ${formatDay(to)} ${formatTime(to)}로 옮겼습니다`)
  })

  it("초대와 응답", () => {
    expect(say(item({ action: "share", meta: { title: "디자인 리뷰", invitee: "u-4", invitee_name: "박서준" } }))).toBe(
      "김하늘님이 디자인 리뷰에 박서준님을 초대했습니다",
    )
    expect(
      say(item({ action: "share", meta: { title: "디자인 리뷰", invitee_email: "dana@example.com", external: true } })),
    ).toBe("김하늘님이 디자인 리뷰에 dana@example.com을 초대했습니다")
    expect(say(item({ actor_sub: null, actor_name: null, actor_type: "public", meta: { title: "디자인 리뷰", rsvp: "tentative", guest_email: "dana@example.com" } }))).toBe(
      "dana@example.com 님이 디자인 리뷰 초대를 미정으로 답했습니다",
    )
  })

  it("손님 예약과 취소", () => {
    const slot = new Date(2026, 9, 13, 15, 0).toISOString()
    const base = { actor_sub: null, actor_name: null, actor_type: "public", entity_type: "booking" }
    expect(say(item({ ...base, action: "create", meta: { booking_type: "30분 상담", guest_name: "윤가람", slot_start_at: slot } }))).toBe(
      `윤가람님이 ${formatDay(slot)} ${formatTime(slot)}에 30분 상담을 예약했습니다`,
    )
    expect(say(item({ ...base, action: "delete", meta: { booking_type: "30분 상담", guest_name: "남궁민" } }))).toBe(
      "남궁민님이 30분 상담 예약을 취소했습니다",
    )
  })

  it("캘린더 설정", () => {
    expect(say(item({ actor_sub: ME, entity_type: "calendar", action: "import_ics", meta: { name: "내 일정", events: 42, filename: "old.ics" } }))).toBe(
      "내가 old.ics에서 내 일정으로 일정 42개를 가져왔습니다",
    )
    expect(say(item({ actor_sub: ME, entity_type: "caldav_token", action: "caldav_token_create", meta: { name: "맥북" } }))).toBe(
      "내가 앱 비밀번호 맥북을 만들었습니다",
    )
    expect(say(item({ actor_sub: ME, entity_type: "calendar", action: "update", meta: { name: "팀", old_name: "개발", fields: ["name"] } }))).toBe(
      "내가 캘린더 개발의 이름을 팀으로 바꿨습니다",
    )
  })
})

describe("inScope", () => {
  it("내 활동과 다른 사람", () => {
    const mine = item({ actor_sub: ME })
    const guest = item({ actor_sub: null, actor_type: "public" })
    expect(inScope(mine, "me", ME)).toBe(true)
    expect(inScope(mine, "others", ME)).toBe(false)
    expect(inScope(guest, "others", ME)).toBe(true)
    expect(inScope(guest, "all", ME)).toBe(true)
  })
})
