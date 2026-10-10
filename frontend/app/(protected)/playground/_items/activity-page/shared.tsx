"use client"

// 플레이그라운드: 활동 내역 페이지 안 비교. 서버를 부르지 않는다.
//
// 항목 모양은 /api/v1/me/activity (backend/app/api/v1/activity.py) 응답을 따른다.
// meta 는 백엔드 write_audit 호출과 같은 키를 쓰되, 문장을 자연스럽게 만들려고 몇 가지를 더 넣었다
// (표시는 "+" 주석). 실제 반영 때 백엔드가 이 키를 채우거나 응답에 붙여 줘야 한다.

import type { ReactNode } from "react"
import {
  CalendarCheck,
  CalendarMinus,
  CalendarPlus,
  CalendarX2,
  Clock,
  Download,
  KeyRound,
  Link2,
  PencilLine,
  RefreshCw,
  Rss,
  Scissors,
  Ticket,
  UserCheck,
  UserMinus,
  UserPlus,
  type LucideIcon,
} from "lucide-react"

import { cn } from "@/lib/utils"

import { CALENDARS, EVENTS, ME, NOW, calendarOf, formatDay, formatTime, memberOf } from "../_mock"

export interface MockActivity {
  id: string
  /** 멤버 id. 공개 라우트(손님)와 시스템은 null */
  actor_sub: string | null
  actor_type?: "user" | "public" | "system"
  action: string
  entity_type: "event" | "calendar" | "booking" | "booking_type" | "caldav_token"
  entity_id: string
  meta: Record<string, unknown>
  created_at: string
}

const at = (month: number, day: number, h: number, m = 0) =>
  new Date(`2026-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}T${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00+09:00`).toISOString()

