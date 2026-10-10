"use client"

// 플레이그라운드: 예약 양식 만들기/편집 시안 공통. 초안 state, 작은 입력 부품, 주간 편집기 2종, 공개 페이지 미리보기.

import { useEffect, useMemo, useRef, useState } from "react"
import { ChevronLeft, ChevronRight, Clock, Copy, Globe, Plus, Users, X } from "lucide-react"

import { useToast } from "@/components/ui-custom/use-toast"
import { cn } from "@/lib/utils"

import { CALENDARS, EVENTS, ME, MEMBERS, NOW } from "../_mock"

export type DayKey = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun"
export type Weekly = Partial<Record<DayKey, [string, string][]>>

export const DAYS: { key: DayKey; label: string }[] = [
  { key: "mon", label: "월" },
  { key: "tue", label: "화" },
  { key: "wed", label: "수" },
  { key: "thu", label: "목" },
  { key: "fri", label: "금" },
  { key: "sat", label: "토" },
  { key: "sun", label: "일" },
]
/** Date.getDay() 순서 */
const JS_DAY: DayKey[] = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"]

export interface Draft {
  ownerType: "user" | "workspace"
  title: string
  description: string
  duration: number
  capacity: number
  weekly: Weekly
  availableFrom: string
  availableTo: string
  minimumNotice: number
  lookaheadDays: number
  targetCalendarId: string
  blockingCalendarIds: string[]
  notifyIds: string[]
  privacyUrl: string
  timezone: string
}

const WORK: [string, string][] = [["09:00", "12:00"], ["13:00", "18:00"]]

export const EMPTY_DRAFT: Draft = {
  ownerType: "user",
  title: "",
  description: "",
  duration: 30,
  capacity: 1,
  weekly: { mon: WORK, tue: WORK, wed: WORK, thu: WORK, fri: WORK },
  availableFrom: "",
  availableTo: "",
  minimumNotice: 1440,
  lookaheadDays: 30,
  targetCalendarId: "c-me",
  blockingCalendarIds: [],
  notifyIds: [],
  privacyUrl: "",
  timezone: "Asia/Seoul",
}

export const SAMPLE_DRAFT: Draft = {
  ...EMPTY_DRAFT,
  title: "30분 상담",
  description: "도입 문의와 견적 상담입니다. 화상 회의 링크는 예약 확정 메일로 보내 드립니다.",
  weekly: { mon: WORK, tue: WORK, wed: [["13:00", "18:00"]], thu: WORK, fri: [["09:00", "12:00"]] },
  minimumNotice: 240,
  lookaheadDays: 21,
  blockingCalendarIds: ["c-team"],
  privacyUrl: "https://example.com/privacy",
}

export const PUBLIC_URL = "calendar.example.com/book/k7f2qa9x"

export const DURATIONS = [15, 30, 45, 60, 90]
export const NOTICES: { v: number; label: string }[] = [
  { v: 0, label: "바로" },
  { v: 60, label: "1시간 전" },
  { v: 240, label: "4시간 전" },
  { v: 1440, label: "하루 전" },
  { v: 2880, label: "이틀 전" },
]
export const LOOKAHEADS = [7, 14, 30, 60, 90]

export const TARGET_CALS = (owner: Draft["ownerType"]) =>
  CALENDARS.filter((c) => c.source === "native" && (owner === "user" ? c.scope === "personal" : c.scope === "shared"))

export const WORKSPACE_ADMIN = true

export function durationText(min: number) {
  if (min < 60) return `${min}분`
  const h = Math.floor(min / 60)
  const m = min % 60
  return m ? `${h}시간 ${m}분` : `${h}시간`
}

export function noticeText(min: number) {
  const p = NOTICES.find((n) => n.v === min)
  if (p) return p.label
  if (min % 1440 === 0) return `${min / 1440}일 전`
  if (min % 60 === 0) return `${min / 60}시간 전`
  return `${min}분 전`
}

