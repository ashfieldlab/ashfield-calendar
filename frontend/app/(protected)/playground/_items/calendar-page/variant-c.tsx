"use client"

// 안 C: 주간 시간표 중심. 위에 큰 날짜와 빠른 추가 입력, 캘린더 필터 칩. 기본 보기가 주.

import { useMemo, useRef, useState } from "react"
import FullCalendar from "@fullcalendar/react"
import dayGridPlugin from "@fullcalendar/daygrid"
import timeGridPlugin from "@fullcalendar/timegrid"
import listPlugin from "@fullcalendar/list"
import { ChevronLeft, ChevronRight, CornerDownLeft } from "lucide-react"

import { Button } from "@/components/ui/button"
import { useToast } from "@/components/ui-custom/use-toast"
import { cn } from "@/lib/utils"

import { Segmented, VIEWS, toEvents, useCalendars, useOccurrences } from "./shared"

export function VariantC() {
  const { toast } = useToast()
  const ref = useRef<FullCalendar | null>(null)
  const { calendars, hidden, toggle, colorOf } = useCalendars()
  const [range, setRange] = useState<{ from: string; to: string } | null>(null)
  const [title, setTitle] = useState("")
  const [view, setView] = useState("timeGridWeek")
  const [quick, setQuick] = useState("")
  const occ = useOccurrences(range)
  const events = useMemo(() => toEvents(occ, colorOf, hidden), [occ, colorOf, hidden])
  const api = () => ref.current?.getApi()
  const now = new Date()

  return (
    <div className="flex h-full min-h-[640px] flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-muted-foreground">
            {now.toLocaleDateString("ko-KR", { weekday: "long" })}
          </p>
          <h2 className="text-4xl font-bold tracking-tight">
            {now.toLocaleDateString("ko-KR", { month: "long", day: "numeric" })}
          </h2>
        </div>
        <form
          className="flex w-full max-w-md items-center gap-2 rounded-xl border bg-background px-3 shadow-sm focus-within:ring-3 focus-within:ring-ring/20"
          onSubmit={(e) => {
            e.preventDefault()
            if (!quick.trim()) return
            toast.success(`빠른 추가 (저장 안 함): ${quick}`)
            setQuick("")
          }}
        >
          <input
            value={quick}
            onChange={(e) => setQuick(e.target.value)}
            placeholder="내일 오후 3시 팀 회의"
            className="h-11 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            data-testid="pg-c-quick"
          />
          <CornerDownLeft className="size-4 text-muted-foreground" />
        </form>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1">
          <Button variant="outline" size="sm" onClick={() => api()?.today()} data-testid="pg-c-today">오늘</Button>
          <Button variant="ghost" size="icon" className="size-8" onClick={() => api()?.prev()} aria-label="이전" data-testid="pg-c-prev">
            <ChevronLeft className="size-4" />
          </Button>
          <Button variant="ghost" size="icon" className="size-8" onClick={() => api()?.next()} aria-label="다음" data-testid="pg-c-next">
            <ChevronRight className="size-4" />
          </Button>
          <span className="ml-1 text-sm font-semibold">{title}</span>
        </div>
        <div className="mx-2 h-5 w-px bg-border" />
        <div className="flex flex-wrap gap-1.5">
          {calendars.map((c) => {
            const on = !hidden.has(c.id)
            const color = c.color_override ?? c.color
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => toggle(c.id)}
                data-testid={`pg-c-chip-${c.id}`}
                className={cn(
                  "inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-xs font-medium transition",
                  on ? "bg-background" : "border-dashed text-muted-foreground opacity-60",
                )}
              >
                <span className="size-2 rounded-full" style={{ backgroundColor: color }} />
                {c.name}
              </button>
            )
          })}
        </div>
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

      <div className="min-h-0 flex-1 overflow-hidden rounded-xl border bg-background p-2 [&_.fc]:h-full">
        <FullCalendar
          ref={ref}
          plugins={[dayGridPlugin, timeGridPlugin, listPlugin]}
          initialView="timeGridWeek"
          headerToolbar={false}
          locale="ko"
          height="100%"
          nowIndicator
          allDayText="종일"
          slotMinTime="07:00:00"
          slotMaxTime="23:00:00"
          scrollTime={`${String(Math.max(now.getHours() - 1, 7)).padStart(2, "0")}:00:00`}
          events={events}
          datesSet={(i) => {
            setRange({ from: i.start.toISOString(), to: i.end.toISOString() })
            setTitle(i.view.title)
          }}
        />
      </div>
    </div>
  )
}
