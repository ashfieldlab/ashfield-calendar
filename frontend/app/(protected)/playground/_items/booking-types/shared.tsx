"use client"

// 플레이그라운드: 예약 양식 목록 시안 공통. 가짜 데이터와 작은 부품만 둔다.

import { useEffect, useRef, useState } from "react"
import QRCode from "qrcode"

import { useToast } from "@/components/ui-custom/use-toast"
import { cn } from "@/lib/utils"

import { CALENDARS, NOW } from "../_mock"

export type Weekly = Partial<Record<DayKey, [string, string][]>>
export type DayKey = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun"

export interface MockBookingType {
  id: string
  title: string
  description: string
  duration: number
  capacity: number
  enabled: boolean
  ownerType: "user" | "workspace"
  publicKey: string
  targetCalendarId: string
  weekly: Weekly
  lookaheadDays: number
  /** 다가오는 예약 수 */
  upcoming: number
  /** 지난 30일 예약 수 */
  last30: number
  /** 다음 예약 시각 */
  nextAt?: string
}

const WORK: [string, string][] = [["09:00", "12:00"], ["13:00", "18:00"]]

export const BOOKING_TYPES: MockBookingType[] = [
  {
    id: "bt1",
    title: "30분 상담",
    description: "도입 문의, 견적 상담",
    duration: 30,
    capacity: 1,
    enabled: true,
    ownerType: "user",
    publicKey: "k7f2qa9x",
    targetCalendarId: "c-me",
    weekly: { mon: WORK, tue: WORK, wed: WORK, thu: WORK, fri: WORK },
    lookaheadDays: 30,
    upcoming: 6,
    last30: 14,
    nextAt: "2026-10-12T11:00:00+09:00",
  },
  {
    id: "bt2",
    title: "60분 제품 데모",
    description: "화면 공유로 기능 시연",
    duration: 60,
    capacity: 1,
    enabled: true,
    ownerType: "user",
    publicKey: "d3m0p81z",
    targetCalendarId: "c-me",
    weekly: { tue: [["14:00", "18:00"]], thu: [["14:00", "18:00"]] },
    lookaheadDays: 21,
    upcoming: 3,
    last30: 5,
    nextAt: "2026-10-13T15:00:00+09:00",
  },
  {
    id: "bt3",
    title: "팀 인터뷰",
    description: "채용 2차 인터뷰",
    duration: 45,
    capacity: 1,
    enabled: true,
    ownerType: "workspace",
    publicKey: "tm1nt7vw",
    targetCalendarId: "c-team",
    weekly: { mon: [["10:00", "17:00"]], wed: [["10:00", "17:00"]], fri: [["10:00", "12:00"]] },
    lookaheadDays: 14,
    upcoming: 2,
    last30: 9,
    nextAt: "2026-10-14T10:00:00+09:00",
  },
  {
    id: "bt4",
    title: "신규 고객 온보딩",
    description: "그룹 세션, 최대 6명",
    duration: 90,
    capacity: 6,
    enabled: false,
    ownerType: "workspace",
    publicKey: "onb6grp2",
    targetCalendarId: "c-ops",
    weekly: { wed: [["15:00", "16:30"]] },
    lookaheadDays: 60,
    upcoming: 0,
    last30: 4,
  },
  {
    id: "bt5",
    title: "15분 빠른 통화",
    description: "",
    duration: 15,
    capacity: 1,
    enabled: false,
    ownerType: "user",
    publicKey: "q15c4llr",
    targetCalendarId: "c-me",
    weekly: { mon: [["17:00", "18:00"]], tue: [["17:00", "18:00"]], wed: [["17:00", "18:00"]], thu: [["17:00", "18:00"]], fri: [["17:00", "18:00"]] },
    lookaheadDays: 7,
    upcoming: 0,
    last30: 0,
  },
]

export const PUBLIC_ORIGIN = "https://calendar.example.com"
export const publicUrl = (key: string) => `${PUBLIC_ORIGIN}/book/${key}`
export const shortUrl = (key: string) => `calendar.example.com/book/${key}`

export const colorOf = (bt: MockBookingType) =>
  CALENDARS.find((c) => c.id === bt.targetCalendarId)?.color ?? "#6b7280"
export const calendarName = (bt: MockBookingType) =>
  CALENDARS.find((c) => c.id === bt.targetCalendarId)?.name ?? ""

const DAY_ORDER: DayKey[] = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]
const DAY_LABEL: Record<DayKey, string> = { mon: "월", tue: "화", wed: "수", thu: "목", fri: "금", sat: "토", sun: "일" }

export function activeDays(w: Weekly): DayKey[] {
  return DAY_ORDER.filter((d) => (w[d]?.length ?? 0) > 0)
}
export const dayLabel = (d: DayKey) => DAY_LABEL[d]
export const ALL_DAYS = DAY_ORDER

