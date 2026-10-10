"use client"

// 플레이그라운드: 알림 페이지와 헤더 종 팝오버 안 비교. 서버를 부르지 않는다.
//
// 종류는 lib/utils/notification-format.ts 의 백엔드 type 을 따르되,
// event_updated, event_cancelled 는 아직 백엔드에 없는 새 종류다.
// 초대 바로 응답(myRsvp)도 알림 응답에는 없고 실제 반영 때 초대 응답 API 를 함께 불러야 한다.

import { useState, type ReactNode } from "react"
import {
  Bell,
  CalendarClock,
  CalendarPlus,
  CalendarX2,
  Clock,
  PencilLine,
  Ticket,
  UserCheck,
  type LucideIcon,
} from "lucide-react"

import { useToast } from "@/components/ui-custom/use-toast"
import { cn } from "@/lib/utils"

import { EVENTS, ME, calendarOf, formatDay, formatTime, memberOf, relativeTime, type MockRsvp } from "../_mock"
import { josaEul, josaRo } from "../activity-page/shared"

export { DAY_BUCKETS, dayBucket } from "../activity-page/shared"

export type NotifType =
  | "event_invited"
  | "event_updated"
  | "event_cancelled"
  | "event_invitation_response"
  | "event_reminder"
  | "booking_received"
  | "booking_rescheduled"
  | "booking_cancelled"

export interface MockNotification {
  id: string
  type: NotifType
  /** 멤버 id. 예약 손님, 리마인더는 null */
  actor: string | null
  at: string
  read: boolean
  eventId?: string
  title: string
  start?: string
  end?: string
  allDay?: boolean
  calendarId?: string
  oldStart?: string
  changes?: { label: string; from: string; to: string }[]
  response?: Exclude<MockRsvp, "pending">
  /** 초대 알림: 내 현재 응답 */
  myRsvp?: MockRsvp
  minutesBefore?: number
  location?: string
  customer?: string
  customerEmail?: string
}

const at = (month: number, day: number, h: number, m = 0) =>
  new Date(
    `2026-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}T${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00+09:00`,
  ).toISOString()

const ev = (id: string) => EVENTS.find((e) => e.id === id)!

export const NOTIFICATIONS: MockNotification[] = [
  { id: "n1", type: "event_reminder", actor: null, at: at(10, 10, 10, 15), read: false, title: "아침 스탠드업", start: at(10, 10, 10, 30), end: at(10, 10, 10, 45), calendarId: "c-team", minutesBefore: 15, location: "소회의실 A" },
  { id: "n2", type: "booking_received", actor: null, at: at(10, 10, 9, 40), read: false, eventId: "e6", title: "30분 상담", start: ev("e6").start, end: ev("e6").end, calendarId: "c-me", customer: "윤가람", customerEmail: "garam@hanbit.example.com" },
  { id: "n3", type: "event_invited", actor: "u3", at: at(10, 10, 9, 5), read: false, eventId: "e5", title: "서버 점검", start: ev("e5").start, end: ev("e5").end, calendarId: "c-ops", myRsvp: "pending" },
  { id: "n4", type: "event_updated", actor: "u2", at: at(10, 10, 8, 50), read: false, eventId: "e1", title: "주간 제품 회의", start: ev("e1").start, end: ev("e1").end, calendarId: "c-team", changes: [{ label: "회의실", from: "소회의실 A", to: "대회의실" }, { label: "시간", from: "오전 9:30", to: "오전 10:00" }] },
  { id: "n5", type: "event_invitation_response", actor: "u4", at: at(10, 9, 18, 30), read: false, eventId: "e2", title: "디자인 리뷰", start: ev("e2").start, end: ev("e2").end, calendarId: "c-team", response: "declined" },
  { id: "n6", type: "event_invitation_response", actor: "u2", at: at(10, 9, 17, 0), read: true, eventId: "e2", title: "디자인 리뷰", start: ev("e2").start, end: ev("e2").end, calendarId: "c-team", response: "accepted" },
  { id: "n7", type: "event_invited", actor: "u2", at: at(10, 9, 14, 0), read: true, eventId: "e7", title: "팀 워크숍", start: ev("e7").start, end: ev("e7").end, allDay: true, calendarId: "c-team", location: "가평 리조트", myRsvp: "accepted" },
  { id: "n8", type: "event_cancelled", actor: "u5", at: at(10, 9, 11, 0), read: true, title: "마케팅 싱크", start: at(10, 13, 15), end: at(10, 13, 16), calendarId: "c-team" },
  { id: "n9", type: "booking_rescheduled", actor: null, at: at(10, 8, 16, 20), read: true, title: "30분 상담", oldStart: at(10, 14, 10), start: at(10, 15, 14), end: at(10, 15, 14, 30), calendarId: "c-me", customer: "남궁민", customerEmail: "min@example.com" },
  { id: "n10", type: "booking_cancelled", actor: null, at: at(10, 7, 14, 0), read: true, title: "30분 상담", start: at(10, 13, 15), end: at(10, 13, 15, 30), calendarId: "c-me", customer: "한지우", customerEmail: "jiwoo@example.com" },
  { id: "n11", type: "event_invited", actor: "u6", at: at(10, 6, 10, 30), read: true, title: "분기 계획 공유", start: at(10, 20, 14), end: at(10, 20, 15), calendarId: "c-team", location: "대회의실", myRsvp: "pending" },
  { id: "n12", type: "event_reminder", actor: null, at: at(10, 5, 9, 0), read: true, title: "치과 예약 전화", start: at(10, 5, 9, 30), end: at(10, 5, 9, 45), calendarId: "c-me", minutesBefore: 30 },
  { id: "n13", type: "event_invitation_response", actor: "u3", at: at(10, 2, 13, 0), read: true, eventId: "e1", title: "주간 제품 회의", start: ev("e1").start, end: ev("e1").end, calendarId: "c-team", response: "tentative" },
]

