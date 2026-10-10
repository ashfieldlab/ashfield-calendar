/**
 * 활동 내역: audit 항목(action + entity_type + meta)을 화면의 동작 종류와 한 줄 문장으로.
 *
 * meta 키는 백엔드 write_audit 호출과 같다 (title, name, calendar_id, fields, changes,
 * old_start, new_start, invitee_name, guest_name, booking_type, slot_start_at 등).
 * 문장은 조각(Part) 배열로 돌려준다: 화면이 행위자, 대상, 강조를 각자 꾸민다.
 */

import type { ActivityItem } from "@/lib/types/activity"
import { formatDay, formatTime, parseYmd, whenText } from "./day-format"
import { josaEul, josaRo, josaRoTime } from "./josa"

export type ActKind =
  | "create"
  | "update"
  | "reschedule"
  | "delete"
  | "invite"
  | "uninvite"
  | "rsvp"
  | "skip"
  | "detach"
  | "cal_create"
  | "cal_subscribe"
  | "cal_update"
  | "cal_refresh"
  | "cal_delete"
  | "import"
  | "feed"
  | "booked"
  | "booking_reschedule"
  | "booking_cancel"
  | "bt_create"
  | "bt_update"
  | "bt_delete"
  | "link_rotate"
  | "caldav_create"
  | "caldav_revoke"

export type ActCategory = "event" | "people" | "booking" | "settings"

export const CATEGORIES: { key: ActCategory | "all"; label: string }[] = [
  { key: "all", label: "전체" },
  { key: "event", label: "일정" },
  { key: "people", label: "참석자" },
  { key: "booking", label: "예약" },
  { key: "settings", label: "캘린더 설정" },
]

export const KIND_CATEGORY: Record<ActKind, ActCategory> = {
  create: "event",
  update: "event",
  reschedule: "event",
  delete: "event",
  skip: "event",
  detach: "event",
  invite: "people",
  uninvite: "people",
  rsvp: "people",
  booked: "booking",
  booking_reschedule: "booking",
  booking_cancel: "booking",
  bt_create: "booking",
  bt_update: "booking",
  bt_delete: "booking",
  link_rotate: "booking",
  cal_create: "settings",
  cal_subscribe: "settings",
  cal_update: "settings",
  cal_refresh: "settings",
  cal_delete: "settings",
  import: "settings",
  feed: "settings",
  caldav_create: "settings",
  caldav_revoke: "settings",
}

const TIME_FIELDS = new Set(["start_at", "end_at", "all_day"])

const str = (v: unknown): string | null => (typeof v === "string" && v ? v : null)
const strList = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [])

/** 백엔드 action + entity_type + meta 를 화면의 동작 종류로 */
export function activityKind(it: Pick<ActivityItem, "action" | "entity_type" | "meta">): ActKind {
  const m = it.meta ?? {}
  switch (it.entity_type) {
    case "event": {
      if (it.action === "create") return "create"
      if (it.action === "delete") return "delete"
      if (it.action === "share") return "invite"
      if (it.action === "unshare") return "uninvite"
      if ("rsvp" in m) return "rsvp"
      if ("excluded_occurrence" in m) return "skip"
      if ("detached_occurrence" in m) return "detach"
      const fields = strList(m.fields)
      if ("old_start" in m && fields.every((f) => TIME_FIELDS.has(f))) return "reschedule"
      return "update"
    }
    case "calendar":
      if (it.action === "create") return m.source === "external_ics" ? "cal_subscribe" : "cal_create"
      if (it.action === "delete") return "cal_delete"
      if (it.action === "import_ics") return "import"
      if (it.action === "update") return m.refresh ? "cal_refresh" : "cal_update"
      return "feed"
    case "booking":
      if (it.action === "delete") return "booking_cancel"
      if (it.action === "update") return "booking_reschedule"
      return "booked"
    case "booking_type":
      if (it.action === "rotate_token") return "link_rotate"
      if (it.action === "create") return "bt_create"
      if (it.action === "delete") return "bt_delete"
      return "bt_update"
    default:
      return it.action === "caldav_token_revoke" ? "caldav_revoke" : "caldav_create"
  }
}

export const categoryOf = (it: Pick<ActivityItem, "action" | "entity_type" | "meta">) =>
  KIND_CATEGORY[activityKind(it)]

// ---------------------------------------------------------------------------
// 문장

export type Part = string | { kind: "actor" | "target" | "em"; text: string; color?: string | null }

export interface ActorInfo {
  name: string
  isMe: boolean
  kind: "member" | "guest" | "system"
}

