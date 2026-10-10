"use client"

// 주간 슬롯 격자: 공개 예약 페이지와 담당자 일정 변경 모달이 같이 쓴다.
// 열 = 요일(월~금, 주말 슬롯이 있으면 토, 일 추가), 행 = 슬롯 시작 시각(HH:MM, 로컬).

import type { ReactNode } from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"

import { cn } from "@/lib/utils"

export const WD = ["일", "월", "화", "수", "목", "금", "토"]

export function ymdLocal(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

export function hmLocal(d: Date): string {
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`
}

/** 그 날짜가 속한 주의 월요일 00:00 (로컬) */
export function mondayOf(d: Date): Date {
  const m = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  m.setDate(m.getDate() - ((m.getDay() + 6) % 7))
  return m
}

export function addDays(d: Date, n: number): Date {
  const x = new Date(d)
  x.setDate(x.getDate() + n)
  return x
}

/** 10월 12일 (월) */
export const dayLabel = (d: Date) => `${d.getMonth() + 1}월 ${d.getDate()}일 (${WD[d.getDay()]})`
/** 오전 10:00 */
export const timeLabel = (d: Date) => d.toLocaleTimeString("ko-KR", { hour: "numeric", minute: "2-digit" })
/** 10월 12일 (월) 오전 10:00 ~ 오전 10:30 */
export function slotLabel(startIso: string, endIso: string): string {
  const s = new Date(startIso)
  return `${dayLabel(s)} ${timeLabel(s)} ~ ${timeLabel(new Date(endIso))}`
}

export interface GridSlot {
  start_at: string
  end_at: string
}

/** 슬롯 묶음에서 격자 행(시각)과 주말 열 표시 여부 */
export function gridShape(slots: GridSlot[]): { rows: string[]; weekend: boolean } {
  const rows = new Set<string>()
  let weekend = false
  for (const s of slots) {
    const d = new Date(s.start_at)
    rows.add(hmLocal(d))
    if (d.getDay() === 0 || d.getDay() === 6) weekend = true
  }
  return { rows: [...rows].sort(), weekend }
}

/** 칸 조회용: "YYYY-MM-DD HH:MM" → slot */
export function indexSlots<T extends GridSlot>(slots: T[]): Map<string, T> {
  const m = new Map<string, T>()
  for (const s of slots) {
    const d = new Date(s.start_at)
    m.set(`${ymdLocal(d)} ${hmLocal(d)}`, s)
  }
  return m
}

export function weekDays(monday: Date, weekend: boolean): Date[] {
  return Array.from({ length: weekend ? 7 : 5 }, (_, i) => addDays(monday, i))
}

export function WeekNav({
  days,
  canPrev,
  canNext,
  onPrev,
  onNext,
  testid,
}: {
  days: Date[]
  canPrev: boolean
  canNext: boolean
  onPrev: () => void
  onNext: () => void
  testid: string
}) {
  const start = days[0]
  const end = days[days.length - 1]
  return (
    <div className="mb-3 flex items-center gap-2">
      <button
        type="button"
        onClick={onPrev}
        disabled={!canPrev}
        aria-label="이전 주"
        data-testid={`${testid}-week-prev`}
        className="grid size-8 place-items-center rounded-lg border border-border hover:bg-muted disabled:opacity-30"
      >
        <ChevronLeft className="size-4" />
      </button>
      <button
        type="button"
        onClick={onNext}
        disabled={!canNext}
        aria-label="다음 주"
        data-testid={`${testid}-week-next`}
        className="grid size-8 place-items-center rounded-lg border border-border hover:bg-muted disabled:opacity-30"
      >
        <ChevronRight className="size-4" />
      </button>
      <span className="ml-1 text-sm font-semibold">
        {start.getMonth() + 1}월 {start.getDate()}일 ~ {end.getMonth() + 1}월 {end.getDate()}일
      </span>
    </div>
  )
}

/** 머리(요일, 날짜) + 행렬 칸. 칸 내용은 호출 쪽이 그린다. */
export function WeekSlotGrid({
  days,
  rows,
  dimDay,
  renderCell,
  stickyHead = false,
  testid,
}: {
  days: Date[]
  rows: string[]
  dimDay: (d: Date) => boolean
  renderCell: (day: Date, ymd: string, row: string) => ReactNode
  stickyHead?: boolean
  testid: string
}) {
  return (
    <div
      className="grid gap-1 sm:gap-1.5"
      style={{ gridTemplateColumns: `repeat(${days.length}, minmax(2.75rem, 1fr))` }}
      data-testid={testid}
    >
      {days.map((d) => (
        <div key={ymdLocal(d)} className={cn("pb-1 text-center", stickyHead && "sticky top-0 z-[1] bg-card")}>
          <p className="text-[11px] text-muted-foreground">{WD[d.getDay()]}</p>
          <p className={cn("text-lg font-bold", dimDay(d) && "text-muted-foreground/50")}>{d.getDate()}</p>
        </div>
      ))}
      {rows.map((row) => days.map((d) => <div key={`${ymdLocal(d)}-${row}`}>{renderCell(d, ymdLocal(d), row)}</div>))}
    </div>
  )
}

export function EmptyCell() {
  return <span className="grid h-9 place-items-center text-xs text-muted-foreground/30">-</span>
}