export const ACTIVITIES: MockActivity[] = [
  { id: "a1", actor_sub: "u2", action: "update", entity_type: "event", entity_id: "e1", created_at: at(10, 10, 10, 5),
    meta: { title: "주간 제품 회의", fields: ["회의실"], room: "대회의실" /* + fields, room */ } },
  { id: "a2", actor_sub: null, actor_type: "public", action: "create", entity_type: "booking", entity_id: "b1", created_at: at(10, 10, 9, 40),
    meta: { booking_type_id: "bt1", slot_start_at: EVENTS[5].start, booking_type: "30분 상담", guest_name: "윤가람" /* + booking_type, guest_name */ } },
  { id: "a3", actor_sub: "u1", action: "create", entity_type: "event", entity_id: "e3", created_at: at(10, 10, 9, 12),
    meta: { calendar_id: "c-me", title: "치과" } },
  { id: "a4", actor_sub: null, actor_type: "public", action: "update", entity_type: "event", entity_id: "e2", created_at: at(10, 10, 8, 30),
    meta: { rsvp: "accepted", guest_email: "dana@partner.example.com", title: "디자인 리뷰" /* + title */ } },
  { id: "a5", actor_sub: "u1", action: "share", entity_type: "event", entity_id: "e2", created_at: at(10, 9, 18, 5),
    meta: { invitee: "u4", title: "디자인 리뷰" /* + title */ } },
  { id: "a6", actor_sub: "u1", action: "share", entity_type: "event", entity_id: "e2", created_at: at(10, 9, 18, 4),
    meta: { invitee_email: "dana@partner.example.com", external: true, title: "디자인 리뷰" /* + title */ } },
  { id: "a7", actor_sub: "u3", action: "update", entity_type: "event", entity_id: "e5", created_at: at(10, 9, 15, 20),
    meta: { title: "서버 점검", old_start: at(10, 14, 2), new_start: EVENTS[4].start /* + old_start, new_start */ } },
  { id: "a8", actor_sub: "u1", action: "update", entity_type: "event", entity_id: "e8", created_at: at(10, 9, 11, 0),
    meta: { excluded_occurrence: "2026-10-24", title: "1:1 서준" } },
  { id: "a9", actor_sub: "u1", action: "update", entity_type: "event", entity_id: "e1", created_at: at(10, 8, 17, 30),
    meta: { detached_occurrence: "2026-10-19", new_event_id: "e1x", title: "주간 제품 회의" } },
  { id: "a10", actor_sub: "u1", action: "import_ics", entity_type: "calendar", entity_id: "c-me", created_at: at(10, 8, 16, 0),
    meta: { events: 42, filename: "old-calendar.ics", name: "내 일정" /* + name */ } },
  { id: "a11", actor_sub: "u2", action: "create", entity_type: "event", entity_id: "e7", created_at: at(10, 8, 10, 10),
    meta: { calendar_id: "c-team", title: "팀 워크숍" } },
  { id: "a12", actor_sub: null, actor_type: "public", action: "delete", entity_type: "booking", entity_id: "b0", created_at: at(10, 7, 14, 0),
    meta: { by: "customer", booking_type: "30분 상담", guest_name: "남궁민", slot_start_at: at(10, 13, 15) /* + booking_type, guest_name, slot_start_at */ } },
  { id: "a13", actor_sub: "u1", action: "rotate_token", entity_type: "booking_type", entity_id: "bt1", created_at: at(10, 7, 9, 0),
    meta: { name: "30분 상담" /* + name */ } },
  { id: "a14", actor_sub: "u1", action: "caldav_token_create", entity_type: "caldav_token", entity_id: "t1", created_at: at(10, 6, 13, 30),
    meta: { name: "맥북 캘린더 앱" } },
  { id: "a15", actor_sub: "u1", action: "ics_subscription_enable", entity_type: "calendar", entity_id: "c-me", created_at: at(10, 5, 20, 0),
    meta: { scope: "personal", name: "내 일정" /* + name */ } },
  { id: "a16", actor_sub: "u1", action: "create", entity_type: "calendar", entity_id: "c-holiday", created_at: at(10, 2, 11, 0),
    meta: { name: "대한민국 공휴일", source: "external_ics" } },
  { id: "a17", actor_sub: "u4", action: "delete", entity_type: "event", entity_id: "e-old", created_at: at(9, 30, 15, 0),
    meta: { calendar_id: "c-team", title: "분기 회고" } },
  { id: "a18", actor_sub: "u1", action: "unshare", entity_type: "event", entity_id: "e2", created_at: at(9, 29, 16, 40),
    meta: { invitee: "u5", title: "디자인 리뷰" /* + title */ } },
  { id: "a19", actor_sub: "u1", action: "create", entity_type: "booking_type", entity_id: "bt1", created_at: at(9, 29, 10, 0),
    meta: { name: "30분 상담" } },
  { id: "a20", actor_sub: "u1", action: "caldav_token_revoke", entity_type: "caldav_token", entity_id: "t0", created_at: at(9, 28, 9, 0),
    meta: { name: "예전 아이폰" /* + name */ } },
]

// ---------------------------------------------------------------------------
// 종류

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
  | "cal_delete"
  | "import"
  | "feed"
  | "booked"
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

const TONE = {
  green: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  blue: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  amber: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  rose: "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300",
  violet: "bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300",
  teal: "bg-teal-100 text-teal-700 dark:bg-teal-950 dark:text-teal-300",
  muted: "bg-muted text-muted-foreground",
}

export const KIND_META: Record<ActKind, { icon: LucideIcon; tone: string; category: ActCategory; label: string }> = {
  create: { icon: CalendarPlus, tone: TONE.green, category: "event", label: "새 일정" },
  update: { icon: PencilLine, tone: TONE.blue, category: "event", label: "수정" },
  reschedule: { icon: Clock, tone: TONE.amber, category: "event", label: "시간 변경" },
  delete: { icon: CalendarX2, tone: TONE.rose, category: "event", label: "삭제" },
  skip: { icon: CalendarMinus, tone: TONE.muted, category: "event", label: "반복 제외" },
  detach: { icon: Scissors, tone: TONE.blue, category: "event", label: "한 번만 수정" },
  invite: { icon: UserPlus, tone: TONE.violet, category: "people", label: "초대" },
  uninvite: { icon: UserMinus, tone: TONE.muted, category: "people", label: "초대 취소" },
  rsvp: { icon: UserCheck, tone: TONE.teal, category: "people", label: "응답" },
  booked: { icon: Ticket, tone: TONE.green, category: "booking", label: "새 예약" },
  booking_cancel: { icon: Ticket, tone: TONE.rose, category: "booking", label: "예약 취소" },
  bt_create: { icon: CalendarCheck, tone: TONE.green, category: "booking", label: "예약 양식" },
  bt_update: { icon: PencilLine, tone: TONE.blue, category: "booking", label: "예약 양식" },
  bt_delete: { icon: CalendarX2, tone: TONE.rose, category: "booking", label: "예약 양식" },
  link_rotate: { icon: Link2, tone: TONE.amber, category: "booking", label: "링크" },
  cal_create: { icon: CalendarPlus, tone: TONE.green, category: "settings", label: "캘린더" },
  cal_subscribe: { icon: Rss, tone: TONE.teal, category: "settings", label: "구독" },
  cal_delete: { icon: CalendarX2, tone: TONE.rose, category: "settings", label: "캘린더" },
  import: { icon: Download, tone: TONE.blue, category: "settings", label: "가져오기" },
  feed: { icon: RefreshCw, tone: TONE.amber, category: "settings", label: "구독 주소" },
  caldav_create: { icon: KeyRound, tone: TONE.violet, category: "settings", label: "앱 비밀번호" },
  caldav_revoke: { icon: KeyRound, tone: TONE.muted, category: "settings", label: "앱 비밀번호" },
}

