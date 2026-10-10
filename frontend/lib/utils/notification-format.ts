/**
 * 알림: 백엔드 알림(type + payload + 일정, 초대, 예약 컨텍스트)을 화면용 모양과 한 줄 문장으로.
 *
 * 문장은 activity-format 과 같은 조각(Part) 배열: 화면이 일정 제목 강조를 꾸민다.
 */

import type { NotificationItem, RsvpResponse } from "@/lib/types/notification"
import { FIELD_LABEL, type Part } from "./activity-format"
import { formatDay, formatTime, rangeText, whenText } from "./day-format"
import { josaEul } from "./josa"

export type NotifType =
  | "event_invited"
  | "event_updated"
  | "event_cancelled"
  | "event_invitation_response"
  | "event_reminder"
  | "booking_received"
  | "booking_rescheduled"
  | "booking_cancelled"

export const KNOWN_TYPES: NotifType[] = [
  "event_invited",
  "event_updated",
  "event_cancelled",
  "event_invitation_response",
  "event_reminder",
  "booking_received",
  "booking_rescheduled",
  "booking_cancelled",
]

export interface ChangeRow {
  label: string
  from: string
  to: string
}

/** 화면이 쓰는 알림 한 건 */
export interface NotifView {
  id: string
  type: string
  actorSub: string | null
  actorName: string | null
  at: string
  read: boolean
  /** 열 수 있는 일정 id (삭제됐으면 null) */
  eventId: string | null
  title: string
  start: string | null
  end: string | null
  allDay: boolean
  location: string | null
  calendarName: string | null
  calendarColor: string | null
  oldStart: string | null
  changes: ChangeRow[]
  /** 응답 알림: 상대의 응답 */
  response: RsvpResponse | null
  /** 초대 알림: 내 현재 응답과 초대 id */
  myRsvp: RsvpResponse | "pending" | null
  invitationId: string | null
  minutesBefore: number | null
  customer: string | null
  customerEmail: string | null
  bookingTypeId: string | null
}

const str = (v: unknown): string | null => (typeof v === "string" && v ? v : null)

export const RSVP_LABEL: Record<RsvpResponse | "pending", string> = {
  accepted: "수락",
  tentative: "미정",
  declined: "거절",
  pending: "응답 전",
}

const RESPONSE_VERB: Record<string, string> = {
  accepted: "수락했습니다",
  declined: "거절했습니다",
  tentative: "미정으로 답했습니다",
}

function fmtValue(field: string, v: unknown): string {
  if (v === null || v === undefined || v === "") return "없음"
  if (field === "start_at" || field === "end_at") return typeof v === "string" ? whenText(v) : String(v)
  if (field === "all_day") return v ? "종일" : "시간 지정"
  if (field === "rrule") return "반복"
  return String(v)
}

/** payload.changes 를 전후 표 행으로. 시작과 끝은 "시간" 한 줄로 */
export function changeRows(payload: Record<string, unknown>): ChangeRow[] {
  const fields = Array.isArray(payload.fields) ? (payload.fields as string[]) : []
  const changes = (payload.changes ?? {}) as Record<string, { from?: unknown; to?: unknown }>
  const rows: ChangeRow[] = []
  let timeDone = false
  for (const f of fields) {
    if (f === "start_at" || f === "end_at") {
      if (timeDone) continue
      timeDone = true
      const oldStart = str(payload.old_start)
      const newStart = str(payload.new_start)
      if (oldStart && newStart) {
        rows.push({ label: "시간", from: whenText(oldStart), to: whenText(newStart) })
      } else {
        const c = changes.end_at ?? changes.start_at
        rows.push({ label: f === "end_at" ? "끝" : "시간", from: fmtValue(f, c?.from), to: fmtValue(f, c?.to) })
      }
      continue
    }
    if (f === "description") {
      rows.push({ label: FIELD_LABEL[f], from: "", to: "수정됨" })
      continue
    }
    const c = changes[f]
    rows.push({ label: FIELD_LABEL[f] ?? f, from: fmtValue(f, c?.from), to: fmtValue(f, c?.to) })
  }
  return rows
}

