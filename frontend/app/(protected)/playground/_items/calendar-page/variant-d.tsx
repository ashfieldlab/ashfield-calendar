"use client"

// 안 D: A 에서 미니 달력을 빼고, C 의 큰 오늘 날짜를 달력 위에 둔다.

import { useMemo, useRef, useState } from "react"
import FullCalendar from "@fullcalendar/react"
import dayGridPlugin from "@fullcalendar/daygrid"
import timeGridPlugin from "@fullcalendar/timegrid"
import listPlugin from "@fullcalendar/list"
import { ChevronLeft, ChevronRight, Plus } from "lucide-react"

import { Button } from "@/components/ui/button"

import { CalendarToggleList, Segmented, VIEWS, toEvents, useCalendars, useOccurrences } from "./shared"

export function VariantD() {
  const ref = useRef<FullCalendar | null>(null)
  const { calendars, hidden, toggle, colorOf } = useCalendars()
  const [range, setRange] = useState<{ from: string; to: string } | null>(null)
  const [title, setTitle] = useState("")
  const [view, setView] = useState("dayGridMonth")
  const occ = useOccurrences(range)
  const events = useMemo(() => toEvents(occ, colorOf, hidden), [occ, colorOf, hidden])
  const api = () => ref.current?.getApi()
  const now = new Date()

  return (
    <div className="flex h-full min-h-[640px] overflow-hidden rounded-xl border bg-background">
      <aside className="flex w-64 shrink-0 flex-col gap-6 border-r p-4">
        <Button className="h-10 w-full justify-start gap-2 rounded-xl shadow-sm" data-testid="pg-d-new">
          <Plus className="size-4" /> 새 일정
        </Button>
        <CalendarToggleList calendars={calendars} hidden={hidden} onToggle={toggle} />
      </aside>

      <section className="flex min-w-0 flex-1 flex-col">
        <div className="px-6 pt-5">
          <p className="text-sm font-medium text-muted-foreground">
            {now.toLocaleDateString("ko-KR", { weekday: "long" })}
          </p>
          <h1 className="text-4xl font-bold tracking-tight">
            {now.toLocaleDateString("ko-KR", { month: "long", day: "numeric" })}
          </h1>
        </div>
        <header className="flex items-center gap-3 border-b px-5 py-3">
          <Button variant="outline" size="sm" onClick={() => api()?.today()} data-testid="pg-d-today">
            오늘
          </Button>
          <div className="flex">
            <Button variant="ghost" size="icon" className="size-8" onClick={() => api()?.prev()} aria-label="이전" data-testid="pg-d-prev">
              <ChevronLeft className="size-4" />
            </Button>
            <Button variant="ghost" size="icon" className="size-8" onClick={() => api()?.next()} aria-label="다음" data-testid="pg-d-next">
              <ChevronRight className="size-4" />
            </Button>
          </div>
          <h2 className="text-lg font-semibold">{title}</h2>
          <div className="ml-auto">
            <Segmented
              value={view}
              options={VIEWS}
              onChange={(v) => {
                setView(v)
                api()?.changeView(v)
              }}
            />
          </div>
        </header>
        <div className="min-h-0 flex-1 p-3 [&_.fc]:h-full">
          <FullCalendar
            ref={ref}
            plugins={[dayGridPlugin, timeGridPlugin, listPlugin]}
            initialView="dayGridMonth"
            headerToolbar={false}
            locale="ko"
            height="100%"
            dayMaxEvents={3}
            nowIndicator
            events={events}
            datesSet={(i) => {
              setRange({ from: i.start.toISOString(), to: i.end.toISOString() })
              setTitle(i.view.title)
            }}
          />
        </div>
      </section>
    </div>
  )
}