/** 문제 있는 필드 → 메시지 */
export function validate(d: Draft): Partial<Record<keyof Draft, string>> {
  const e: Partial<Record<keyof Draft, string>> = {}
  if (!d.title.trim()) e.title = "제목을 입력하세요"
  if (d.duration < 5 || d.duration > 1440) e.duration = "5분에서 1440분 사이"
  if (d.capacity < 1) e.capacity = "1명 이상"
  if (!Object.values(d.weekly).some((b) => b && b.length > 0)) e.weekly = "가능한 요일이 없습니다"
  if (d.availableFrom && d.availableTo && d.availableFrom > d.availableTo) e.availableTo = "시작 날짜보다 뒤여야 합니다"
  if (!d.targetCalendarId) e.targetCalendarId = "캘린더를 선택하세요"
  return e
}

export function useDraft(initial: Draft, isNew: boolean) {
  const { toast } = useToast()
  const [d, setD] = useState<Draft>(initial)
  const [saved, setSaved] = useState<Draft>(initial)
  const set = (p: Partial<Draft>) => setD((x) => ({ ...x, ...p }))
  const errors = validate(d)
  const dirty = JSON.stringify(d) !== JSON.stringify(saved)
  function save() {
    const first = Object.values(errors)[0]
    if (first) {
      toast.error(first)
      return false
    }
    setSaved(d)
    toast.success(isNew ? "예약 양식을 만들었습니다" : "저장했습니다")
    return true
  }
  const reset = () => setD(saved)
  return { d, set, errors, dirty, save, reset }
}

export type DraftApi = ReturnType<typeof useDraft>

export interface VariantProps {
  initial: Draft
  isNew: boolean
}

/* ---------- 작은 입력 부품 ---------- */

export const inputCls =
  "w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none transition-shadow focus:border-ring focus:ring-2 focus:ring-ring/30"

export function FieldLabel({ children, error }: { children: React.ReactNode; error?: string }) {
  return (
    <div className="mb-1.5 flex items-baseline justify-between gap-2">
      <span className="text-xs font-medium text-muted-foreground">{children}</span>
      {error && <span className="text-[11px] text-rose-600 dark:text-rose-400">{error}</span>}
    </div>
  )
}

/** 프리셋 칩 + 직접 입력 */
export function ChipPicker({
  value,
  options,
  onChange,
  testId,
  suffix,
  min,
  max,
}: {
  value: number
  options: { v: number; label: string }[]
  onChange: (v: number) => void
  testId: string
  suffix: string
  min?: number
  max?: number
}) {
  const isPreset = options.some((o) => o.v === value)
  const [custom, setCustom] = useState(!isPreset)
  const [opened, setOpened] = useState(false)
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {options.map((o) => (
        <button
          key={o.v}
          type="button"
          onClick={() => {
            setCustom(false)
            onChange(o.v)
          }}
          className={cn(
            "rounded-full border px-3 py-1 text-sm transition-colors",
            !custom && value === o.v
              ? "border-primary bg-primary text-primary-foreground"
              : "bg-background hover:bg-muted",
          )}
          data-testid={`${testId}-${o.v}`}
        >
          {o.label}
        </button>
      ))}
      {custom ? (
        <span className="inline-flex items-center gap-1 rounded-full border border-primary bg-background py-0.5 pl-3 pr-2 text-sm">
          <input
            type="number"
            autoFocus={opened}
            min={min}
            max={max}
            value={value}
            onChange={(e) => onChange(Number(e.target.value))}
            className="w-14 bg-transparent outline-none"
            data-testid={`${testId}-custom-input`}
          />
          <span className="text-muted-foreground">{suffix}</span>
        </span>
      ) : (
        <button
          type="button"
          onClick={() => {
            setCustom(true)
            setOpened(true)
          }}
          className="rounded-full border border-dashed px-3 py-1 text-sm text-muted-foreground hover:bg-muted"
          data-testid={`${testId}-custom`}
        >
          직접
        </button>
      )}
    </div>
  )
}

