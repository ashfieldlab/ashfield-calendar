"use client"

import { useEffect, useRef, useState } from "react"
import { Check, Copy } from "lucide-react"

import { cn } from "@/lib/utils"

/** 설정 오른쪽 칸: 가운데 정렬된 본문 */
export function SettingsSection({
  title,
  action,
  children,
  testid,
}: {
  title: string
  action?: React.ReactNode
  children: React.ReactNode
  testid: string
}) {
  return (
    <div className="h-full overflow-y-auto px-4 py-6 sm:px-10 sm:py-8" data-testid={testid}>
      <section className="mx-auto max-w-xl">
        <div className="flex items-center gap-3">
          <h2 className="flex-1 text-xl font-semibold">{title}</h2>
          {action}
        </div>
        {children}
      </section>
    </div>
  )
}

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
        "relative inline-flex h-5 w-9 shrink-0 items-center rounded-full outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/30 disabled:opacity-40",
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

/** 값 한 줄 + 복사 버튼. 복사하면 잠깐 체크 표시. */
export function CopyField({
  label,
  value,
  mono,
  testid,
}: {
  label: string
  value: string
  mono?: boolean
  testid: string
}) {
  const [copied, setCopied] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current)
    },
    [],
  )
  function copy() {
    void navigator.clipboard
      ?.writeText(value)
      .then(() => {
        setCopied(true)
        if (timer.current) clearTimeout(timer.current)
        timer.current = setTimeout(() => setCopied(false), 1600)
      })
      .catch(() => {})
  }
  return (
    <div className="flex items-center gap-3 px-3 py-2">
      <span className="w-16 shrink-0 text-xs text-muted-foreground">{label}</span>
      <input
        readOnly
        value={value}
        onFocus={(e) => e.target.select()}
        data-testid={testid}
        className={cn("min-w-0 flex-1 bg-transparent text-sm outline-none", mono && "font-mono text-[13px]")}
      />
      <button
        type="button"
        onClick={copy}
        data-testid={`${testid}-copy`}
        aria-label="복사"
        className={cn(
          "grid size-7 shrink-0 place-items-center rounded-md transition-colors",
          copied ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground hover:bg-muted hover:text-foreground",
        )}
      >
        {copied ? <Check size={14} /> : <Copy size={14} />}
      </button>
    </div>
  )
}
