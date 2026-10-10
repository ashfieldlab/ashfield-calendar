"use client"

import { Copy, Plus, X } from "lucide-react"

import { BookingSwitch } from "@/components/booking/booking-controls"
import { cn } from "@/lib/utils"
import type { WeeklySchedule } from "@/lib/types/booking"

type DayKey = keyof WeeklySchedule

const DAYS: Array<{ key: DayKey; label: string }> = [
  { key: "mon", label: "월" },
  { key: "tue", label: "화" },
  { key: "wed", label: "수" },
  { key: "thu", label: "목" },
  { key: "fri", label: "금" },
  { key: "sat", label: "토" },
  { key: "sun", label: "일" },
]

interface Props {
  value: WeeklySchedule
  onChange: (v: WeeklySchedule) => void
}

/**
 * 요일별 시간 블록 편집기: 요일 스위치 줄.
 * 점심시간 끊김은 한 요일 안에 블록 2개로 표현 (예: 09:00-12:00 + 13:00-18:00).
 */
export function WeeklyScheduleEditor({ value, onChange }: Props) {
  function setDay(day: DayKey, blocks: [string, string][]) {
    const next = { ...value }
    if (blocks.length === 0) delete next[day]
    else next[day] = blocks
    onChange(next)
  }

  /** 이 요일 시간을 켜진 다른 요일에 복사 */
  function copyToActive(day: DayKey) {
    const src = value[day] ?? []
    const next: WeeklySchedule = { ...value }
    for (const { key } of DAYS) {
      if (key !== day && (next[key]?.length ?? 0) > 0) next[key] = src.map((b) => [...b] as [string, string])
    }
    onChange(next)
  }

  return (
    <div className="divide-y divide-border rounded-lg border border-border bg-background" data-testid="weekly-schedule-editor">
      {DAYS.map(({ key, label }) => {
        const blocks = value[key] ?? []
        const on = blocks.length > 0
        return (
          <div key={key} className="group flex items-start gap-3 px-3 py-2.5" data-testid={`weekly-day-${key}`}>
            <div className="flex w-14 shrink-0 items-center gap-2 pt-1">
              <BookingSwitch
                on={on}
                onChange={() => setDay(key, on ? [] : [["09:00", "18:00"]])}
                label={label}
                testId={`weekly-day-${key}-toggle`}
              />
              <span className={cn("text-sm font-medium", !on && "text-muted-foreground")}>{label}</span>
            </div>
            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
              {on ? (
                <>
                  {blocks.map((b, i) => (
                    <span
                      key={i}
                      className="inline-flex items-center gap-1 rounded-md border border-border bg-muted/30 py-0.5 pr-0.5 pl-1 text-sm"
                      data-testid={`weekly-day-${key}-block-${i}`}
                    >
                      <input
                        type="time"
                        step={900}
                        value={b[0]}
                        onChange={(e) => setDay(key, blocks.map((x, j) => (j === i ? [e.target.value, x[1]] : x)))}
                        className="bg-transparent px-1 tabular-nums outline-none"
                        data-testid={`weekly-day-${key}-block-${i}-start`}
                      />
                      <span className="text-muted-foreground">~</span>
                      <input
                        type="time"
                        step={900}
                        value={b[1]}
                        onChange={(e) => setDay(key, blocks.map((x, j) => (j === i ? [x[0], e.target.value] : x)))}
                        className="bg-transparent px-1 tabular-nums outline-none"
                        data-testid={`weekly-day-${key}-block-${i}-end`}
                      />
                      <button
                        type="button"
                        onClick={() => setDay(key, blocks.filter((_, j) => j !== i))}
                        aria-label="시간대 삭제"
                        className="rounded p-0.5 text-muted-foreground hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/40 dark:hover:text-rose-400"
                        data-testid={`weekly-day-${key}-block-${i}-remove`}
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
                    data-testid={`weekly-day-${key}-add`}
                  >
                    <Plus className="size-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => copyToActive(key)}
                    title="켜진 요일에 복사"
                    className="ml-auto rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground sm:opacity-0 sm:group-hover:opacity-100 sm:focus:opacity-100"
                    data-testid={`weekly-day-${key}-copy`}
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