export function Stepper({
  value,
  onChange,
  min = 1,
  max = 99,
  testId,
  unit,
}: {
  value: number
  onChange: (v: number) => void
  min?: number
  max?: number
  testId: string
  unit: string
}) {
  return (
    <div className="inline-flex items-center rounded-md border bg-background">
      <button
        type="button"
        onClick={() => onChange(Math.max(min, value - 1))}
        disabled={value <= min}
        className="px-2.5 py-1.5 text-muted-foreground hover:text-foreground disabled:opacity-30"
        data-testid={`${testId}-dec`}
      >
        -
      </button>
      <span className="min-w-12 text-center text-sm tabular-nums">
        {value}
        {unit}
      </span>
      <button
        type="button"
        onClick={() => onChange(Math.min(max, value + 1))}
        disabled={value >= max}
        className="px-2.5 py-1.5 text-muted-foreground hover:text-foreground disabled:opacity-30"
        data-testid={`${testId}-inc`}
      >
        +
      </button>
    </div>
  )
}

export function Switch({ on, onChange, testId }: { on: boolean; onChange: () => void; testId: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={onChange}
      data-testid={testId}
      className={cn(
        "relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors",
        on ? "bg-primary" : "bg-muted-foreground/30",
      )}
    >
      <span className={cn("inline-block size-4 rounded-full bg-background shadow transition-transform", on ? "translate-x-[18px]" : "translate-x-0.5")} />
    </button>
  )
}

/* ---------- 소유, 캘린더, 알림 ---------- */

export function OwnerPicker({ api, testId }: { api: DraftApi; testId: string }) {
  const { d, set } = api
  return (
    <div className="grid grid-cols-2 gap-2">
      {(["user", "workspace"] as const).map((o) => (
        <button
          key={o}
          type="button"
          disabled={o === "workspace" && !WORKSPACE_ADMIN}
          onClick={() => set({ ownerType: o, targetCalendarId: TARGET_CALS(o)[0]?.id ?? "", notifyIds: [] })}
          className={cn(
            "flex items-center gap-2 rounded-lg border px-3 py-2.5 text-left text-sm transition-colors disabled:opacity-50",
            d.ownerType === o ? "border-primary bg-primary/5 ring-1 ring-primary" : "hover:bg-muted/50",
          )}
          data-testid={`${testId}-${o}`}
        >
          {o === "user" ? <span className="size-2 rounded-full" style={{ backgroundColor: ME.color }} /> : <Users className="size-4 text-muted-foreground" />}
          {o === "user" ? "개인" : "워크스페이스"}
        </button>
      ))}
    </div>
  )
}

export function TargetCalendarPicker({ api, testId }: { api: DraftApi; testId: string }) {
  const { d, set } = api
  return (
    <div className="flex flex-wrap gap-2">
      {TARGET_CALS(d.ownerType).map((c) => (
        <button
          key={c.id}
          type="button"
          onClick={() => set({ targetCalendarId: c.id, blockingCalendarIds: d.blockingCalendarIds.filter((x) => x !== c.id) })}
          className={cn(
            "inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors",
            d.targetCalendarId === c.id ? "border-primary bg-primary/5 ring-1 ring-primary" : "hover:bg-muted/50",
          )}
          data-testid={`${testId}-${c.id}`}
        >
          <span className="size-2.5 rounded-full" style={{ backgroundColor: c.color }} />
          {c.name}
        </button>
      ))}
    </div>
  )
}

export function BlockingPicker({ api, testId }: { api: DraftApi; testId: string }) {
  const { d, set } = api
  const list = CALENDARS.filter((c) => c.id !== d.targetCalendarId)
  const toggle = (id: string) =>
    set({ blockingCalendarIds: d.blockingCalendarIds.includes(id) ? d.blockingCalendarIds.filter((x) => x !== id) : [...d.blockingCalendarIds, id] })
  return (
    <div className="flex flex-wrap gap-1.5">
      {list.map((c) => {
        const on = d.blockingCalendarIds.includes(c.id)
        return (
          <button
            key={c.id}
            type="button"
            onClick={() => toggle(c.id)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-colors",
              on ? "border-foreground/30 bg-foreground/5 font-medium" : "text-muted-foreground hover:bg-muted",
            )}
            data-testid={`${testId}-${c.id}`}
          >
            <span className={cn("size-2 rounded-full", !on && "opacity-40")} style={{ backgroundColor: c.color }} />
            {c.name}
          </button>
        )
      })}
    </div>
  )
}