/** 백엔드 action + entity_type + meta 를 화면의 동작 종류로 */
export function activityKind(it: MockActivity): ActKind {
  const m = it.meta
  switch (it.entity_type) {
    case "event":
      if (it.action === "create") return "create"
      if (it.action === "delete") return "delete"
      if (it.action === "share") return "invite"
      if (it.action === "unshare") return "uninvite"
      if ("rsvp" in m) return "rsvp"
      if ("excluded_occurrence" in m) return "skip"
      if ("detached_occurrence" in m) return "detach"
      if ("old_start" in m) return "reschedule"
      return "update"
    case "calendar":
      if (it.action === "create") return m.source === "external_ics" ? "cal_subscribe" : "cal_create"
      if (it.action === "delete") return "cal_delete"
      if (it.action === "import_ics") return "import"
      return "feed"
    case "booking":
      return it.action === "delete" ? "booking_cancel" : "booked"
    case "booking_type":
      if (it.action === "rotate_token") return "link_rotate"
      if (it.action === "create") return "bt_create"
      if (it.action === "delete") return "bt_delete"
      return "bt_update"
    case "caldav_token":
      return it.action === "caldav_token_revoke" ? "caldav_revoke" : "caldav_create"
  }
}

export const categoryOf = (it: MockActivity) => KIND_META[activityKind(it)].category

// ---------------------------------------------------------------------------
// 조사

function batchim(word: string): { yes: boolean; rieul: boolean } {
  const c = word.trim().slice(-1)
  if (!c) return { yes: false, rieul: false }
  const code = c.charCodeAt(0)
  if (code >= 0xac00 && code <= 0xd7a3) {
    const j = (code - 0xac00) % 28
    return { yes: j !== 0, rieul: j === 8 }
  }
  if (/[0-9]/.test(c)) return { yes: "013678".includes(c), rieul: "178".includes(c) }
  const l = c.toLowerCase()
  return { yes: "lmnr".includes(l), rieul: "lr".includes(l) }
}

export const josaEul = (w: string) => (batchim(w).yes ? "을" : "를")
export const josaRo = (w: string) => {
  const b = batchim(w)
  return b.yes && !b.rieul ? "으로" : "로"
}
export const josaI = (w: string) => (batchim(w).yes ? "이" : "가")
/** "오전 2:00" 은 "두 시"로 읽으니 로 */
export const josaRoTime = (w: string) => (w.endsWith(":00") ? "로" : josaRo(w))

// ---------------------------------------------------------------------------
// 대상, 행위자

const str = (v: unknown): string | null => (typeof v === "string" && v ? v : null)

export interface Target {
  name: string
  /** 캘린더 색. 없으면 종류 아이콘 */
  color: string | null
  typeLabel: string
  /** 아직 남아 있는 일정이면 id */
  eventId: string | null
}

