"use client"

// 예약 화면 공용 작은 입력 부품: 스위치, 프리셋 칩 + 직접 입력, +/- 스테퍼, 필드 라벨.

import { useState } from "react"

import { cn } from "@/lib/utils"

export const bookingInputCls =
  "w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none transition-shadow focus:border-ring focus:ring-2 focus:ring-ring/30"

export function BookingSwitch({
  on,
  onChange,
  testId,
  label,
  tone = "primary",
  size = "md",
  disabled,
}: {
  on: boolean
  onChange: (v: boolean) => void
  testId: string
  label?: string
  /** primary: 브랜드 색, success: 켜짐/꺼짐 상태 */
  tone?: "primary" | "success"
  size?: "sm" | "md"
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={disabled}
      onClick={(e) => {
        e.stopPropagation()
        onChange(!on)
      }}
      data-testid={testId}
      className={cn(
        "relative inline-flex shrink-0 items-center rounded-full transition-colors disabled:opacity-50",
        size === "md" ? "h-5 w-9" : "h-4 w-7",
        on
          ? tone === "success"
            ? "bg-emerald-500 dark:bg-emerald-600"
            : "bg-primary"
          : "bg-muted-foreground/30",
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
            "rounded-full border border-border px-3 py-1 text-sm transition-colors",
            !custom && value === o.v ? "border-primary bg-primary text-primary-foreground" : "bg-background hover:bg-muted",
          )}
          data-testid={`${testId}-${o.v}`}
        >
          {o.label}
        </button>
      ))}
      {custom || !isPreset ? (
        <span className="inline-flex items-center gap-1 rounded-full border border-primary bg-background py-0.5 pr-2 pl-3 text-sm">
          <input
            type="number"
            autoFocus={opened}
            min={min}
            max={max}
            value={Number.isFinite(value) ? value : ""}
            onChange={(e) => onChange(Number(e.target.value))}
            className="w-16 bg-transparent outline-none"
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
          className="rounded-full border border-dashed border-border px-3 py-1 text-sm text-muted-foreground hover:bg-muted"
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
  max = 1000,
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
    <div className="inline-flex items-center rounded-md border border-input bg-background">
      <button
        type="button"
        onClick={() => onChange(Math.max(min, value - 1))}
        disabled={value <= min}
        aria-label="줄이기"
        className="px-3 py-1.5 text-muted-foreground hover:text-foreground disabled:opacity-30"
        data-testid={`${testId}-dec`}
      >
        -
      </button>
      <span className="min-w-12 text-center text-sm tabular-nums" data-testid={`${testId}-value`}>
        {value}
        {unit}
      </span>
      <button
        type="button"
        onClick={() => onChange(Math.min(max, value + 1))}
        disabled={value >= max}
        aria-label="늘리기"
        className="px-3 py-1.5 text-muted-foreground hover:text-foreground disabled:opacity-30"
        data-testid={`${testId}-inc`}
      >
        +
      </button>
    </div>
  )
}

export function durationText(min: number): string {
  if (min < 60) return `${min}분`
  const h = Math.floor(min / 60)
  const m = min % 60
  return m ? `${h}시간 ${m}분` : `${h}시간`
}