export function toView(n: NotificationItem): NotifView {
  const p = (n.payload ?? {}) as Record<string, unknown>
  const ev = n.event ?? null
  const bk = n.booking ?? null
  const isBooking = n.type.startsWith("booking")
  const title = (isBooking ? str(p.title) : (ev?.title ?? str(p.title))) ?? (isBooking ? "예약" : "일정")

  let start: string | null
  let end: string | null
  if (bk) {
    start = bk.slot_start_at
    end = bk.slot_end_at
  } else if (n.type === "event_reminder") {
    start = str(p.occurrence_start)
    end = null
  } else if (n.type === "event_cancelled" || n.type === "event_updated" || !ev) {
    // 취소, 변경 알림은 알림 시점의 값 (회차 취소면 그 회차)
    start = str(p.start_at) ?? ev?.start_at ?? null
    end = str(p.end_at) ?? ev?.end_at ?? null
  } else {
    start = ev.start_at
    end = ev.end_at
  }

  const oldStart =
    n.type === "booking_rescheduled" ? str(p.old_slot_start_at) : n.type === "event_updated" ? str(p.old_start) : null

  return {
    id: n.id,
    type: n.type,
    actorSub: n.actor_sub,
    actorName: n.actor_name,
    at: n.created_at,
    read: !!n.read_at,
    eventId: ev && !ev.deleted ? ev.id : null,
    title,
    start,
    end,
    allDay: ev?.all_day ?? !!p.all_day,
    location: ev?.location ?? str(p.location),
    calendarName: ev?.calendar_name ?? null,
    calendarColor: ev?.calendar_color ?? null,
    oldStart,
    changes: n.type === "event_updated" ? changeRows(p) : [],
    response: (str(p.response) as RsvpResponse | null) ?? null,
    myRsvp: n.type === "event_invited" ? (n.invitation?.response ?? null) : null,
    invitationId: n.type === "event_invited" ? (n.invitation?.id ?? str(p.invitation_id)) : null,
    minutesBefore: typeof p.minutes_before === "number" ? p.minutes_before : null,
    customer: bk?.customer_name ?? str(p.customer_name),
    customerEmail: bk?.customer_email ?? str(p.customer_email),
    bookingTypeId: bk?.booking_type_id ?? str(p.booking_type_id),
  }
}

function who(v: NotifView): string {
  if (v.actorName) return `${v.actorName}님이 `
  if (v.customer) return `${v.customer}님이 `
  if (v.type === "event_invitation_response") return "손님이 "
  return ""
}

/** 한 줄 문장. 일정 제목은 em 조각 */
export function notifSentence(v: NotifView): Part[] {
  const t = v.title
  const em: Part = { kind: "em", text: t }
  const w = who(v)
  switch (v.type) {
    case "event_invited":
      return [w, em, "에 초대했습니다"]
    case "event_updated":
      return [w, em, `${josaEul(t)} 바꿨습니다`]
    case "event_cancelled":
      return [w, em, `${josaEul(t)} 취소했습니다`]
    case "event_invitation_response":
      return [w, em, ` 초대를 ${RESPONSE_VERB[v.response ?? ""] ?? "응답했습니다"}`]
    case "event_reminder":
      return [em, ` 시작 ${v.minutesBefore ?? 0}분 전`]
    case "booking_received":
      return [w, em, `${josaEul(t)} 예약했습니다`]
    case "booking_rescheduled":
      return [w, em, " 예약 시간을 바꿨습니다"]
    case "booking_cancelled":
      return [w, em, " 예약을 취소했습니다"]
    default:
      return [em]
  }
}

/** 둘째 줄 */
export function notifDetail(v: NotifView): string {
  switch (v.type) {
    case "event_updated":
      return v.changes.map((c) => (c.to === "수정됨" ? `${c.label} 수정` : `${c.label} ${c.to}`)).join(", ")
    case "booking_rescheduled":
      return v.oldStart && v.start
        ? `${formatDay(v.oldStart)} ${formatTime(v.oldStart)} → ${formatDay(v.start)} ${formatTime(v.start)}`
        : rangeText(v.start, v.end)
    default:
      return [rangeText(v.start, v.end, v.allDay), v.location].filter(Boolean).join(", ")
  }
}

export const needsResponse = (v: NotifView) => v.type === "event_invited" && v.myRsvp === "pending" && !!v.eventId
export const isCancelled = (v: NotifView) => v.type === "event_cancelled" || v.type === "booking_cancelled"
export const isBookingType = (v: NotifView) => v.type.startsWith("booking")

/** 일정 열기 또는 예약 양식 주소 */
export function notifHref(v: NotifView): string {
  if (isBookingType(v)) return v.bookingTypeId ? `/booking-types/${v.bookingTypeId}` : "/booking-types"
  if (v.eventId) {
    // 일정 화면은 event, start, end 가 다 있을 때 그 날짜로 옮기고 상세 시트를 연다 (검색과 같은 주소 형식).
    if (v.start && v.end) {
      const p = new URLSearchParams({ event: v.eventId, start: v.start, end: v.end })
      return `/calendar?${p}`
    }
    return `/calendar?event=${v.eventId}`
  }
  return "/calendar"
}