export function targetOf(it: MockActivity): Target {
  const m = it.meta
  switch (it.entity_type) {
    case "event": {
      const ev = EVENTS.find((e) => e.id === it.entity_id)
      const calId = str(m.calendar_id) ?? ev?.calendarId ?? null
      return {
        name: str(m.title) ?? ev?.title ?? "일정",
        color: calId ? calendarOf(calId).color : null,
        typeLabel: "일정",
        eventId: it.action === "delete" ? null : (ev?.id ?? null),
      }
    }
    case "calendar": {
      const cal = CALENDARS.find((c) => c.id === it.entity_id)
      return { name: str(m.name) ?? cal?.name ?? "캘린더", color: cal?.color ?? null, typeLabel: "캘린더", eventId: null }
    }
    case "booking":
      return { name: str(m.booking_type) ?? "예약", color: null, typeLabel: "예약", eventId: it.action === "create" ? "e6" : null }
    case "booking_type":
      return { name: str(m.name) ?? "예약 양식", color: null, typeLabel: "예약 양식", eventId: null }
    case "caldav_token":
      return { name: str(m.name) ?? "앱 비밀번호", color: null, typeLabel: "앱 비밀번호", eventId: null }
  }
}

export interface Actor {
  name: string
  color: string
  isMe: boolean
  kind: "member" | "guest" | "system"
}

export function actorOf(it: MockActivity): Actor {
  if (it.actor_sub) {
    const m = memberOf(it.actor_sub)
    return { name: m.name, color: m.color, isMe: m.id === ME.id, kind: "member" }
  }
  if (it.actor_type === "public") {
    const name = str(it.meta.guest_name) ?? str(it.meta.guest_email) ?? "손님"
    return { name, color: "#64748b", isMe: false, kind: "guest" }
  }
  return { name: "시스템", color: "#64748b", isMe: false, kind: "system" }
}

const RSVP_VERB: Record<string, string> = {
  accepted: "수락했습니다",
  declined: "거절했습니다",
  tentative: "미정으로 답했습니다",
}

const dayOnly = (ymd: string) => formatDay(new Date(`${ymd}T09:00:00+09:00`).toISOString())
export const whenText = (iso: string) => `${formatDay(iso)} ${formatTime(iso)}`

export interface Renderers {
  actor: (a: Actor) => ReactNode
  target: (t: Target) => ReactNode
  em: (s: string) => ReactNode
}

