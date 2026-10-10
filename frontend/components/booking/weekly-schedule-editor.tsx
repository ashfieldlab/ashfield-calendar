"use client"

import { Plus, X } from "lucide-react"

import type { WeeklySchedule } from "@/lib/types/booking"

const DAYS: Array<{ key: keyof WeeklySchedule; label: string }> = [
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
 * 요일별 시간 블록 편집기.
 * 점심시간 끊김은 한 요일 안에 블록 2개로 표현 (예: 09:00-12:00 + 13:00-18:00).
 */
export function WeeklyScheduleEditor({ value, onChange }: Props) {
  function updateDay(day: keyof WeeklySchedule, blocks: [string, string][]) {
    const next = { ...value }
    if (blocks.length === 0) delete next[day]
    else next[day] = blocks
    onChange(next)
  }

  function addBlock(day: keyof WeeklySchedule) {
    const cur = value[day] ?? []
    updateDay(day, [...cur, ["09:00", "18:00"]])
  }

  function removeBlock(day: keyof WeeklySchedule, idx: number) {
    const cur = value[day] ?? []
    updateDay(
      day,
      cur.filter((_, i) => i !== idx),
    )
  }

  function setTime(
    day: keyof WeeklySchedule,
    idx: number,
    pos: 0 | 1,
    time: string,
  ) {
    const cur = value[day] ?? []
    const next: [string, string][] = cur.map(
      (b, i) =>
        (i === idx
          ? pos === 0
            ? [time, b[1]]
            : [b[0], time]
          : b) as [string, string],
    )
    updateDay(day, next)
  }

  return (
    <div className="space-y-2" data-testid="weekly-schedule-editor">
      {DAYS.map(({ key, label }) => {
        const blocks = value[key] ?? []
        const enabled = blocks.length > 0
        return (
          <div
            key={key}
            className="flex items-start gap-3 rounded border border-border px-3 py-2"
            data-testid={`weekly-day-${key}`}
          >
            <label className="flex w-12 shrink-0 items-center gap-1 pt-1 text-sm font-medium text-foreground/80">
              <input
                type="checkbox"
                checked={enabled}
                onChange={(e) =>
                  updateDay(key, e.target.checked ? [["09:00", "18:00"]] : [])
                }
                data-testid={`weekly-day-${key}-toggle`}
              />
              {label}
            </label>
            <div className="flex-1 space-y-1">
              {enabled ? (
                <>
                  {blocks.map((b, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-2 text-sm"
                      data-testid={`weekly-day-${key}-block-${i}`}
                    >
                      <input
                        type="time"
                        value={b[0]}
                        onChange={(e) => setTime(key, i, 0, e.target.value)}
                        data-testid={`weekly-day-${key}-block-${i}-start`}
                        className="rounded border border-input px-2 py-1"
                      />
                      <span>–</span>
                      <input
                        type="time"
                        value={b[1]}
                        onChange={(e) => setTime(key, i, 1, e.target.value)}
                        data-testid={`weekly-day-${key}-block-${i}-end`}
                        className="rounded border border-input px-2 py-1"
                      />
                      <button
                        onClick={() => removeBlock(key, i)}
                        title="블록 제거"
                        data-testid={`weekly-day-${key}-block-${i}-remove`}
                        className="rounded p-1 text-muted-foreground/70 hover:bg-rose-50 dark:hover:bg-rose-950/40 hover:text-rose-600 dark:hover:text-rose-400"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                  <button
                    onClick={() => addBlock(key)}
                    data-testid={`weekly-day-${key}-add`}
                    className="inline-flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    <Plus size={12} /> 시간대 추가
                  </button>
                </>
              ) : (
                <span className="text-xs text-muted-foreground/70">받지 않음</span>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