/** "평일 09:00~18:00", "화, 목 14:00~18:00" */
export function weeklySummary(w: Weekly): string {
  const days = activeDays(w)
  if (days.length === 0) return "가능 시간 없음"
  const ranges = days.map((d) => {
    const b = w[d] ?? []
    return `${b[0][0]}~${b[b.length - 1][1]}`
  })
  const same = ranges.every((r) => r === ranges[0])
  const weekdays = ["mon", "tue", "wed", "thu", "fri"]
  const dayText =
    days.length === 5 && days.every((d) => weekdays.includes(d))
      ? "평일"
      : days.map(dayLabel).join(", ")
  return same ? `${dayText} ${ranges[0]}` : dayText
}

export function durationText(min: number) {
  if (min < 60) return `${min}분`
  const h = Math.floor(min / 60)
  const m = min % 60
  return m ? `${h}시간 ${m}분` : `${h}시간`
}

/** 10월 12일 (월) 오전 11:00 */
export function nextText(iso?: string) {
  if (!iso) return null
  const t = new Date(iso)
  const WD = ["일", "월", "화", "수", "목", "금", "토"]
  const days = Math.round((new Date(t.toDateString()).getTime() - new Date(NOW.toDateString()).getTime()) / 86400000)
  const time = t.toLocaleTimeString("ko-KR", { hour: "numeric", minute: "2-digit" })
  if (days === 0) return `오늘 ${time}`
  if (days === 1) return `내일 ${time}`
  return `${t.getMonth() + 1}/${t.getDate()} (${WD[t.getDay()]}) ${time}`
}

/** 목록 state: 켜기/끄기 */
export function useBookingTypes() {
  const { toast } = useToast()
  const [items, setItems] = useState(BOOKING_TYPES)
  const toggle = (id: string) =>
    setItems((xs) =>
      xs.map((x) => {
        if (x.id !== id) return x
        toast.success(x.enabled ? `${x.title}: 꺼짐` : `${x.title}: 켜짐`)
        return { ...x, enabled: !x.enabled }
      }),
    )
  const rotate = (id: string) =>
    setItems((xs) =>
      xs.map((x) => (x.id === id ? { ...x, publicKey: Math.random().toString(36).slice(2, 10) } : x)),
    )
  return { items, toggle, rotate }
}

/** 링크 복사 + 잠깐 "복사됨" 표시 */
export function useCopy() {
  const { toast } = useToast()
  const [copied, setCopied] = useState<string | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current)
  }, [])
  async function copy(id: string, text: string) {
    try {
      await navigator.clipboard.writeText(text)
    } catch {
      toast.error("복사 실패")
      return
    }
    setCopied(id)
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => setCopied(null), 1600)
  }
  return { copied, copy }
}

export function useQr(url: string | null) {
  const [state, setState] = useState<{ url: string; data: string } | null>(null)
  useEffect(() => {
    if (!url) return
    let aborted = false
    QRCode.toDataURL(url, { width: 512, margin: 1 })
      .then((d) => !aborted && setState({ url, data: d }))
      .catch(() => undefined)
    return () => {
      aborted = true
    }
  }, [url])
  return state && state.url === url ? state.data : null
}

export function downloadQr(dataUrl: string | null, title: string) {
  if (!dataUrl) return
  const a = document.createElement("a")
  a.href = dataUrl
  a.download = `${title.replace(/[^a-z0-9가-힣]+/gi, "_")}_qr.png`
  a.click()
}

export function QrImage({ url, className }: { url: string; className?: string }) {
  const data = useQr(url)
  return data ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={data} alt="QR" className={cn("rounded-md", className)} />
  ) : (
    <div className={cn("animate-pulse rounded-md bg-muted", className)} />
  )
}

export function Switch({
  on,
  onChange,
  testId,
  size = "md",
}: {
  on: boolean
  onChange: () => void
  testId: string
  size?: "sm" | "md"
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={(e) => {
        e.stopPropagation()
        onChange()
      }}
      data-testid={testId}
      className={cn(
        "relative inline-flex shrink-0 items-center rounded-full transition-colors",
        size === "md" ? "h-5 w-9" : "h-4 w-7",
        on ? "bg-emerald-500 dark:bg-emerald-600" : "bg-muted-foreground/30",
      )}
    >
      <span
        className={cn(
          "inline-block rounded-full bg-background shadow transition-transform",
          size === "md" ? "size-4" : "size-3",
          on ? (size === "md" ? "translate-x-[18px]" : "translate-x-[14px]") : "translate-x-0.5",
        )}
      />
    </button>
  )
}

export function StatusPill({ on }: { on: boolean }) {
  return on ? (
    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">
      <span className="size-1.5 rounded-full bg-emerald-500" />켜짐
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
      <span className="size-1.5 rounded-full bg-muted-foreground/50" />꺼짐
    </span>
  )
}

export function WorkspaceBadge() {
  return (
    <span className="rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-medium text-blue-800 dark:bg-blue-900/40 dark:text-blue-300">
      워크스페이스
    </span>
  )
}

export const iconBtn =
  "inline-flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