// ---------------------------------------------------------------------------
// 표시

export type NotifGroup = "invite" | "change" | "booking" | "reminder"

export const TYPE_META: Record<NotifType, { icon: LucideIcon; tone: string; group: NotifGroup; label: string }> = {
  event_invited: { icon: CalendarPlus, tone: "bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300", group: "invite", label: "초대" },
  event_updated: { icon: PencilLine, tone: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300", group: "change", label: "변경" },
  event_cancelled: { icon: CalendarX2, tone: "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300", group: "change", label: "취소" },
  event_invitation_response: { icon: UserCheck, tone: "bg-teal-100 text-teal-700 dark:bg-teal-950 dark:text-teal-300", group: "invite", label: "응답" },
  event_reminder: { icon: Clock, tone: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300", group: "reminder", label: "리마인더" },
  booking_received: { icon: Ticket, tone: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300", group: "booking", label: "새 예약" },
  booking_rescheduled: { icon: CalendarClock, tone: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300", group: "booking", label: "예약 변경" },
  booking_cancelled: { icon: Ticket, tone: "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300", group: "booking", label: "예약 취소" },
}

export const RSVP_LABEL: Record<MockRsvp, string> = {
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

const who = (n: MockNotification) => (n.actor ? `${memberOf(n.actor).name}님이` : n.customer ? `${n.customer}님이` : "")

export function whenOf(n: { start?: string; end?: string; allDay?: boolean }) {
  if (!n.start) return ""
  if (n.allDay) return `${formatDay(n.start)} 종일`
  return n.end ? `${formatDay(n.start)} ${formatTime(n.start)} ~ ${formatTime(n.end)}` : `${formatDay(n.start)} ${formatTime(n.start)}`
}

/** 한 줄 문장. em 은 강조할 이름(일정 제목 등)을 감싼다 */
export function notifSentence(n: MockNotification, em: (s: string) => ReactNode = (s) => s): ReactNode {
  const t = n.title
  switch (n.type) {
    case "event_invited":
      return <>{who(n)} {em(t)}에 초대했습니다</>
    case "event_updated":
      return <>{who(n)} {em(t)}{josaEul(t)} 바꿨습니다</>
    case "event_cancelled":
      return <>{who(n)} {em(t)}{josaEul(t)} 취소했습니다</>
    case "event_invitation_response":
      return <>{who(n)} {em(t)} 초대를 {RESPONSE_VERB[n.response ?? ""] ?? "응답했습니다"}</>
    case "event_reminder":
      return <>{em(t)} 시작 {n.minutesBefore}분 전</>
    case "booking_received":
      return <>{who(n)} {em(t)}{josaEul(t)} 예약했습니다</>
    case "booking_rescheduled":
      return <>{who(n)} {em(t)} 예약 시간을 바꿨습니다</>
    case "booking_cancelled":
      return <>{who(n)} {em(t)} 예약을 취소했습니다</>
  }
}

/** 둘째 줄 */
export function notifDetail(n: MockNotification): string {
  switch (n.type) {
    case "event_updated":
      return (n.changes ?? []).map((c) => `${c.label} ${c.to}`).join(", ")
    case "booking_rescheduled":
      return n.oldStart && n.start ? `${formatDay(n.oldStart)} ${formatTime(n.oldStart)} → ${formatDay(n.start)} ${formatTime(n.start)}` : ""
    default:
      return [whenOf(n), n.location].filter(Boolean).join(", ")
  }
}

export const needsResponse = (n: MockNotification) => n.type === "event_invited" && n.myRsvp === "pending"
export const isPast = (n: MockNotification) => n.type === "event_cancelled" || n.type === "booking_cancelled"

export const relTime = (iso: string) => relativeTime(iso)

export const calColor = (n: MockNotification) => (n.calendarId ? calendarOf(n.calendarId).color : "var(--muted-foreground)")
export const actorMember = (n: MockNotification) => (n.actor ? memberOf(n.actor) : null)
export { ME }

// ---------------------------------------------------------------------------
// 상태: 페이지와 종 팝오버가 같은 목록을 본다

export function useNotifs() {
  const { toast } = useToast()
  const [items, setItems] = useState<MockNotification[]>(NOTIFICATIONS)

  const patch = (id: string, p: Partial<MockNotification>) =>
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, ...p } : n)))

  return {
    items,
    unread: items.filter((n) => !n.read).length,
    pending: items.filter(needsResponse).length,
    markRead: (id: string) => patch(id, { read: true }),
    markUnread: (id: string) => patch(id, { read: false }),
    markAll: () => setItems((prev) => prev.map((n) => (n.read ? n : { ...n, read: true }))),
    respond: (id: string, r: Exclude<MockRsvp, "pending">) => {
      patch(id, { myRsvp: r, read: true })
      toast.success(`${RSVP_LABEL[r]}${josaRo(RSVP_LABEL[r])} 응답`)
    },
    open: (n: MockNotification) => {
      patch(n.id, { read: true })
      toast.info(n.type.startsWith("booking") ? "예약 양식으로 이동" : `${n.title} 열기`)
    },
  }
}

export type NotifState = ReturnType<typeof useNotifs>

// ---------------------------------------------------------------------------
// 공통 조각

export function TypeIcon({ n, className }: { n: MockNotification; className?: string }) {
  const m = TYPE_META[n.type]
  const Icon = m.icon
  return (
    <span className={cn("inline-flex size-8 shrink-0 items-center justify-center rounded-full", m.tone, className)}>
      <Icon className="size-4" />
    </span>
  )
}

/** 수락, 미정, 거절 */
export function RsvpButtons({
  n,
  onRespond,
  size = "md",
  testid,
}: {
  n: MockNotification
  onRespond: (r: Exclude<MockRsvp, "pending">) => void
  size?: "sm" | "md"
  testid: string
}) {
  const opts: Exclude<MockRsvp, "pending">[] = ["accepted", "tentative", "declined"]
  return (
    <div className={cn("inline-flex overflow-hidden rounded-lg border bg-background", size === "sm" ? "text-xs" : "text-sm")}>
      {opts.map((r, i) => {
        const on = n.myRsvp === r
        return (
          <button
            key={r}
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onRespond(r)
            }}
            data-testid={`${testid}-${r}`}
            className={cn(
              "transition-colors",
              size === "sm" ? "px-2.5 py-1" : "px-3.5 py-1.5",
              i > 0 && "border-l",
              on
                ? r === "accepted"
                  ? "bg-emerald-600 font-medium text-white dark:bg-emerald-500 dark:text-emerald-950"
                  : r === "declined"
                    ? "bg-rose-600 font-medium text-white dark:bg-rose-500 dark:text-rose-950"
                    : "bg-amber-500 font-medium text-white dark:bg-amber-400 dark:text-amber-950"
                : "text-foreground/80 hover:bg-muted",
            )}
          >
            {RSVP_LABEL[r]}
          </button>
        )
      })}
    </div>
  )
}