export function actorOf(it: ActivityItem, meSub: string | null): ActorInfo {
  if (it.actor_sub) {
    return { name: it.actor_name || "알 수 없는 사용자", isMe: it.actor_sub === meSub, kind: "member" }
  }
  if (it.actor_type === "public") {
    const name = str(it.meta.guest_name) ?? str(it.meta.guest_email) ?? "손님"
    return { name, isMe: false, kind: "guest" }
  }
  return { name: "시스템", isMe: false, kind: "system" }
}

export interface TargetInfo {
  name: string
  /** 캘린더 색. 없으면 null */
  color: string | null
}

export function targetOf(it: ActivityItem, calendarColor: (id: string) => string | null = () => null): TargetInfo {
  const m = it.meta ?? {}
  switch (it.entity_type) {
    case "event": {
      const calId = str(m.calendar_id)
      return { name: str(m.title) ?? "일정", color: calId ? calendarColor(calId) : null }
    }
    case "calendar":
      return { name: str(m.name) ?? "캘린더", color: calendarColor(it.entity_id) }
    case "booking":
      return { name: str(m.booking_type) ?? "예약", color: null }
    case "booking_type":
      return { name: str(m.name) ?? str(m.title) ?? "예약 양식", color: null }
    default:
      return { name: str(m.name) ?? "앱 비밀번호", color: null }
  }
}

const RSVP_VERB: Record<string, string> = {
  accepted: "수락했습니다",
  declined: "거절했습니다",
  tentative: "미정으로 답했습니다",
}

export const FIELD_LABEL: Record<string, string> = {
  title: "제목",
  location: "장소",
  room_id: "회의실",
  description: "설명",
  rrule: "반복",
  all_day: "종일",
  start_at: "시간",
  end_at: "시간",
}

const dayOnly = (v: unknown) => {
  const s = String(v ?? "")
  // "2026-10-24" 또는 ISO datetime
  return s.length === 10 ? formatDay(parseYmd(s)) : formatDay(s)
}

function inviteeName(m: Record<string, unknown>): string {
  const email = str(m.invitee_email)
  const name = str(m.invitee_name)
  if (name && !email) return `${name}님`
  return email ?? (name ? `${name}님` : "참석자")
}

/** 바뀐 필드가 하나고 새 값이 글자면 { label, to } */
function singleChange(m: Record<string, unknown>): { label: string; to: string } | null {
  const fields = strList(m.fields)
  if (fields.length !== 1) return null
  const f = fields[0]
  if (!["title", "location", "room_id"].includes(f)) return null
  const changes = (m.changes ?? {}) as Record<string, { to?: unknown }>
  const to = str(changes[f]?.to)
  return to ? { label: FIELD_LABEL[f], to } : null
}

export interface SentenceOptions {
  meSub: string | null
  calendarColor?: (id: string) => string | null
}

