"use client"

// 플레이그라운드: 일정 메인 화면 안 비교. 실제 캘린더와 일정을 읽기만 한다.

import { useMemo, useState } from "react"
import type { EventInput } from "@fullcalendar/core"

import { useApiGet } from "@/lib/hooks/use-api"
import type { CalendarListResponse, CalendarResponse, EventOccurrence, OccurrenceListResponse } from "@/lib/types/api"
import { cn } from "@/lib/utils"

export function useCalendars() {
  const { data } = useApiGet<CalendarListResponse>("/api/v1/calendars")
  const calendars = useMemo(() => data?.calendars ?? [], [data])
  const [hidden, setHidden] = useState<Set<string>>(new Set())
  const toggle = (id: string) =>
    setHidden((s) => {
      const n = new Set(s)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })
  const colorOf = useMemo(() => {
    const m = new Map<string, string>()
    for (const c of calendars) m.set(c.id, c.color_override ?? c.color ?? "#6b7280")
    return m
  }, [calendars])
  return { calendars, hidden, toggle, colorOf }
}

export function useOccurrences(range: { from: string; to: string } | null) {
  const url = range
    ? `/api/v1/events?from=${encodeURIComponent(range.from)}&to=${encodeURIComponent(range.to)}`
    : null
  const { data } = useApiGet<OccurrenceListResponse>(url)
  return data?.occurrences ?? []
}

export function toEvents(
  occ: EventOccurrence[],
  colorOf: Map<string, string>,
  hidden: Set<string>,
): EventInput[] {
  return occ
    .filter((o) => !hidden.has(o.calendar_id))
    .map((o) => ({
      id: `${o.event_id}-${o.start_at}`,
      title: o.title,
      start: o.start_at,
      end: o.end_at,
      allDay: o.all_day,
      backgroundColor: colorOf.get(o.calendar_id) ?? "#6b7280",
      borderColor: colorOf.get(o.calendar_id) ?? "#6b7280",
    }))
}

export function CalendarToggleList({
  calendars,
  hidden,
  onToggle,
}: {
  calendars: CalendarResponse[]
  hidden: Set<string>
  onToggle: (id: string) => void
}) {
  const groups: [string, CalendarResponse[]][] = [
    ["내 캘린더", calendars.filter((c) => c.scope === "personal")],
    ["워크스페이스", calendars.filter((c) => c.scope === "shared")],
  ]
  return (
    <div className="space-y-4">
      {groups
        .filter(([, list]) => list.length > 0)
        .map(([label, list]) => (
          <div key={label} className="space-y-0.5">
            <p className="px-2 pb-1 text-[11px] font-semibold tracking-wide text-muted-foreground">{label}</p>
            {list.map((c) => {
              const on = !hidden.has(c.id)
              const color = c.color_override ?? c.color
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => onToggle(c.id)}
                  data-testid={`pg-cal-toggle-${c.id}`}
                  className="flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted"
                >
                  <span
                    className={cn("size-3.5 shrink-0 rounded-[4px] border-2 transition")}
                    style={{ borderColor: color, backgroundColor: on ? color : "transparent" }}
                  />
                  <span className={cn("truncate", !on && "text-muted-foreground")}>{c.name}</span>
                </button>
              )
            })}
          </div>
        ))}
    </div>
  )
}

export const VIEWS = [
  { value: "dayGridMonth", label: "월" },
  { value: "timeGridWeek", label: "주" },
  { value: "timeGridDay", label: "일" },
  { value: "listWeek", label: "목록" },
]

export function Segmented({
  value,
  onChange,
  options,
}: {
  value: string
  onChange: (v: string) => void
  options: { value: string; label: string }[]
}) {
  return (
    <div className="inline-flex rounded-lg bg-muted p-0.5 text-sm">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          data-testid={`pg-view-${o.value}`}
          className={cn(
            "rounded-md px-3 py-1 font-medium transition",
            value === o.value ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}
