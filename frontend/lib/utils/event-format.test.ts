import { describe, expect, it } from "vitest"

import { allDayLastDay, describeRrule, durationLabel, hostOf, reminderLabel } from "./event-format"

describe("describeRrule", () => {
  it("빈 값과 기본 빈도", () => {
    expect(describeRrule(null)).toBe("")
    expect(describeRrule("FREQ=DAILY")).toBe("매일")
    expect(describeRrule("FREQ=MONTHLY")).toBe("매월")
    expect(describeRrule("RRULE:FREQ=YEARLY")).toBe("매년")
  })

  it("간격과 요일", () => {
    expect(describeRrule("FREQ=WEEKLY;BYDAY=MO,WE")).toBe("매주 월, 수")
    expect(describeRrule("FREQ=WEEKLY;INTERVAL=2;BYDAY=FR")).toBe("2주마다 금")
    expect(describeRrule("FREQ=DAILY;INTERVAL=3")).toBe("3일마다")
  })

  it("모르는 규칙", () => {
    expect(describeRrule("FREQ=HOURLY")).toBe("반복")
  })
})

describe("reminderLabel", () => {
  it("분, 시간, 일", () => {
    expect(reminderLabel(null)).toBe("")
    expect(reminderLabel(15)).toBe("15분 전 알림")
    expect(reminderLabel(60)).toBe("1시간 전 알림")
    expect(reminderLabel(1440)).toBe("1일 전 알림")
  })
})

describe("durationLabel", () => {
  it("시간과 분", () => {
    const s = new Date(2026, 9, 10, 9, 0)
    expect(durationLabel(s, new Date(2026, 9, 10, 10, 30))).toBe("1시간 30분")
    expect(durationLabel(s, new Date(2026, 9, 10, 9, 45))).toBe("45분")
    expect(durationLabel(s, new Date(2026, 9, 10, 11, 0))).toBe("2시간")
  })
})

describe("allDayLastDay", () => {
  it("다음 날 0시 끝은 하루 전", () => {
    const s = new Date(2026, 9, 3)
    expect(allDayLastDay(s, new Date(2026, 9, 4)).getDate()).toBe(3)
    expect(allDayLastDay(s, new Date(2026, 9, 6)).getDate()).toBe(5)
  })
})

describe("hostOf", () => {
  it("호스트만", () => {
    expect(hostOf("https://example.com/a.ics")).toBe("example.com")
    expect(hostOf(null)).toBe("")
  })
})
