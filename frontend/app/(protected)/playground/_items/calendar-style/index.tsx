"use client"

// 플레이그라운드: 달력 자체의 스타일 비교 (미니멀 / 카드형 / 블록형). 실제 일정을 읽기만 한다.

import "./styles.css"

import { useMemo, useRef, useState } from "react"
import FullCalendar from "@fullcalendar/react"
import dayGridPlugin from "@fullcalendar/daygrid"
import timeGridPlugin from "@fullcalendar/timegrid"
import type { EventContentArg, EventInput } from "@fullcalendar/core"
import { ChevronLeft, ChevronRight } from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

import { Segmented, useCalendars, useOccurrences } from "../calendar-page/shared"

export const calendarStyleVariants = [
  { key: "A", name: "미니멀" },
  { key: "B", name: "카드형" },
  { key: "C", name: "블록형" },
]

const VIEWS = [
  { value: "dayGridMonth", label: "월" },
  { value: "timeGridWeek", label: "주" },
]

export function CalendarStyleItem({ variant }: { variant: string }) {
  const ref = useRef<FullCalendar | null>(null)
  const { colorOf } = useCalendars()
  const [range, setRange] = useState<{ from: string; to: string } | null>(null)
  const [title, setTitle] = useState("")
  const [view, setView] = useState("dayGridMonth")
  const occ = useOccurrences(range)
  const api = () => ref.current?.getApi()

  const events: EventInput[] = useMemo(
    () =>
      occ.map((o) => ({
        id: `${o.event_id}-${o.start_at}`,
        title: o.title,
        start: o.start_at,
        end: o.end_at,
        allDay: o.all_day,
        backgroundColor: "transparent",
        borderColor: "transparent",
        extendedProps: { color: colorOf.get(o.calendar_id) ?? "#6b7280" },
      })),
    [occ, colorOf],
  )

  const style = variant === "A" ? "minimal" : variant === "B" ? "card" : "block"

  return (
    <div className="flex h-full min-h-[640px] flex-col gap-3">
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" className="h-8 px-3" onClick={() => api()?.today()} data-testid="pg-style-today">
          오늘
        </Button>
        <Button variant="ghost" size="icon" className="size-8" onClick={() => api()?.prev()} aria-label="이전" data-testid="pg-style-prev">
          <ChevronLeft className="size-4" />
        </Button>
        <Button variant="ghost" size="icon" className="size-8" onClick={() => api()?.next()} aria-label="다음" data-testid="pg-style-next">
          <ChevronRight className="size-4" />
        </Button>
        <span className="text-lg font-semibold">{title}</span>
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
      </div>
      <div className={cn("cal-s min-h-0 flex-1", style)}>
        <FullCalendar
          ref={ref}
          plugins={[dayGridPlugin, timeGridPlugin]}
          initialView={view}
          headerToolbar={false}
          locale="ko"
          height="100%"
          expandRows
          dayMaxEvents
          nowIndicator
          allDayText="종일"
          slotMinTime="07:00:00"
          slotMaxTime="22:00:00"
          dayHeaderContent={(arg) =>
            arg.view.type === "dayGridMonth" ? (
              arg.text
            ) : (
              <div className="flex flex-col items-center gap-1 py-1">
                <span className="text-[11px] font-semibold text-muted-foreground">
                  {arg.date.toLocaleDateString("ko-KR", { weekday: "short" })}
                </span>
                <span
                  className={cn(
                    "grid size-8 place-items-center rounded-full text-base font-semibold text-foreground",
                    arg.isToday && "bg-primary text-primary-foreground",
                  )}
                >
                  {arg.date.getDate()}
                </span>
              </div>
            )
          }
          dayCellContent={(arg) => (arg.view.type === "dayGridMonth" ? arg.date.getDate() : null)}
          events={events}
          eventContent={(arg) => <EventChip arg={arg} style={style} />}
          datesSet={(i) => {
            setRange({ from: i.start.toISOString(), to: i.end.toISOString() })
            setTitle(i.view.title)
          }}
        />
      </div>
    </div>
  )
}

function EventChip({ arg, style }: { arg: EventContentArg; style: "minimal" | "card" | "block" }) {
  const color = arg.event.extendedProps.color as string
  const timed = !arg.event.allDay
  const inGrid = arg.view.type.startsWith("timeGrid") && timed

  if (style === "minimal") {
    return (
      <div className={cn("flex min-w-0 gap-1.5 overflow-hidden text-xs", inGrid ? "h-full flex-col border-l-2 pl-1.5" : "items-center px-0.5")} style={{ borderColor: color }}>
        {!inGrid && <span className="size-1.5 shrink-0 rounded-full" style={{ backgroundColor: color }} />}
        {timed && <span className="shrink-0 tabular-nums text-muted-foreground">{arg.timeText}</span>}
        <span className="truncate font-medium text-foreground">{arg.event.title}</span>
      </div>
    )
  }

  if (style === "card") {
    return (
      <div
        className={cn("flex min-w-0 gap-1.5 overflow-hidden rounded-md border-l-[3px] px-1.5 text-xs", inGrid ? "h-full flex-col py-1" : "items-center py-0.5")}
        style={{ borderColor: color, backgroundColor: `color-mix(in oklab, ${color} 13%, var(--background))` }}
      >
        <span className="truncate font-semibold text-foreground">{arg.event.title}</span>
        {timed && <span className="shrink-0 tabular-nums text-muted-foreground">{arg.timeText}</span>}
      </div>
    )
  }

  return (
    <div
      className={cn("flex min-w-0 gap-1.5 overflow-hidden rounded-md px-1.5 text-xs text-white", inGrid ? "h-full flex-col py-1" : "items-center py-0.5")}
      style={{ backgroundColor: color }}
    >
      <span className="truncate font-semibold">{arg.event.title}</span>
      {timed && <span className="shrink-0 tabular-nums opacity-80">{arg.timeText}</span>}
    </div>
  )
}