export function NotifyPicker({ api, testId }: { api: DraftApi; testId: string }) {
  const { d, set } = api
  if (d.ownerType === "user") {
    return (
      <div className="inline-flex items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2 text-sm">
        <span className="grid size-6 place-items-center rounded-full text-[11px] font-medium text-white" style={{ backgroundColor: ME.color }}>
          {ME.name[0]}
        </span>
        본인
      </div>
    )
  }
  const toggle = (id: string) =>
    set({ notifyIds: d.notifyIds.includes(id) ? d.notifyIds.filter((x) => x !== id) : [...d.notifyIds, id] })
  return (
    <div className="flex flex-wrap gap-1.5">
      {MEMBERS.map((m) => {
        const on = d.notifyIds.includes(m.id)
        return (
          <button
            key={m.id}
            type="button"
            onClick={() => toggle(m.id)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border py-0.5 pl-0.5 pr-2.5 text-xs transition-colors",
              on ? "border-primary bg-primary/5 font-medium" : "text-muted-foreground hover:bg-muted",
            )}
            data-testid={`${testId}-${m.id}`}
          >
            <span className={cn("grid size-5 place-items-center rounded-full text-[10px] font-medium text-white", !on && "opacity-50")} style={{ backgroundColor: m.color }}>
              {m.name[0]}
            </span>
            {m.name}
          </button>
        )
      })}
    </div>
  )
}

/* ---------- 주간 편집기 1: 요일 줄 ---------- */