/** 앱 헤더 모형 + 종. 팝오버(children)는 실제처럼 종 아래 오른쪽에 페이지 위로 겹쳐 뜬다 */
export function BellStage({
  state,
  open,
  onToggle,
  children,
  slug,
}: {
  state: NotifState
  open: boolean
  onToggle: () => void
  children: ReactNode
  slug: string
}) {
  return (
    <div className="relative z-30">
      <div className="flex h-12 items-center justify-between rounded-xl border bg-card px-4">
        <span className="text-sm font-semibold">일정</span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onToggle}
            aria-label="알림"
            aria-expanded={open}
            data-testid={`pg-notifications-page-${slug}-bell`}
            className={cn(
              "relative rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground",
              open && "bg-muted text-foreground",
            )}
          >
            <Bell className="size-[18px]" />
            {state.unread > 0 && (
              <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-semibold text-white">
                {state.unread}
              </span>
            )}
          </button>
          <span className="inline-flex size-7 items-center justify-center rounded-full text-xs font-medium text-white" style={{ background: ME.color }}>
            {ME.name.slice(0, 1)}
          </span>
        </div>
      </div>
      {open && <div className="absolute top-full right-12 mt-2">{children}</div>}
    </div>
  )
}

/** 위: 헤더 모형(종), 아래: 전체 폭 페이지 */
export function WithBell({ page, bell }: { page: ReactNode; bell: ReactNode }) {
  return (
    <div className="space-y-6">
      {bell}
      <div className="min-w-0">{page}</div>
    </div>
  )
}