/** "김하늘님이 주간 제품 회의의 장소를 대회의실로 바꿨습니다" */
export function activitySentence(it: ActivityItem, opts: SentenceOptions): Part[] {
  const m = it.meta ?? {}
  const a = actorOf(it, opts.meSub)
  const who: Part[] = a.isMe
    ? [{ kind: "actor", text: "내가" }, " "]
    : a.kind === "guest" && a.name.includes("@")
      ? [{ kind: "actor", text: a.name }, " 님이 "]
      : [{ kind: "actor", text: a.name }, "님이 "]
  const tg = targetOf(it, opts.calendarColor)
  const t: Part = { kind: "target", text: tg.name, color: tg.color }
  const n = tg.name
  const em = (text: string): Part => ({ kind: "em", text })

  switch (activityKind(it)) {
    case "create":
      return [...who, t, `${josaEul(n)} 만들었습니다`]
    case "update": {
      const one = singleChange(m)
      if (one) return [...who, t, `의 ${one.label}${josaEul(one.label)} `, em(one.to), `${josaRo(one.to)} 바꿨습니다`]
      return [...who, t, `${josaEul(n)} 수정했습니다`]
    }
    case "reschedule": {
      const to = str(m.new_start)
      return to
        ? [...who, t, `${josaEul(n)} `, em(whenText(to)), `${josaRoTime(formatTime(to))} 옮겼습니다`]
        : [...who, t, "의 시간을 바꿨습니다"]
    }
    case "delete":
      return [...who, t, `${josaEul(n)} 삭제했습니다`]
    case "skip":
      return [...who, "반복 일정 ", t, "에서 ", em(dayOnly(m.excluded_occurrence)), " 하루를 뺐습니다"]
    case "detach":
      return [...who, "반복 일정 ", t, "의 ", em(dayOnly(m.detached_occurrence)), " 일정만 따로 고쳤습니다"]
    case "invite": {
      const w = inviteeName(m)
      return [...who, t, "에 ", em(w), `${josaEul(w)} 초대했습니다`]
    }
    case "uninvite": {
      const w = inviteeName(m)
      return [...who, t, "에서 ", em(w), `${josaEul(w)} 뺐습니다`]
    }
    case "rsvp":
      return [...who, t, ` 초대를 ${RSVP_VERB[String(m.rsvp)] ?? "응답했습니다"}`]
    case "booked": {
      const slot = str(m.slot_start_at)
      return slot
        ? [...who, em(whenText(slot)), "에 ", t, `${josaEul(n)} 예약했습니다`]
        : [...who, t, `${josaEul(n)} 예약했습니다`]
    }
    case "booking_reschedule": {
      const to = str(m.new_start) ?? str(m.new_slot)
      const guest = str(m.guest_name)
      const head: Part[] = guest ? [...who, em(`${guest}님`), "의 ", t, " 예약을 "] : [...who, t, " 예약을 "]
      return to ? [...head, em(whenText(to)), `${josaRoTime(formatTime(to))} 옮겼습니다`] : [...head, "옮겼습니다"]
    }
    case "booking_cancel": {
      const slot = str(m.slot_start_at)
      return slot
        ? [...who, em(whenText(slot)), " ", t, " 예약을 취소했습니다"]
        : [...who, t, " 예약을 취소했습니다"]
    }
    case "bt_create":
      return [...who, "예약 양식 ", t, `${josaEul(n)} 만들었습니다`]
    case "bt_update":
      return [...who, "예약 양식 ", t, `${josaEul(n)} 수정했습니다`]
    case "bt_delete":
      return [...who, "예약 양식 ", t, `${josaEul(n)} 삭제했습니다`]
    case "link_rotate":
      return [...who, t, "의 예약 링크를 새로 만들었습니다"]
    case "cal_create":
      return [...who, "캘린더 ", t, `${josaEul(n)} 만들었습니다`]
    case "cal_subscribe":
      return [...who, t, `${josaEul(n)} 구독했습니다`]
    case "cal_update": {
      const oldName = str(m.old_name)
      if (oldName && oldName !== n && strList(m.fields).includes("name")) {
        return [...who, "캘린더 ", em(oldName), "의 이름을 ", t, `${josaRo(n)} 바꿨습니다`]
      }
      return [...who, "캘린더 ", t, `${josaEul(n)} 수정했습니다`]
    }
    case "cal_refresh":
      return [...who, t, `${josaEul(n)} 새로 고쳤습니다`]
    case "cal_delete":
      return [...who, "캘린더 ", t, `${josaEul(n)} 삭제했습니다`]
    case "import": {
      const file = str(m.filename)
      const cnt = typeof m.events === "number" ? `일정 ${m.events}개` : "일정"
      return file
        ? [...who, em(file), "에서 ", t, `${josaRo(n)} ${cnt}${josaEul(cnt)} 가져왔습니다`]
        : [...who, t, `${josaRo(n)} ${cnt}${josaEul(cnt)} 가져왔습니다`]
    }
    case "feed": {
      const verb =
        it.action === "ics_subscription_enable"
          ? "켰습니다"
          : it.action === "ics_subscription_disable"
            ? "껐습니다"
            : "새로 만들었습니다"
      return [...who, t, `의 구독 주소를 ${verb}`]
    }
    case "caldav_create":
      return [...who, "앱 비밀번호 ", t, `${josaEul(n)} 만들었습니다`]
    case "caldav_revoke":
      return [...who, "앱 비밀번호 ", t, `${josaEul(n)} 폐기했습니다`]
  }
}

/** 조각을 이어 붙인 글자 (테스트, title 속성용) */
export const partsText = (parts: Part[]) => parts.map((p) => (typeof p === "string" ? p : p.text)).join("")

// ---------------------------------------------------------------------------
// 범위 필터

export type Scope = "all" | "me" | "others"
export const SCOPES: { key: Scope; label: string }[] = [
  { key: "all", label: "전체" },
  { key: "me", label: "내 활동" },
  { key: "others", label: "다른 사람" },
]

export function inScope(it: ActivityItem, scope: Scope, meSub: string | null): boolean {
  if (scope === "all") return true
  const mine = !!meSub && it.actor_sub === meSub
  return scope === "me" ? mine : !mine
}