export function WeeklyList({ value, onChange, testId }: { value: Weekly; onChange: (w: Weekly) => void; testId: string }) {
  function setDay(day: DayKey, blocks: [string, string][]) {
    const next = { ...value }
    if (blocks.length === 0) delete next[day]
    else next[day] = blocks
    onChange(next)
  }
  function copyToAll(day: DayKey) {
    const src = value[day] ?? []
    const next: Weekly = { ...value }
    for (const { key } of DAYS) if (key !== day && (next[key]?.length ?? 0) > 0) next[key] = src.map((b) => [...b] as [string, string])
    onChange(next)
  }
  return (
    <div className="divide-y rounded-lg border bg-background">
      {DAYS.map(({ key, label }) => {
        const blocks = value[key] ?? []
        const on = blocks.length > 0
        return (
          <div key={key} className="group flex items-start gap-3 px-3 py-2.5" data-testid={`${testId}-${key}`}>
            <div className="flex w-14 shrink-0 items-center gap-2 pt-1">
              <Switch on={on} onChange={() => setDay(key, on ? [] : [["09:00", "18:00"]])} testId={`${testId}-${key}-toggle`} />
              <span className={cn("text-sm font-medium", !on && "text-muted-foreground")}>{label}</span>
            </div>
            <div className="flex flex-1 flex-wrap items-center gap-1.5">
              {on ? (
                <>
                  {blocks.map((b, i) => (
                    <span key={i} className="inline-flex items-center gap-1 rounded-md border bg-muted/30 py-0.5 pl-1 pr-0.5 text-sm">
                      <input
                        type="time"
                        step={900}
                        value={b[0]}
                        onChange={(e) => setDay(key, blocks.map((x, j) => (j === i ? [e.target.value, x[1]] : x)))}
                        className="bg-transparent px-1 tabular-nums outline-none"
                        data-testid={`${testId}-${key}-${i}-start`}
                      />
                      <span className="text-muted-foreground">~</span>
                      <input
                        type="time"
                        step={900}
                        value={b[1]}
                        onChange={(e) => setDay(key, blocks.map((x, j) => (j === i ? [x[0], e.target.value] : x)))}
                        className="bg-transparent px-1 tabular-nums outline-none"
                        data-testid={`${testId}-${key}-${i}-end`}
                      />
                      <button
                        type="button"
                        onClick={() => setDay(key, blocks.filter((_, j) => j !== i))}
                        className="rounded p-0.5 text-muted-foreground hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/40 dark:hover:text-rose-400"
                        data-testid={`${testId}-${key}-${i}-remove`}
                      >
                        <X className="size-3.5" />
                      </button>
                    </span>
                  ))}
                  <button
                    type="button"
                    onClick={() => setDay(key, [...blocks, [blocks[blocks.length - 1]?.[1] ?? "09:00", "18:00"]])}
                    title="시간대 추가"
                    className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                    data-testid={`${testId}-${key}-add`}
                  >
                    <Plus className="size-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => copyToAll(key)}
                    title="켜진 요일에 복사"
                    className="ml-auto rounded-md p-1 text-muted-foreground opacity-0 hover:bg-muted hover:text-foreground group-hover:opacity-100"
                    data-testid={`${testId}-${key}-copy`}
                  >
                    <Copy className="size-3.5" />
                  </button>
                </>
              ) : (
                <span className="pt-1 text-sm text-muted-foreground/70">받지 않음</span>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

/* ---------- 주간 편집기 2: 칠하는 격자 ---------- */

const G_FROM = 7
const G_TO = 22
const ROWS = (G_TO - G_FROM) * 2
const rowOf = (t: string) => {
  const [h, m] = t.split(":").map(Number)
  return Math.round((h - G_FROM) * 2 + m / 30)
}
const timeOf = (r: number) => {
  const mins = G_FROM * 60 + r * 30
  return `${String(Math.floor(mins / 60)).padStart(2, "0")}:${String(mins % 60).padStart(2, "0")}`
}

function toCells(w: Weekly): Record<DayKey, boolean[]> {
  const out = {} as Record<DayKey, boolean[]>
  for (const { key } of DAYS) {
    const col = Array<boolean>(ROWS).fill(false)
    for (const [s, e] of w[key] ?? []) for (let r = Math.max(0, rowOf(s)); r < Math.min(ROWS, rowOf(e)); r++) col[r] = true
    out[key] = col
  }
  return out
}

function fromCells(cells: Record<DayKey, boolean[]>): Weekly {
  const w: Weekly = {}
  for (const { key } of DAYS) {
    const col = cells[key]
    const blocks: [string, string][] = []
    let start = -1
    for (let r = 0; r <= ROWS; r++) {
      if (r < ROWS && col[r]) {
        if (start < 0) start = r
      } else if (start >= 0) {
        blocks.push([timeOf(start), timeOf(r)])
        start = -1
      }
    }
    if (blocks.length) w[key] = blocks
  }
  return w
}

export function WeekPaint({ value, onChange, testId }: { value: Weekly; onChange: (w: Weekly) => void; testId: string }) {
  const cells = useMemo(() => toCells(value), [value])
  const paint = useRef<boolean | null>(null)

  useEffect(() => {
    const up = () => {
      paint.current = null
    }
    window.addEventListener("pointerup", up)
    return () => window.removeEventListener("pointerup", up)
  }, [])

  function apply(day: DayKey, r: number, mode: boolean) {
    if (cells[day][r] === mode) return
    const next = { ...cells, [day]: cells[day].map((v, i) => (i === r ? mode : v)) }
    onChange(fromCells(next))
  }

  function setColumn(day: DayKey) {
    const any = cells[day].some(Boolean)
    onChange({ ...value, [day]: any ? [] : [["09:00", "18:00"]] } as Weekly)
  }

  return (
    <div className="select-none rounded-lg border bg-background p-3" data-testid={testId}>
      <div className="grid grid-cols-[2.5rem_repeat(7,minmax(0,1fr))] gap-x-1">
        <div />
        {DAYS.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            onClick={() => setColumn(key)}
            className={cn(
              "mb-1.5 rounded-md py-1 text-xs font-medium hover:bg-muted",
              cells[key].some(Boolean) ? "text-foreground" : "text-muted-foreground/60",
            )}
            data-testid={`${testId}-${key}-head`}
          >
            {label}
          </button>
        ))}
        <div className="relative">
          {Array.from({ length: G_TO - G_FROM + 1 }, (_, i) => (
            <span
              key={i}
              className="absolute right-1.5 -translate-y-1/2 text-[10px] tabular-nums text-muted-foreground"
              style={{ top: `${(i / (G_TO - G_FROM)) * 100}%` }}
            >
              {i % 3 === 0 ? `${G_FROM + i}시` : ""}
            </span>
          ))}
        </div>
        {DAYS.map(({ key }) => (
          <div key={key} className="flex flex-col overflow-hidden rounded-md bg-muted/40">
            {cells[key].map((on, r) => (
              <div
                key={r}
                onPointerDown={(e) => {
                  e.preventDefault()
                  paint.current = !on
                  apply(key, r, !on)
                }}
                onPointerEnter={() => paint.current !== null && apply(key, r, paint.current)}
                className={cn(
                  "h-3 cursor-pointer transition-colors",
                  r % 2 === 1 && "border-b border-background/60",
                  on ? "bg-primary/80 hover:bg-primary" : "hover:bg-muted",
                )}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

/* ---------- 공개 예약 페이지 미리보기 ---------- */

const minsOf = (t: string) => {
  const [h, m] = t.split(":").map(Number)
  return h * 60 + m
}
const ymd = (t: Date) => `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`

/** 그날 열리는 슬롯 시작 시각들 ("09:00") */
export function slotsOn(d: Draft, day: Date): string[] {
  const earliest = NOW.getTime() + d.minimumNotice * 60000
  const lastDay = new Date(NOW)
  lastDay.setDate(lastDay.getDate() + d.lookaheadDays)
  const key = ymd(day)
  if (key > ymd(lastDay)) return []
  if (d.availableFrom && key < d.availableFrom) return []
  if (d.availableTo && key > d.availableTo) return []
  const busy = EVENTS.filter((e) => !e.allDay && (e.calendarId === d.targetCalendarId || d.blockingCalendarIds.includes(e.calendarId)))
  const out: string[] = []
  const step = Math.max(5, d.duration)
  for (const [s, e] of d.weekly[JS_DAY[day.getDay()]] ?? []) {
    for (let m = minsOf(s); m + d.duration <= minsOf(e); m += step) {
      const st = new Date(day)
      st.setHours(0, m, 0, 0)
      const en = new Date(st.getTime() + d.duration * 60000)
      if (st.getTime() < earliest) continue
      if (busy.some((b) => new Date(b.start) < en && new Date(b.end) > st)) continue
      out.push(`${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`)
    }
  }
  return out
}

export function BookingPreview({ d, compact = false }: { d: Draft; compact?: boolean }) {
  const [month, setMonth] = useState(() => new Date(NOW.getFullYear(), NOW.getMonth(), 1))
  const [picked, setPicked] = useState<string | null>(null)

  const days = useMemo(() => {
    const first = new Date(month)
    const lead = (first.getDay() + 6) % 7
    const n = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate()
    const list: ({ date: Date; slots: number } | null)[] = Array(lead).fill(null)
    for (let i = 1; i <= n; i++) {
      const date = new Date(month.getFullYear(), month.getMonth(), i)
      list.push({ date, slots: slotsOn(d, date).length })
    }
    return list
  }, [d, month])

  const firstOpen = days.find((x) => x && x.slots > 0)?.date
  const sel = (picked && days.find((x) => x && ymd(x.date) === picked)?.date) || firstOpen
  const slots = sel ? slotsOn(d, sel) : []
  const WD = ["일", "월", "화", "수", "목", "금", "토"]

  return (
    <div className="overflow-hidden rounded-2xl border bg-card shadow-sm" data-testid="pg-booking-type-form-preview">
      <div className="flex items-center gap-1.5 border-b bg-muted/40 px-3 py-1.5">
        <Globe className="size-3 text-muted-foreground" />
        <span className="truncate font-mono text-[10px] text-muted-foreground">{PUBLIC_URL}</span>
      </div>
      <div className="space-y-3 p-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="grid size-5 place-items-center rounded-full text-[10px] font-medium text-white" style={{ backgroundColor: ME.color }}>
              {ME.name[0]}
            </span>
            {d.ownerType === "user" ? ME.name : "제품팀"}
          </div>
          <h3 className={cn("mt-1.5 font-semibold", !d.title && "text-muted-foreground/60")}>{d.title || "제목"}</h3>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <Clock className="size-3" />
              {durationText(d.duration)}
            </span>
            {d.capacity > 1 && (
              <span className="inline-flex items-center gap-1">
                <Users className="size-3" />
                {d.capacity}명
              </span>
            )}
          </div>
          {d.description && !compact && <p className="mt-2 line-clamp-3 text-xs text-foreground/80">{d.description}</p>}
        </div>

        <div>
          <div className="mb-1 flex items-center justify-between">
            <span className="text-xs font-medium">
              {month.getFullYear()}년 {month.getMonth() + 1}월
            </span>
            <div className="flex">
              <button
                type="button"
                onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}
                disabled={month <= new Date(NOW.getFullYear(), NOW.getMonth(), 1)}
                className="rounded p-0.5 text-muted-foreground hover:bg-muted disabled:opacity-30"
                data-testid="pg-booking-type-form-preview-prev"
              >
                <ChevronLeft className="size-4" />
              </button>
              <button
                type="button"
                onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}
                className="rounded p-0.5 text-muted-foreground hover:bg-muted"
                data-testid="pg-booking-type-form-preview-next"
              >
                <ChevronRight className="size-4" />
              </button>
            </div>
          </div>
          <div className="grid grid-cols-7 gap-0.5 text-center text-[10px] text-muted-foreground">
            {["월", "화", "수", "목", "금", "토", "일"].map((w) => (
              <span key={w} className="py-0.5">
                {w}
              </span>
            ))}
            {days.map((x, i) =>
              x ? (
                <button
                  key={i}
                  type="button"
                  disabled={x.slots === 0}
                  onClick={() => setPicked(ymd(x.date))}
                  className={cn(
                    "aspect-square rounded-full text-[11px] tabular-nums transition-colors",
                    x.slots === 0
                      ? "text-muted-foreground/40"
                      : sel && ymd(sel) === ymd(x.date)
                        ? "bg-primary font-semibold text-primary-foreground"
                        : "bg-primary/10 font-medium text-foreground hover:bg-primary/20",
                  )}
                  data-testid={`pg-booking-type-form-preview-day-${ymd(x.date)}`}
                >
                  {x.date.getDate()}
                </button>
              ) : (
                <span key={i} />
              ),
            )}
          </div>
        </div>

        <div>
          {sel ? (
            <>
              <div className="mb-1.5 text-xs font-medium">
                {sel.getMonth() + 1}월 {sel.getDate()}일 ({WD[sel.getDay()]})
              </div>
              <div className={cn("grid gap-1", compact ? "grid-cols-3" : "grid-cols-3")}>
                {slots.slice(0, compact ? 6 : 12).map((s) => (
                  <span key={s} className="rounded-md border border-primary/30 py-1 text-center text-[11px] font-medium tabular-nums text-primary dark:text-foreground">
                    {s}
                  </span>
                ))}
                {slots.length > (compact ? 6 : 12) && (
                  <span className="py-1 text-center text-[11px] text-muted-foreground">+{slots.length - (compact ? 6 : 12)}</span>
                )}
              </div>
            </>
          ) : (
            <p className="py-3 text-center text-xs text-muted-foreground">열린 시간 없음</p>
          )}
        </div>
      </div>
    </div>
  )
}

/** 지금 설정으로 열리는 슬롯 수 (lookahead 안) */
export function openSlotCount(d: Draft) {
  let n = 0
  for (let i = 0; i <= d.lookaheadDays; i++) {
    const day = new Date(NOW.getFullYear(), NOW.getMonth(), NOW.getDate() + i)
    n += slotsOn(d, day).length
  }
  return n
}
