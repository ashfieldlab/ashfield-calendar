"use client"

// 플레이그라운드: 캘린더 구독 주소와 캘린더별 설정 안 비교. 가짜 데이터, 저장하지 않는다.

import { useCallback, useEffect, useMemo, useRef, useState } from "react"

import { useToast } from "@/components/ui-custom/use-toast"
import { cn } from "@/lib/utils"

import { CALENDARS, NOW, type MockCalendar } from "../_mock"

export { CALENDAR_COLORS } from "@/components/calendar/create-calendar-dialog"

export interface Feed {
  enabled: boolean
  token: string
  /** 마지막으로 외부 앱이 받아 간 시각 */
  lastFetchAt: string | null
  fetchCount: number
}

export interface CalState extends MockCalendar {
  hidden: boolean
  managed?: boolean
  feed: Feed
}

const hoursAgo = (h: number) => new Date(NOW.getTime() - h * 3600000).toISOString()

const INITIAL: CalState[] = CALENDARS.map((c) => ({
  ...c,
  hidden: false,
  managed: c.id === "c-holiday",
  feed:
    c.id === "c-me"
      ? { enabled: true, token: "k7q2mx9wv4hr8tz3", lastFetchAt: hoursAgo(2), fetchCount: 318 }
      : { enabled: false, token: "", lastFetchAt: null, fetchCount: 0 },
}))

export const feedUrl = (token: string) => `https://calendar.ashfield.example/ics/${token}.ics`
export const webcalUrl = (token: string) => feedUrl(token).replace(/^https:/, "webcal:")
export const shortUrl = (url: string) => url.replace(/^https?:\/\//, "")

function newToken() {
  const abc = "abcdefghjkmnpqrstuvwxyz23456789"
  let s = ""
  for (let i = 0; i < 16; i++) s += abc[Math.floor(Math.random() * abc.length)]
  return s
}

export function fetchedLabel(iso: string | null) {
  if (!iso) return "아직 받아 간 앱 없음"
  const h = Math.round((NOW.getTime() - new Date(iso).getTime()) / 3600000)
  return h < 1 ? "방금 받아 감" : h < 24 ? `${h}시간 전 받아 감` : `${Math.floor(h / 24)}일 전 받아 감`
}

/** 캘린더 목록과 각 캘린더의 구독 주소 상태. 모든 동작은 로컬 state + toast. */
export function useCalendarsState() {
  const { toast } = useToast()
  const [cals, setCals] = useState<CalState[]>(INITIAL)

  const patch = useCallback(
    (id: string, p: Partial<CalState> | ((c: CalState) => Partial<CalState>)) =>
      setCals((list) => list.map((c) => (c.id === id ? { ...c, ...(typeof p === "function" ? p(c) : p) } : c))),
    [],
  )

  return useMemo(
    () => ({
      cals,
      get: (id: string) => cals.find((c) => c.id === id) ?? cals[0],
      enable(id: string) {
        patch(id, (c) => ({ feed: { ...c.feed, enabled: true, token: c.feed.token || newToken() } }))
        toast.success("구독 주소를 켰습니다")
      },
      disable(id: string) {
        patch(id, (c) => ({ feed: { ...c.feed, enabled: false } }))
        toast.success("구독 주소를 껐습니다")
      },
      rotate(id: string) {
        patch(id, (c) => ({ feed: { ...c.feed, token: newToken(), lastFetchAt: null, fetchCount: 0 } }))
        toast.success("새 주소로 바꿨습니다")
      },
      toggleHidden(id: string) {
        patch(id, (c) => ({ hidden: !c.hidden }))
      },
      setColor(id: string, color: string) {
        patch(id, { color })
      },
      rename(id: string, name: string) {
        patch(id, { name })
      },
      exportIcs(c: CalState) {
        toast.success(`${c.name}.ics 다운로드`)
      },
      refresh(c: CalState) {
        toast.success(`${c.name}: 동기화했습니다`)
      },
      remove(c: CalState) {
        setCals((list) => list.filter((x) => x.id !== c.id))
        toast.success(`'${c.name}' 캘린더를 삭제했습니다`)
      },
    }),
    [cals, patch, toast],
  )
}

export type CalendarsState = ReturnType<typeof useCalendarsState>

export function Switch({
  checked,
  onChange,
  disabled,
  testId,
  label,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  disabled?: boolean
  testId: string
  label?: string
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      data-testid={testId}
      className={cn(
        "relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/30 disabled:opacity-50",
        checked ? "bg-primary" : "bg-input dark:bg-input/80",
      )}
    >
      <span
        className={cn(
          "inline-block size-4 rounded-full bg-background shadow-sm transition-transform",
          checked ? "translate-x-[18px]" : "translate-x-0.5",
        )}
      />
    </button>
  )
}

export function useCopied(ms = 1600) {
  const [copied, setCopied] = useState<string | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current)
    },
    [],
  )
  const copy = useCallback(
    (text: string, key = text) => {
      void navigator.clipboard?.writeText(text).catch(() => {})
      setCopied(key)
      if (timer.current) clearTimeout(timer.current)
      timer.current = setTimeout(() => setCopied(null), ms)
    },
    [ms],
  )
  return { copied, copy }
}

/** QR 느낌의 장식 패턴: 토큰으로 결정 (스캔용 아님). Drive share-parts 와 같은 모양. */
export function QrPattern({ seed, size = 132 }: { seed: string; size?: number }) {
  const N = 21
  const cells = useMemo(() => {
    let h = 2166136261
    for (const ch of seed) h = Math.imul(h ^ ch.charCodeAt(0), 16777619)
    const out: boolean[] = []
    for (let i = 0; i < N * N; i++) {
      h ^= h << 13
      h ^= h >>> 17
      h ^= h << 5
      out.push((h >>> 0) % 100 < 46)
    }
    return out
  }, [seed])
  const finder = (x: number, y: number) => {
    for (const [fx, fy] of [
      [0, 0],
      [N - 7, 0],
      [0, N - 7],
    ]) {
      if (x >= fx && x < fx + 7 && y >= fy && y < fy + 7) {
        const dx = x - fx
        const dy = y - fy
        const ring = dx === 0 || dx === 6 || dy === 0 || dy === 6
        const core = dx >= 2 && dx <= 4 && dy >= 2 && dy <= 4
        return ring || core ? 1 : 0
      }
      if (x >= fx - 1 && x <= fx + 7 && y >= fy - 1 && y <= fy + 7) return 0
    }
    return -1
  }
  return (
    <svg viewBox={`0 0 ${N} ${N}`} width={size} height={size} className="text-foreground" shapeRendering="crispEdges" aria-hidden>
      {cells.map((on, i) => {
        const x = i % N
        const y = Math.floor(i / N)
        const f = finder(x, y)
        const fill = f === -1 ? on : f === 1
        return fill ? <rect key={i} x={x} y={y} width={1} height={1} fill="currentColor" /> : null
      })}
    </svg>
  )
}
