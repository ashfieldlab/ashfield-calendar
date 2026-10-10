"use client"

// 안 B: 아젠다 우선. 왼쪽은 오늘부터 2주 일정 목록, 오른쪽은 점으로 표시하는 작은 월 달력.

import { useMemo, useState } from "react"
import FullCalendar from "@fullcalendar/react"
import dayGridPlugin from "@fullcalendar/daygrid"
import { Plus } from "lucide-react"

import { Button } from "@/components/ui/button"
import type { EventOccurrence } from "@/lib/types/api"

import { toEvents, useCalendars, useOccurrences } from "./shared"

function startOfDay(d: Date) {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

export function VariantB() {
  const { calendars, colorOf } = useCalendars()
  const agendaRange = useMemo(() => {
    const from = startOfDay(new Date())
    const to = new Date(from.getTime() + 14 * 86400000)
    return { from: from.toISOString(), to: to.toISOString() }
  }, [])
  const upcoming = useOccurrences(agendaRange)
  const [monthRange, setMonthRange] = useState<{ from: string; to: string } | null>(null)
  const monthOcc = useOccurrences(monthRange)
  const monthEvents = useMemo(() => toEvents(monthOcc, colorOf, new Set()), [monthOcc, colorOf])

  const byDay = useMemo(() => {
    const m = new Map<string, EventOccurrence[]>()
    for (const o of [...upcoming].sort((a, b) => a.start_at.localeCompare(b.start_at))) {
      const k = startOfDay(new Date(o.start_at)).toISOString()
      m.set(k, [...(m.get(k) ?? []), o])
    }
    return [...m.entries()]
  }, [upcoming])

  const today = new Date()
  const calName = (id: string) => calendars.find((c) => c.id === id)?.name ?? ""

  return (
    <div className="grid h-full min-h-[640px] grid-cols-1 gap-4 lg:grid-cols-[minmax(360px,1fr)_minmax(0,1.3fr)]">
      <section className="flex min-h-0 flex-col overflow-hidden rounded-xl border bg-background">
        <header className="flex items-end justify-between border-b px-6 py-5">
          <div>
            <p className="text-sm text-muted-foreground">
              {today.toLocaleDateString("ko-KR", { weekday: "long" })}
            </p>
            <h2 className="text-3xl font-bold tracking-tight">
              {today.toLocaleDateString("ko-KR", { month: "long", day: "numeric" })}
            </h2>
          </div>
          <Button size="sm" className="gap-1.5" data-testid="pg-b-new">
            <Plus className="size-4" /> 새 일정
          </Button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
          {byDay.length === 0 && <p className="py-10 text-center text-sm text-muted-foreground">2주 안에 일정이 없습니다.</p>}
          <ol className="space-y-6">
            {byDay.map(([day, list]) => {
              const d = new Date(day)
              const isToday = d.toDateString() === today.toDateString()
              return (
                <li key={day} className="grid grid-cols-[56px_1fr] gap-3">
                  <div className="pt-1 text-center">
                    <p className={isToday ? "text-xs font-semibold text-primary" : "text-xs text-muted-foreground"}>
                      {d.toLocaleDateString("ko-KR", { weekday: "short" })}
                    </p>
                    <p className={isToday ? "text-2xl font-bold text-primary" : "text-2xl font-semibold"}>{d.getDate()}</p>
                  </div>
                  <ul className="space-y-2">
                    {list.map((o) => (
                      <li
                        key={`${o.event_id}-${o.start_at}`}
                        className="flex gap-3 rounded-lg border bg-card px-3 py-2.5 transition hover:bg-muted/50"
                      >
                        <span className="w-1 shrink-0 rounded-full" style={{ backgroundColor: colorOf.get(o.calendar_id) }} />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{o.title}</p>
                          <p className="text-xs text-muted-foreground">
                            {o.all_day
                              ? "종일"
                              : `${new Date(o.start_at).toLocaleTimeString("ko-KR", { hour: "numeric", minute: "2-digit" })} – ${new Date(o.end_at).toLocaleTimeString("ko-KR", { hour: "numeric", minute: "2-digit" })}`}
                            {" · "}
                            {calName(o.calendar_id)}
                            {o.location ? ` · ${o.location}` : ""}
                          </p>
                        </div>
                      </li>
                    ))}
                  </ul>
                </li>
              )
            })}
          </ol>
        </div>
      </section>

      <section className="min-h-0 overflow-hidden rounded-xl border bg-background p-4 [&_.fc]:h-full [&_.fc-daygrid-day-frame]:min-h-16">
        <FullCalendar
          plugins={[dayGridPlugin]}
          initialView="dayGridMonth"
          locale="ko"
          height="100%"
          headerToolbar={{ left: "title", center: "", right: "prev,next today" }}
          buttonText={{ today: "오늘" }}
          eventDisplay="list-item"
          dayMaxEvents={2}
          events={monthEvents}
          datesSet={(i) => setMonthRange({ from: i.start.toISOString(), to: i.end.toISOString() })}
        />
      </section>
    </div>
  )
}