/** "김하늘님이 주간 제품 회의의 회의실을 대회의실로 바꿨습니다" */
export function activitySentence(it: MockActivity, r: Renderers): ReactNode {
  const m = it.meta
  const a = actorOf(it)
  const who = a.isMe ? (
    <>{r.actor({ ...a, name: "내가" })} </>
  ) : a.kind === "guest" && a.name.includes("@") ? (
    <>{r.actor(a)} 님이 </>
  ) : (
    <>{r.actor(a)}님이 </>
  )
  const tg = targetOf(it)
  const t = r.target(tg)
  const n = tg.name

  switch (activityKind(it)) {
    case "create":
      return <>{who}{t}{josaEul(n)} 만들었습니다</>
    case "update": {
      const fields = Array.isArray(m.fields) ? (m.fields as string[]) : []
      const room = str(m.room)
      if (fields.length === 1 && room) return <>{who}{t}의 {fields[0]}{josaEul(fields[0])} {r.em(room)}{josaRo(room)} 바꿨습니다</>
      return <>{who}{t}{josaEul(n)} 수정했습니다</>
    }
    case "reschedule": {
      const to = str(m.new_start)
      return to ? <>{who}{t}{josaEul(n)} {r.em(whenText(to))}{josaRoTime(formatTime(to))} 옮겼습니다</> : <>{who}{t}의 시간을 바꿨습니다</>
    }
    case "delete":
      return <>{who}{t}{josaEul(n)} 삭제했습니다</>
    case "skip": {
      const d = dayOnly(String(m.excluded_occurrence))
      return <>{who}반복 일정 {t}에서 {r.em(d)} 하루를 뺐습니다</>
    }
    case "detach": {
      const d = dayOnly(String(m.detached_occurrence))
      return <>{who}반복 일정 {t}의 {r.em(d)} 일정만 따로 고쳤습니다</>
    }
    case "invite": {
      const who2 = str(m.invitee_email) ?? `${memberOf(String(m.invitee)).name}님`
      return <>{who}{t}에 {r.em(who2)}{josaEul(who2)} 초대했습니다</>
    }
    case "uninvite": {
      const who2 = `${memberOf(String(m.invitee)).name}님`
      return <>{who}{t}에서 {r.em(who2)}{josaEul(who2)} 뺐습니다</>
    }
    case "rsvp":
      return <>{who}{t} 초대를 {RSVP_VERB[String(m.rsvp)] ?? "응답했습니다"}</>
    case "booked": {
      const slot = str(m.slot_start_at)
      return slot ? <>{who}{r.em(whenText(slot))}에 {t}{josaEul(n)} 예약했습니다</> : <>{who}{t}{josaEul(n)} 예약했습니다</>
    }
    case "booking_cancel": {
      const slot = str(m.slot_start_at)
      return slot ? <>{who}{r.em(whenText(slot))} {t} 예약을 취소했습니다</> : <>{who}{t} 예약을 취소했습니다</>
    }
    case "bt_create":
      return <>{who}예약 양식 {t}{josaEul(n)} 만들었습니다</>
    case "bt_update":
      return <>{who}예약 양식 {t}{josaEul(n)} 수정했습니다</>
    case "bt_delete":
      return <>{who}예약 양식 {t}{josaEul(n)} 삭제했습니다</>
    case "link_rotate":
      return <>{who}{t}의 예약 링크를 새로 만들었습니다</>
    case "cal_create":
      return <>{who}캘린더 {t}{josaEul(n)} 만들었습니다</>
    case "cal_subscribe":
      return <>{who}{t}{josaEul(n)} 구독했습니다</>
    case "cal_delete":
      return <>{who}캘린더 {t}{josaEul(n)} 삭제했습니다</>
    case "import": {
      const file = str(m.filename)
      const cnt = typeof m.events === "number" ? `일정 ${m.events}개` : "일정"
      return file ? <>{who}{r.em(file)}에서 {t}{josaRo(n)} {cnt}{josaEul(cnt)} 가져왔습니다</> : <>{who}{t}{josaRo(n)} {cnt}{josaEul(cnt)} 가져왔습니다</>
    }
    case "feed": {
      const verb = it.action === "ics_subscription_enable" ? "켰습니다" : it.action === "ics_subscription_disable" ? "껐습니다" : "새로 만들었습니다"
      return <>{who}{t}의 구독 주소를 {verb}</>
    }
    case "caldav_create":
      return <>{who}앱 비밀번호 {t}{josaEul(n)} 만들었습니다</>
    case "caldav_revoke":
      return <>{who}앱 비밀번호 {t}{josaEul(n)} 폐기했습니다</>
  }
}

/** 대상 없이 "무엇을 했는지"만. 대상별로 묶어 보여 줄 때 */
export function actionPhrase(it: MockActivity): string {
  const m = it.meta
  switch (activityKind(it)) {
    case "create":
      return "만들었습니다"
    case "update": {
      const fields = Array.isArray(m.fields) ? (m.fields as string[]) : []
      const room = str(m.room)
      if (fields.length === 1 && room) return `${fields[0]}${josaEul(fields[0])} ${room}${josaRo(room)} 바꿨습니다`
      return "수정했습니다"
    }
    case "reschedule": {
      const to = str(m.new_start)
      return to ? `${whenText(to)}${josaRoTime(formatTime(to))} 옮겼습니다` : "시간을 바꿨습니다"
    }
    case "delete":
      return "삭제했습니다"
    case "skip":
      return `${dayOnly(String(m.excluded_occurrence))} 하루를 뺐습니다`
    case "detach":
      return `${dayOnly(String(m.detached_occurrence))} 일정만 따로 고쳤습니다`
    case "invite": {
      const w = str(m.invitee_email) ?? `${memberOf(String(m.invitee)).name}님`
      return `${w}${josaEul(w)} 초대했습니다`
    }
    case "uninvite": {
      const w = `${memberOf(String(m.invitee)).name}님`
      return `${w}${josaEul(w)} 뺐습니다`
    }
    case "rsvp":
      return `초대를 ${RSVP_VERB[String(m.rsvp)] ?? "응답했습니다"}`
    case "booked": {
      const slot = str(m.slot_start_at)
      return slot ? `${whenText(slot)}에 예약했습니다` : "예약했습니다"
    }
    case "booking_cancel":
      return "예약을 취소했습니다"
    case "bt_create":
    case "cal_create":
    case "caldav_create":
      return "만들었습니다"
    case "bt_update":
      return "수정했습니다"
    case "bt_delete":
    case "cal_delete":
      return "삭제했습니다"
    case "caldav_revoke":
      return "폐기했습니다"
    case "link_rotate":
      return "예약 링크를 새로 만들었습니다"
    case "cal_subscribe":
      return "구독했습니다"
    case "import":
      return `${str(m.filename) ?? "파일"}에서 일정 ${typeof m.events === "number" ? m.events : ""}개를 가져왔습니다`
    case "feed":
      return it.action === "ics_subscription_enable" ? "구독 주소를 켰습니다" : it.action === "ics_subscription_disable" ? "구독 주소를 껐습니다" : "구독 주소를 새로 만들었습니다"
  }
}

