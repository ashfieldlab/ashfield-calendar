"use client"

// 플레이그라운드: 일정 상세 보기 안 비교. 가짜 일정만 쓰고 저장하지 않는다.

import { useState, type ComponentType } from "react"
import { RotateCcw } from "lucide-react"

import { useToast } from "@/components/ui-custom/use-toast"
import { cn } from "@/lib/utils"

import {
  EVENTS,
  ME,
  calendarOf,
  formatDay,
  formatTime,
  memberOf,
  roomOf,
  type MockCalendar,
  type MockEvent,
  type MockMember,
  type MockRoom,
  type MockRsvp,
} from "../_mock"

export type Rsvp = MockRsvp
export type Kind = "organizer" | "invitee" | "readonly" | "booking"
export type Scope = "occurrence" | "series"

export const RSVP_LABEL: Record<Rsvp, string> = {
  accepted: "수락",
  tentative: "미정",
  declined: "거절",
  pending: "대기",
}

export const RSVP_ORDER: Rsvp[] = ["accepted", "tentative", "pending", "declined"]
export const RSVP_CHOICES: Rsvp[] = ["accepted", "tentative", "declined"]

export const RSVP_DOT: Record<Rsvp, string> = {
  accepted: "bg-emerald-500 dark:bg-emerald-400",
  tentative: "bg-amber-500 dark:bg-amber-400",
  declined: "bg-rose-500 dark:bg-rose-400",
  pending: "bg-muted-foreground/40",
}

export const RSVP_TEXT: Record<Rsvp, string> = {
  accepted: "text-emerald-700 dark:text-emerald-300",
  tentative: "text-amber-700 dark:text-amber-300",
  declined: "text-rose-700 dark:text-rose-300",
  pending: "text-muted-foreground",
}

/** 선택된 응답 버튼 색 */
export const RSVP_ACTIVE: Record<Rsvp, string> = {
  accepted: "border-emerald-600 bg-emerald-600 text-white dark:border-emerald-500 dark:bg-emerald-500 dark:text-emerald-950",
  tentative: "border-amber-500 bg-amber-500 text-white dark:border-amber-400 dark:bg-amber-400 dark:text-amber-950",
  declined: "border-rose-600 bg-rose-600 text-white dark:border-rose-500 dark:bg-rose-500 dark:text-rose-950",
  pending: "border-input bg-muted text-foreground",
}

export const SCOPE_LABEL: Record<Scope, string> = {
  occurrence: "이 일정만",
  series: "전체 반복 일정",
}

export const SCENARIOS: { key: string; label: string; eventId: string }[] = [
  { key: "organizer", label: "내가 주최", eventId: "e2" },
  { key: "organizer-repeat", label: "반복 주최", eventId: "e8" },
  { key: "invitee", label: "초대받음", eventId: "e1" },
  { key: "pending", label: "응답 전", eventId: "e5" },
  { key: "readonly", label: "공휴일", eventId: "e4" },
  { key: "booking", label: "예약", eventId: "e6" },
]

const REMINDER: Record<string, string> = {
  e1: "10분 전 알림",
  e2: "30분 전 알림",
  e5: "1시간 전 알림",
  e6: "1시간 전 알림",
  e8: "10분 전 알림",
}

/** 참석자 일정 겹침 (원본은 서버에 묻는다) */
const CONFLICTS: Record<string, string[]> = {
  e2: ["김하늘"],
}

export interface DetailAttendee {
  member: MockMember
  rsvp: Rsvp
  organizer: boolean
  me: boolean
}

export interface Detail {
  ev: MockEvent
  kind: Kind
  cal: MockCalendar
  room?: MockRoom
  organizer: MockMember
  dayText: string
  timeText: string
  whenText: string
  duration: string
  recurring: boolean
  reminder?: string
  conflicts: string[]
  attendees: DetailAttendee[]
  counts: Record<Rsvp, number>
  myRsvp: Rsvp | null
  canEdit: boolean
  canDelete: boolean
  setRsvp: (r: Rsvp) => void
  edit: (scope?: Scope) => void
  duplicate: () => void
  remove: (scope?: Scope) => void
  ics: () => void
  openBooking: () => void
  close: () => void
}

function durationText(start: Date, end: Date) {
  const min = Math.round((end.getTime() - start.getTime()) / 60000)
  const h = Math.floor(min / 60)
  const m = min % 60
  if (h && m) return `${h}시간 ${m}분`
  return h ? `${h}시간` : `${m}분`
}

function buildWhen(ev: MockEvent) {
  const s = new Date(ev.start)
  const e = new Date(ev.end)
  if (ev.allDay) {
    const last = new Date(e.getTime() - 86400000)
    const days = Math.max(1, Math.round((e.getTime() - s.getTime()) / 86400000))
    if (days <= 1) {
      const day = formatDay(ev.start)
      return { dayText: day, timeText: "종일", whenText: `${day}, 종일`, duration: "하루" }
    }
    const range = `${formatDay(ev.start)} ~ ${formatDay(last.toISOString())}`
    return { dayText: range, timeText: "종일", whenText: range, duration: `${days}일` }
  }
  const day = formatDay(ev.start)
  const time = `${formatTime(ev.start)} ~ ${formatTime(ev.end)}`
  return { dayText: day, timeText: time, whenText: `${day}, ${time}`, duration: durationText(s, e) }
}

