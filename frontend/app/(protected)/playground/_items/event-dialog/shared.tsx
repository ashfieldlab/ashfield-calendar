"use client"

// 플레이그라운드: 새 일정 모달 안 비교. 저장하지 않는다.

import type { CalendarResponse, Room } from "@/lib/types/api"
import { cn } from "@/lib/utils"

export type Repeat = "none" | "daily" | "weekly" | "monthly" | "yearly"

export interface EventDraft {
  title: string
  calendarId: string
  date: string
  endDate: string
  startTime: string
  endTime: string
  allDay: boolean
  roomId: string
  location: string
  description: string
  repeat: Repeat
  reminder: string
}

export interface VariantProps {
  calendars: CalendarResponse[]
  rooms: Room[]
  onClose: () => void
  onSubmit: (d: EventDraft) => void
}

export const REPEAT_LABEL: Record<Repeat, string> = {
  none: "반복 안 함",
  daily: "매일",
  weekly: "매주",
  monthly: "매월",
  yearly: "매년",
}

export const REMINDER_LABEL: Record<string, string> = {
  "": "알림 없음",
  "5": "5분 전",
  "15": "15분 전",
  "30": "30분 전",
  "60": "1시간 전",
  "1440": "1일 전",
}

function ymd(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

export function initialDraft(calendars: CalendarResponse[]): EventDraft {
  const now = new Date()
  const start = new Date(now)
  start.setHours(now.getHours() + 1, 0, 0, 0)
  const end = new Date(start.getTime() + 60 * 60 * 1000)
  const hm = (d: Date) => `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`
  return {
    title: "",
    calendarId: writableCalendars(calendars)[0]?.id ?? "",
    date: ymd(start),
    endDate: ymd(end),
    startTime: hm(start),
    endTime: hm(end),
    allDay: false,
    roomId: "",
    location: "",
    description: "",
    repeat: "none",
    reminder: "",
  }
}

export function writableCalendars(calendars: CalendarResponse[]) {
  return calendars.filter((c) => !c.hidden && c.source === "native")
}

export function formatDateKo(ymdStr: string) {
  const d = new Date(`${ymdStr}T00:00:00`)
  return d.toLocaleDateString("ko-KR", { month: "long", day: "numeric", weekday: "short" })
}

export const field =
  "h-9 rounded-lg border border-input bg-background px-2.5 text-sm outline-none transition focus:border-ring focus:ring-3 focus:ring-ring/20"

export function Chip({
  active,
  children,
  onClick,
  testid,
}: {
  active?: boolean
  children: React.ReactNode
  onClick?: () => void
  testid: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-testid={testid}
      className={cn(
        "inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition",
        active ? "border-primary bg-primary/10 text-primary" : "border-input text-muted-foreground hover:bg-muted",
      )}
    >
      {children}
    </button>
  )
}