// ---------------------------------------------------------------------------
// 날짜

export type DayBucket = "오늘" | "어제" | "이번 주" | "이전"
export const DAY_BUCKETS: DayBucket[] = ["오늘", "어제", "이번 주", "이전"]

export function dayBucket(iso: string, now: Date = NOW): DayBucket {
  const start = new Date(now)
  start.setHours(0, 0, 0, 0)
  const t = new Date(iso).getTime()
  const day = 86_400_000
  if (t >= start.getTime()) return "오늘"
  if (t >= start.getTime() - day) return "어제"
  if (t >= start.getTime() - 6 * day) return "이번 주"
  return "이전"
}

/** 14:05 */
export const clock = (iso: string) =>
  new Date(iso).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", hour12: false })

export const ymdOf = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`

// ---------------------------------------------------------------------------
// 공통 조각

export type Scope = "all" | "me" | "others"
export const SCOPES: { key: Scope; label: string }[] = [
  { key: "all", label: "전체" },
  { key: "me", label: "내 활동" },
  { key: "others", label: "다른 사람" },
]

export function inScope(it: MockActivity, scope: Scope) {
  if (scope === "all") return true
  const mine = it.actor_sub === ME.id
  return scope === "me" ? mine : !mine
}

export function Avatar({ actor, size = 32, className }: { actor: Actor; size?: number; className?: string }) {
  return (
    <span
      className={cn("inline-flex shrink-0 items-center justify-center rounded-full font-medium text-white", className)}
      style={{ background: actor.color, width: size, height: size, fontSize: size * 0.4 }}
      title={actor.name}
    >
      {actor.kind === "guest" ? "@" : actor.name.slice(0, 1)}
    </span>
  )
}

export function KindBadge({ it, className }: { it: MockActivity; className?: string }) {
  const meta = KIND_META[activityKind(it)]
  const Icon = meta.icon
  return (
    <span className={cn("inline-flex size-7 shrink-0 items-center justify-center rounded-full", meta.tone, className)}>
      <Icon className="size-3.5" />
    </span>
  )
}

/** 문장 속 대상 칩 */
export function TargetChip({ t }: { t: Target }) {
  return (
    <span className="mx-0.5 inline-flex max-w-full translate-y-[2px] items-center gap-1.5 rounded-md border bg-card px-1.5 py-0.5 align-baseline text-[13px] leading-4 font-medium text-foreground">
      {t.color ? (
        <span className="size-2 shrink-0 rounded-full" style={{ background: t.color }} />
      ) : (
        <span className="size-2 shrink-0 rounded-full border border-muted-foreground/50" />
      )}
      <span className="truncate">{t.name}</span>
    </span>
  )
}

export function Segmented<K extends string>({
  value,
  options,
  onChange,
  testid,
}: {
  value: K
  options: { key: K; label: string }[]
  onChange: (k: K) => void
  testid: string
}) {
  return (
    <div className="inline-flex rounded-lg bg-muted p-0.5 text-sm">
      {options.map((o) => (
        <button
          key={o.key}
          type="button"
          onClick={() => onChange(o.key)}
          data-testid={`${testid}-${o.key}`}
          className={cn(
            "rounded-md px-3 py-1 transition-colors",
            value === o.key ? "bg-background font-medium text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}