function kindOf(ev: MockEvent, cal: MockCalendar): Kind {
  if (cal.source === "external_ics") return "readonly"
  if (ev.booking) return "booking"
  return ev.organizer === ME.id ? "organizer" : "invitee"
}

function useEventDetail(eventId: string, onDeleted: (label: string) => void): Detail {
  const { toast } = useToast()
  const ev = EVENTS.find((e) => e.id === eventId) ?? EVENTS[0]
  const cal = calendarOf(ev.calendarId)
  const kind = kindOf(ev, cal)
  const [myRsvp, setMyRsvp] = useState<Rsvp | null>(
    () => ev.attendees.find((a) => a.id === ME.id)?.rsvp ?? null,
  )

  const attendees: DetailAttendee[] = [
    { member: memberOf(ev.organizer), rsvp: "accepted" as Rsvp, organizer: true, me: ev.organizer === ME.id },
    ...ev.attendees.map((a) => ({
      member: memberOf(a.id),
      rsvp: a.id === ME.id && myRsvp ? myRsvp : a.rsvp,
      organizer: false,
      me: a.id === ME.id,
    })),
  ]
  const shown = ev.attendees.length > 0 ? attendees : []
  const counts = { accepted: 0, tentative: 0, declined: 0, pending: 0 } as Record<Rsvp, number>
  for (const a of shown) counts[a.rsvp] += 1

  const editable = kind === "organizer" || (kind === "invitee" && cal.scope === "shared")

  return {
    ev,
    kind,
    cal,
    room: roomOf(ev.roomId),
    organizer: memberOf(ev.organizer),
    ...buildWhen(ev),
    recurring: !!ev.repeat,
    reminder: REMINDER[ev.id],
    conflicts: CONFLICTS[ev.id] ?? [],
    attendees: shown,
    counts,
    myRsvp,
    canEdit: editable,
    canDelete: kind === "organizer",
    setRsvp: (r) => {
      setMyRsvp(r)
      toast.success(`응답: ${RSVP_LABEL[r]}`)
    },
    edit: (scope) => toast.info(scope ? `편집 열기: ${SCOPE_LABEL[scope]}` : "편집 열기"),
    duplicate: () => toast.info(`복제: ${ev.title} (사본)`),
    remove: (scope) => {
      const label = scope === "occurrence" ? "이 일정을 삭제했습니다" : scope === "series" ? "반복 일정을 삭제했습니다" : "일정을 삭제했습니다"
      toast.success(label)
      onDeleted(label)
    },
    ics: () => toast.success(`${ev.title}.ics 다운로드`),
    openBooking: () => toast.info("예약 관리로 이동"),
    close: () => toast("닫기"),
  }
}

/** 시나리오 전환기 + 삭제 후 되돌리기. 시안은 몸체만 그린다. */
export function ScenarioFrame({ View, prefix }: { View: ComponentType<{ d: Detail }>; prefix: string }) {
  const [scenario, setScenario] = useState(SCENARIOS[0].key)
  const sc = SCENARIOS.find((s) => s.key === scenario) ?? SCENARIOS[0]

  return (
    <div className="flex w-full flex-col items-center gap-5">
      <div
        className="inline-flex flex-wrap justify-center gap-0.5 rounded-full bg-background/90 p-1 text-xs shadow-lg ring-1 ring-foreground/10 backdrop-blur"
        data-testid={`pg-event-detail-${prefix}-scenarios`}
      >
        {SCENARIOS.map((s) => (
          <button
            key={s.key}
            type="button"
            onClick={() => setScenario(s.key)}
            className={cn(
              "rounded-full px-3 py-1 font-medium transition-colors",
              s.key === scenario ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground",
            )}
            data-testid={`pg-event-detail-${prefix}-scenario-${s.key}`}
          >
            {s.label}
          </button>
        ))}
      </div>
      <Inner key={sc.key} eventId={sc.eventId} View={View} prefix={prefix} />
    </div>
  )
}

function Inner({ eventId, View, prefix }: { eventId: string; View: ComponentType<{ d: Detail }>; prefix: string }) {
  const [deleted, setDeleted] = useState<string | null>(null)
  const d = useEventDetail(eventId, setDeleted)
  if (deleted) {
    return (
      <div className="flex items-center gap-4 rounded-xl border bg-card px-5 py-3.5 text-sm shadow-2xl">
        <span>{deleted}</span>
        <button
          type="button"
          onClick={() => setDeleted(null)}
          className="inline-flex items-center gap-1.5 font-medium text-primary hover:underline"
          data-testid={`pg-event-detail-${prefix}-undo-button`}
        >
          <RotateCcw className="size-3.5" />
          되돌리기
        </button>
      </div>
    )
  }
  return <View d={d} />
}

export function Avatar({ member, size = 28, className }: { member: MockMember; size?: number; className?: string }) {
  return (
    <span
      className={cn("inline-grid shrink-0 place-items-center rounded-full font-semibold text-white", className)}
      style={{ width: size, height: size, backgroundColor: member.color, fontSize: Math.round(size * 0.42) }}
      title={member.name}
    >
      {member.name.slice(0, 1)}
    </span>
  )
}

/** "수락 3, 미정 1, 대기 1" */
export function countsText(counts: Record<Rsvp, number>) {
  return RSVP_ORDER.filter((r) => counts[r] > 0)
    .map((r) => `${RSVP_LABEL[r]} ${counts[r]}`)
    .join(", ")
}

export function hostOf(url?: string) {
  if (!url) return ""
  try {
    return new URL(url).host
  } catch {
    return url
  }
}
