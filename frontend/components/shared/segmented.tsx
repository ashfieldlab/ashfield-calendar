"use client"

import { cn } from "@/lib/utils"

/** 알약 모양 탭 (필터 전환) */
export function Segmented<K extends string>({
  value,
  options,
  onChange,
  testid,
}: {
  value: K
  options: { key: K; label: string }[]
  onChange: (k: K) => void
  testid: string
}) {
  return (
    <div className="inline-flex rounded-lg bg-muted p-0.5 text-sm" role="tablist" data-testid={testid}>
      {options.map((o) => (
        <button
          key={o.key}
          type="button"
          role="tab"
          aria-selected={value === o.key}
          onClick={() => onChange(o.key)}
          data-testid={`${testid}-${o.key}`}
          className={cn(
            "rounded-md px-3 py-1 transition-colors",
            value === o.key ? "bg-background font-medium text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}
