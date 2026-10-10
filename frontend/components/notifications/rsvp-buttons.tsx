"use client"

import { cn } from "@/lib/utils"
import type { RsvpResponse } from "@/lib/types/notification"
import { RSVP_LABEL } from "@/lib/utils/notification-format"

const OPTS: RsvpResponse[] = ["accepted", "tentative", "declined"]

/** 수락, 미정, 거절 */
export function RsvpButtons({
  value,
  onRespond,
  disabled,
  testid,
}: {
  value: RsvpResponse | "pending" | null
  onRespond: (r: RsvpResponse) => void
  disabled?: boolean
  testid: string
}) {
  return (
    <div className="inline-flex overflow-hidden rounded-lg border bg-background text-sm" data-testid={testid}>
      {OPTS.map((r, i) => {
        const on = value === r
        return (
          <button
            key={r}
            type="button"
            disabled={disabled}
            aria-pressed={on}
            onClick={(e) => {
              e.stopPropagation()
              onRespond(r)
            }}
            data-testid={`${testid}-${r}`}
            className={cn(
              "px-3.5 py-1.5 transition-colors disabled:opacity-50",
              i > 0 && "border-l",
              on
                ? r === "accepted"
                  ? "bg-emerald-600 font-medium text-white dark:bg-emerald-500 dark:text-emerald-950"
                  : r === "declined"
                    ? "bg-rose-600 font-medium text-white dark:bg-rose-500 dark:text-rose-950"
                    : "bg-amber-500 font-medium text-white dark:bg-amber-400 dark:text-amber-950"
                : "text-foreground/80 hover:bg-muted",
            )}
          >
            {RSVP_LABEL[r]}
          </button>
        )
      })}
    </div>
  )
}
