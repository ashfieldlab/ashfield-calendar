import { describe, expect, it } from "vitest"

import { ApiError } from "./errors"

describe("ROOM_CONFLICT", () => {
  it("겹치는 시간을 보여준다", () => {
    const err = new ApiError(409, {
      code: "ROOM_CONFLICT",
      params: {
        start_at: "2026-10-11T13:00:00",
        end_at: "2026-10-11T14:00:00",
        all_day: false,
      },
    })
    expect(err.message).toBe(
      "회의실이 이미 예약된 시간입니다 (10월 11일 (일) 오후 1:00 ~ 오후 2:00). 다른 시간이나 회의실을 선택해주세요.",
    )
  })

  it("읽을 수 있는 일정이면 제목도 보여준다", () => {
    const err = new ApiError(409, {
      code: "ROOM_CONFLICT",
      params: {
        title: "재미없는 이벤트 1",
        start_at: "2026-10-11T13:00:00",
        end_at: "2026-10-11T14:00:00",
        all_day: false,
      },
    })
    expect(err.message).toBe(
      "회의실이 '재미없는 이벤트 1' (10월 11일 (일) 오후 1:00 ~ 오후 2:00) 일정과 겹칩니다. 다른 시간이나 회의실을 선택해주세요.",
    )
  })

  it("params 가 없으면 시간 없이", () => {
    const err = new ApiError(409, { code: "ROOM_CONFLICT" })
    expect(err.message).toBe("회의실이 이미 예약된 시간입니다. 다른 시간이나 회의실을 선택해주세요.")
  })
})
