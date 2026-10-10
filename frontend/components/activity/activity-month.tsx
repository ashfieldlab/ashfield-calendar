"use client"

import { ChevronLeft, ChevronRight } from "lucide-react"

import { cn } from "@/lib/utils"
import { ymdOf } from "@/lib/utils/day-format"

const WD = ["일", "월", "화", "수", "목", "금", "토"]

/** 작은 월 달력: 활동이 많은 날일수록 진하게. 날짜를 누르면 그날만 */
export function ActivityMonth({
  month,
  onMonth,
  perDay,
  day,
  onDay,
}: {
  month: Date
  onMonth: (m: Date) => void
  perDay: Map<string, number>
  day: string | null
  onDay: (d: string | null) => void
}) {
  const now = new Date()
  const todayKey = ymdOf(now)
  const startPad = month.getDay()
  const daysIn = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate()
  const cells: (Date | null)[] = [
    ...Array.from({ length: startPad }, () => null),
    ...Array.from({ length: daysIn }, (_, i) => new Date(month.getFullYear(), month.getMonth(), i + 1)),
  ]
  const isThisMonth = month.getFullYear() === now.getFullYear() && month.getMonth() === now.getMonth()

  return (
    <div className="rounded-xl border bg-card p-3" data-testid="activity-month">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm font-semibold" data-testid="activity-month-label">
          {month.getFullYear()}년 {month.getMonth() + 1}월
        </span>
        <div className="flex">
          <button
            type="button"
            onClick={() => onMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}
            className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="이전 달"
            data-testid="activity-prev-month"
          >
            <ChevronLeft className="size-4" />
          </button>
          <button
            type="button"
            onClick={() => onMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}
            disabled={isThisMonth}
            className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-30 disabled:hover:bg-transparent"
            aria-label="다음 달"
            data-testid="activity-next-month"
          >
            <ChevronRight className="size-4" />
          </button>
        </div>
      </div>
      <div className="grid grid-cols-7 gap-0.5 text-center text-[11px] text-muted-foreground">
        {WD.map((w) => (
          <span key={w} className="py-1">
            {w}
          </span>
        ))}
        {cells.map((d, i) => {
          if (!d) return <span key={`p${i}`} />
          const k = ymdOf(d)
          const n = perDay.get(k) ?? 0
          const future = d > now
          return (
            <button
              key={k}
              type="button"
              disabled={n === 0}
              onClick={() => onDay(day === k ? null : k)}
              data-testid={`activity-day-${k}`}
              aria-pressed={day === k}
              title={n ? `${n}건` : undefined}
              className={cn(
                "relative flex aspect-square items-center justify-center rounded-md text-xs tabular-nums transition-colors",
                n === 0 && (future ? "text-muted-foreground/40" : "text-muted-foreground"),
                n === 1 && "bg-primary/15 text-foreground hover:bg-primary/25",
                n === 2 && "bg-primary/30 text-foreground hover:bg-primary/40",
                n >= 3 && "bg-primary font-medium text-primary-foreground hover:bg-primary/85",
                day === k && "ring-2 ring-primary ring-offset-1 ring-offset-card",
                k === todayKey && "font-bold underline underline-offset-2",
              )}
            >
              {d.getDate()}
            </button>
          )
        })}
      </div>
    </div>
  )
}
