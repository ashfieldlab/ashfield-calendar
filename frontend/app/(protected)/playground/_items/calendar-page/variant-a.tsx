"use client"

// 안 A: 왼쪽 패널(새 일정 버튼, 미니 달력, 캘린더 체크 목록) + 오른쪽 큰 달력. Google 캘린더형.

import { useMemo, useRef, useState } from "react"
import FullCalendar from "@fullcalendar/react"
import dayGridPlugin from "@fullcalendar/daygrid"
import timeGridPlugin from "@fullcalendar/timegrid"
import listPlugin from "@fullcalendar/list"
import { ChevronLeft, ChevronRight, Plus } from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

import { CalendarToggleList, Segmented, VIEWS, toEvents, useCalendars, useOccurrences } from "./shared"

export function VariantA() {
  const ref = useRef<FullCalendar | null>(null)
  const { calendars, hidden, toggle, colorOf } = useCalendars()
  const [range, setRange] = useState<{ from: string; to: string } | null>(null)
  const [title, setTitle] = useState("")
  const [view, setView] = useState("dayGridMonth")
  const [focus, setFocus] = useState(new Date())
  const occ = useOccurrences(range)
  const events = useMemo(() => toEvents(occ, colorOf, hidden), [occ, colorOf, hidden])
  const api = () => ref.current?.getApi()

  return (
    <div className="flex h-full min-h-[640px] overflow-hidden rounded-xl border bg-background">
      <aside className="flex w-64 shrink-0 flex-col gap-6 border-r p-4">
        <Button className="h-10 w-full justify-start gap-2 rounded-xl shadow-sm" data-testid="pg-a-new">
          <Plus className="size-4" /> 새 일정
        </Button>
        <MiniMonth
          month={focus}
          onPick={(d) => {
            setFocus(d)
            api()?.gotoDate(d)
          }}
        />
        <CalendarToggleList calendars={calendars} hidden={hidden} onToggle={toggle} />
      </aside>

      <section className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-3 border-b px-5 py-3">
          <Button variant="outline" size="sm" onClick={() => api()?.today()} data-testid="pg-a-today">
            오늘
          </Button>
          <div className="flex">
            <Button variant="ghost" size="icon" className="size-8" onClick={() => api()?.prev()} aria-label="이전" data-testid="pg-a-prev">
              <ChevronLeft className="size-4" />
            </Button>
            <Button variant="ghost" size="icon" className="size-8" onClick={() => api()?.next()} aria-label="다음" data-testid="pg-a-next">
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
              setFocus(i.view.currentStart)
            }}
          />
        </div>
      </section>
    </div>
  )
}

function MiniMonth({ month, onPick }: { month: Date; onPick: (d: Date) => void }) {
  const [cursor, setCursor] = useState(new Date(month.getFullYear(), month.getMonth(), 1))
  const shown = new Date(cursor.getFullYear(), cursor.getMonth(), 1)
  const start = new Date(shown)
  start.setDate(1 - shown.getDay())
  const today = new Date().toDateString()
  const days = Array.from({ length: 42 }, (_, i) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + i))

  return (
    <div className="space-y-2 px-1">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold">
          {shown.getFullYear()}년 {shown.getMonth() + 1}월
        </span>
        <div className="flex">
          <button type="button" className="rounded p-1 hover:bg-muted" onClick={() => setCursor(new Date(shown.getFullYear(), shown.getMonth() - 1, 1))} aria-label="이전 달" data-testid="pg-a-mini-prev">
            <ChevronLeft className="size-3.5" />
          </button>
          <button type="button" className="rounded p-1 hover:bg-muted" onClick={() => setCursor(new Date(shown.getFullYear(), shown.getMonth() + 1, 1))} aria-label="다음 달" data-testid="pg-a-mini-next">
            <ChevronRight className="size-3.5" />
          </button>
        </div>
      </div>
      <div className="grid grid-cols-7 text-center text-[11px]">
        {["일", "월", "화", "수", "목", "금", "토"].map((d) => (
          <span key={d} className="py-1 text-muted-foreground">{d}</span>
        ))}
        {days.map((d) => (
          <button
            key={d.toISOString()}
            type="button"
            onClick={() => onPick(d)}
            data-testid={`pg-a-mini-${d.getMonth()}-${d.getDate()}`}
            className={cn(
              "mx-auto grid size-7 place-items-center rounded-full text-xs hover:bg-muted",
              d.getMonth() !== shown.getMonth() && "text-muted-foreground/50",
              d.toDateString() === today && "bg-primary font-semibold text-primary-foreground hover:bg-primary",
            )}
          >
            {d.getDate()}
          </button>
        ))}
      </div>
    </div>
  )
}
