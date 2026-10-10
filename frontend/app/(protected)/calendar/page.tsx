"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import FullCalendar from "@fullcalendar/react"
import dayGridPlugin from "@fullcalendar/daygrid"
import timeGridPlugin from "@fullcalendar/timegrid"
import multiMonthPlugin from "@fullcalendar/multimonth"
import listPlugin from "@fullcalendar/list"
import interactionPlugin from "@fullcalendar/interaction"
import type {
  DatesSetArg,
  EventClickArg,
  EventDropArg,
  EventInput,
} from "@fullcalendar/core"
import type {
  DateClickArg,
  EventResizeDoneArg,
} from "@fullcalendar/interaction"
import { ChevronLeft, ChevronRight, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"

import { useToast } from "@/components/ui-custom/use-toast"

import { DayPopover, type DayPopoverState } from "@/components/calendar/day-popover"
import { EventForm } from "@/components/calendar/event-form"
import {
  renderDayCellContent,
  renderDayHeaderContent,
  renderEventContent,
} from "@/components/calendar/calendar-render"
import "@/components/calendar/calendar-theme.css"
import { api } from "@/lib/api-client"
import { invalidateApi, useApiGet } from "@/lib/hooks/use-api"
import type {
  CalendarListResponse,
  EventResponse,
  EventOccurrence,
  OccurrenceListResponse,
} from "@/lib/types/api"

const VIEW_OPTIONS = [
  { value: "multiMonthYear", label: "연" },
  { value: "dayGridMonth", label: "월" },
  { value: "timeGridWeek", label: "주" },
  { value: "timeGridDay", label: "일" },
  { value: "listWeek", label: "목록" },
]

export default function CalendarPage() {
  const { toast } = useToast()
  const calendarRef = useRef<FullCalendar | null>(null)
  const [range, setRange] = useState<{ from: string; to: string } | null>(null)
  const [title, setTitle] = useState("")
  const [view, setView] = useState("dayGridMonth")
  const [formState, setFormState] = useState<
    | { mode: "create"; start: Date }
    | { mode: "edit"; eventId: string; start: Date }
    | null
  >(null)

  const { data: calList } = useApiGet<CalendarListResponse>("/api/v1/calendars")
  const calendars = useMemo(() => calList?.calendars ?? [], [calList])

  const occUrl = range
    ? `/api/v1/events?from=${encodeURIComponent(range.from)}&to=${encodeURIComponent(range.to)}`
    : null
  const { data: occList } = useApiGet<OccurrenceListResponse>(occUrl)

  const colorOf = useMemo(() => {
    const m = new Map<string, string>()
    for (const c of calendars) m.set(c.id, c.color ?? "#6b7280")
    return m
  }, [calendars])

  // external_ics 캘린더는 읽기 전용: 드래그 잠금.
  const readonlyCalIds = useMemo(() => {
    const s = new Set<string>()
    for (const c of calendars) if (c.source === "external_ics") s.add(c.id)
    return s
  }, [calendars])

  const events: EventInput[] = useMemo(
    () =>
      (occList?.occurrences ?? []).map((occ) => {
        // 예약 연결과 외부 캘린더 일정은 드래그 이동/리사이즈 불가.
        const locked = !!occ.booking_id || readonlyCalIds.has(occ.calendar_id)
        return {
          id: `${occ.event_id}-${occ.start_at}`,
          title: occ.booking_id ? `🔒 ${occ.title}` : occ.title,
          start: occ.start_at,
          end: occ.end_at,
          allDay: occ.all_day,
          editable: !locked,
          backgroundColor: colorOf.get(occ.calendar_id) ?? "#6b7280",
          borderColor: colorOf.get(occ.calendar_id) ?? "#6b7280",
          extendedProps: {
            color: colorOf.get(occ.calendar_id) ?? "#6b7280",
            eventId: occ.event_id,
            bookingId: occ.booking_id,
            isRecurring: occ.is_recurring,
          },
        }
      }),
    [occList, colorOf, readonlyCalIds],
  )

  // 반복 일정 드래그/리사이즈 시 "이 회차만 / 전체" 선택 대기 상태.
  const [recurDrag, setRecurDrag] = useState<{
    revert: () => void
    eventId: string
    occurrenceStart: string
    startDeltaMs: number
    endDeltaMs: number
    newStart: string
    newEnd: string
  } | null>(null)
  const [dragBusy, setDragBusy] = useState(false)
  const [dayPop, setDayPop] = useState<DayPopoverState | null>(null)

  const editingEventId = formState?.mode === "edit" ? formState.eventId : null
  const { data: editingEvent } = useApiGet<EventResponse>(
    editingEventId ? `/api/v1/events/${editingEventId}` : null,
  )

  function handleDatesSet(info: DatesSetArg) {
    setRange({
      from: info.start.toISOString(),
      to: info.end.toISOString(),
    })
    setTitle(info.view.title)
    setView(info.view.type)
  }

  // 월과 연 보기에서 날짜 칸을 누르면 그날 일정 목록, 주와 일 보기는 그 시각으로 새 일정.
  function handleDateClick(info: DateClickArg) {
    if (info.view.type === "dayGridMonth" || info.view.type === "multiMonthYear") {
      setDayPop({ date: info.date, rect: info.dayEl.getBoundingClientRect() })
      return
    }
    createAt(info.date, info.allDay)
  }

  function createAt(date: Date, allDay = true) {
    setDayPop(null)
    if (calendars.length === 0) {
      toast.error("먼저 캘린더를 만들어주세요")
      return
    }
    const start = new Date(date)
    if (allDay) start.setHours(9, 0, 0, 0)
    setFormState({ mode: "create", start })
  }
  const createAtRef = useRef(createAt)
  useEffect(() => {
    createAtRef.current = createAt
  })

  function openOccurrence(occ: EventOccurrence) {
    setDayPop(null)
    if (occ.booking_id) {
      toast.error("예약과 연결된 일정입니다. 예약 페이지에서 변경 또는 취소해주세요.")
      return
    }
    setFormState({ mode: "edit", eventId: occ.event_id, start: new Date(occ.start_at) })
  }

  function handleEventClick(info: EventClickArg) {
    // "+N 더보기" 팝오버에서 클릭한 경우: 모달 띄우기 전에 팝오버 닫기 (겹침 방지).
    document.querySelector<HTMLElement>(".fc-popover-close")?.click()
    const eventId = info.event.extendedProps.eventId as string
    const bookingId = info.event.extendedProps.bookingId as string | null
    if (bookingId) {
      toast.error(
        "예약과 연결된 일정입니다. 예약 페이지에서 변경 또는 취소해주세요.",
      )
      return
    }
    setFormState({
      mode: "edit",
      eventId,
      start: info.event.start ?? new Date(),
    })
  }

  // 드래그 이동과 리사이즈 공통: 반복이면 범위 선택 모달, 아니면 바로 저장.
  function handleEventChange(info: EventDropArg | EventResizeDoneArg) {
    const eventId = info.event.extendedProps.eventId as string
    const isRecurring = info.event.extendedProps.isRecurring as boolean
    const oldStart = info.oldEvent.start
    const newStart = info.event.start
    if (!oldStart || !newStart) {
      info.revert()
      return
    }
    const oldEnd = info.oldEvent.end ?? oldStart
    const newEnd = info.event.end ?? newStart
    const newStartISO = newStart.toISOString()
    const newEndISO = newEnd.toISOString()

    if (isRecurring) {
      setRecurDrag({
        revert: info.revert,
        eventId,
        occurrenceStart: oldStart.toISOString(),
        startDeltaMs: newStart.getTime() - oldStart.getTime(),
        endDeltaMs: newEnd.getTime() - oldEnd.getTime(),
        newStart: newStartISO,
        newEnd: newEndISO,
      })
      return
    }
    void patchTimes({
      eventId,
      start: newStartISO,
      end: newEndISO,
      revert: info.revert,
    })
  }

  async function patchTimes(opts: {
    eventId: string
    start: string
    end: string
    occurrence?: string
    revert: () => void
    successMsg?: string
  }) {
    try {
      const url = opts.occurrence
        ? `/api/v1/events/${opts.eventId}?occurrence=${encodeURIComponent(opts.occurrence)}`
        : `/api/v1/events/${opts.eventId}`
      await api(url, {
        method: "PATCH",
        body: { start_at: opts.start, end_at: opts.end },
      })
      toast.success(opts.successMsg ?? "일정을 옮겼습니다")
      invalidateApi("/api/v1/events")
    } catch (e) {
      opts.revert()
      const err = e as { code?: string; message: string }
      toast.error(
        err.code === "ROOM_CONFLICT" ? err.message : `이동 실패: ${err.message}`,
      )
    }
  }

  // 반복 일정: 이 회차만 분리(occurrence) 또는 전체(마스터에 delta 반영).
  async function applyRecurDrag(scope: "occurrence" | "series") {
    if (!recurDrag) return
    setDragBusy(true)
    try {
      if (scope === "occurrence") {
        await patchTimes({
          eventId: recurDrag.eventId,
          start: recurDrag.newStart,
          end: recurDrag.newEnd,
          occurrence: recurDrag.occurrenceStart,
          revert: recurDrag.revert,
          successMsg: "이 회차를 옮겼습니다",
        })
      } else {
        // 전체: 마스터 시각을 delta 만큼 이동해 앵커 보존.
        const master = await api<EventResponse>(
          `/api/v1/events/${recurDrag.eventId}`,
        )
        const mStart = new Date(
          Date.parse(master.start_at) + recurDrag.startDeltaMs,
        ).toISOString()
        const mEnd = new Date(
          Date.parse(master.end_at) + recurDrag.endDeltaMs,
        ).toISOString()
        await patchTimes({
          eventId: recurDrag.eventId,
          start: mStart,
          end: mEnd,
          revert: recurDrag.revert,
          successMsg: "전체 반복 일정을 옮겼습니다",
        })
      }
    } finally {
      setDragBusy(false)
      setRecurDrag(null)
    }
  }

  function cancelRecurDrag() {
    recurDrag?.revert()
    setRecurDrag(null)
  }

  function openNewEvent() {
    if (calendars.length === 0) {
      toast.error("먼저 캘린더를 만들어주세요")
      return
    }
    const start = new Date()
    start.setMinutes(0, 0, 0)
    setFormState({ mode: "create", start })
  }

  const fcApi = () => calendarRef.current?.getApi()

  // 모바일은 월 그리드 대신 목록(아젠다) 뷰가 적합: 마운트 시 1회 전환.
  useEffect(() => {
    if (
      typeof window !== "undefined" &&
      window.matchMedia("(max-width: 640px)").matches
    ) {
      calendarRef.current?.getApi().changeView("listWeek")
    }
  }, [])

  const today = new Date()

  return (
    <div className="flex h-full" data-testid="calendar-page">
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="px-6 pt-5">
          <p className="text-sm font-medium text-muted-foreground">
            {today.toLocaleDateString("ko-KR", { weekday: "long" })}
          </p>
          <h1 className="text-3xl font-bold tracking-tight md:text-4xl" data-testid="calendar-today-heading">
            {today.toLocaleDateString("ko-KR", { month: "long", day: "numeric" })}
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2 px-4 py-3 md:px-5">
          <Button variant="outline" size="sm" className="h-8 px-3" onClick={() => fcApi()?.today()} data-testid="calendar-today-button">
            오늘
          </Button>
          <div className="flex">
            <Button
              variant="ghost"
              size="icon"
              className="size-8"
              onClick={() => fcApi()?.prev()}
              data-testid="calendar-prev-button"
              aria-label="이전"
            >
              <ChevronLeft className="size-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="size-8"
              onClick={() => fcApi()?.next()}
              data-testid="calendar-next-button"
              aria-label="다음"
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>
          <span className="text-lg font-semibold" data-testid="calendar-title">
            {title}
          </span>

          <div className="ml-auto flex items-center gap-2">
            <div className="inline-flex h-8 items-center rounded-lg bg-muted p-0.5 text-sm" role="radiogroup" aria-label="보기">
              {VIEW_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  role="radio"
                  aria-checked={view === opt.value}
                  onClick={() => fcApi()?.changeView(opt.value)}
                  data-testid={`calendar-view-${opt.value}`}
                  className={
                    view === opt.value
                      ? "h-7 rounded-md bg-background px-3 font-medium shadow-sm"
                      : "h-7 rounded-md px-3 font-medium text-muted-foreground hover:text-foreground"
                  }
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <Button onClick={openNewEvent} size="sm" className="h-8 gap-1.5 px-3" data-testid="calendar-new-event-button">
              <Plus className="size-4" />
              <span className="hidden sm:inline">새 일정</span>
            </Button>
          </div>
        </div>

        <section className="cal-theme min-h-0 flex-1 px-4 pb-4">
          <FullCalendar
            ref={calendarRef}
            plugins={[
              dayGridPlugin,
              timeGridPlugin,
              multiMonthPlugin,
              listPlugin,
              interactionPlugin,
            ]}
            initialView="dayGridMonth"
            headerToolbar={false}
            locale="ko"
            firstDay={0}
            height="100%"
            expandRows
            dayMaxEvents={true}
            slotMinTime="06:00:00"
            slotMaxTime="22:00:00"
            events={events}
            nowIndicator
            allDayText="종일"
            eventContent={renderEventContent}
            dayCellContent={renderDayCellContent}
            dayHeaderContent={renderDayHeaderContent}
            editable
            eventDrop={handleEventChange}
            eventResize={handleEventChange}
            datesSet={handleDatesSet}
            dateClick={handleDateClick}
            navLinks
            navLinkDayClick="timeGridDay"
            moreLinkClick={(arg) => {
              const cell = (arg.jsEvent.target as HTMLElement).closest(".fc-daygrid-day")
              if (cell) setDayPop({ date: arg.date, rect: cell.getBoundingClientRect() })
            }}
            dayCellDidMount={(arg) => {
              if (arg.view.type !== "dayGridMonth") return
              const frame = arg.el.querySelector(".fc-daygrid-day-frame")
              if (!frame) return
              // 날짜 칸 오른쪽 위 "+" (마우스를 올리면 보임): 그날로 바로 새 일정
              const btn = document.createElement("button")
              btn.type = "button"
              btn.className = "cal-day-add"
              btn.textContent = "+"
              btn.setAttribute("aria-label", "새 일정")
              btn.dataset.testid = `calendar-day-add-${arg.date.getFullYear()}-${arg.date.getMonth() + 1}-${arg.date.getDate()}`
              const stop = (e: Event) => e.stopPropagation()
              btn.addEventListener("pointerdown", stop)
              btn.addEventListener("mousedown", stop)
              btn.addEventListener("click", (e) => {
                e.stopPropagation()
                createAtRef.current(arg.date)
              })
              frame.appendChild(btn)
            }}
            eventClick={handleEventClick}
        />
        </section>

      </div>

      {recurDrag && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40"
          onClick={() => !dragBusy && cancelRecurDrag()}
        >
          <div
            className="w-80 space-y-3 rounded-lg bg-card p-5 shadow-lg dark:ring-1 dark:ring-foreground/10"
            onClick={(e) => e.stopPropagation()}
            data-testid="calendar-recur-drag"
          >
            <h3 className="text-base font-semibold text-foreground">
              반복 일정 이동
            </h3>
            <p className="text-sm text-muted-foreground">
              이 회차만 옮길까요, 전체 반복 일정을 옮길까요?
            </p>
            <div className="space-y-2 pt-1">
              <button
                onClick={() => applyRecurDrag("occurrence")}
                disabled={dragBusy}
                data-testid="calendar-recur-drag-one"
                className="w-full rounded border border-input px-3 py-2 text-sm font-medium text-foreground hover:bg-muted/50 disabled:opacity-50"
              >
                이 회차만 이동
              </button>
              <button
                onClick={() => applyRecurDrag("series")}
                disabled={dragBusy}
                data-testid="calendar-recur-drag-series"
                className="w-full rounded bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                전체 반복 일정 이동
              </button>
              <button
                onClick={cancelRecurDrag}
                disabled={dragBusy}
                data-testid="calendar-recur-drag-cancel"
                className="w-full rounded px-3 py-2 text-sm text-muted-foreground hover:bg-muted disabled:opacity-50"
              >
                취소
              </button>
            </div>
          </div>
        </div>
      )}

      <DayPopover
        state={dayPop}
        occurrences={occList?.occurrences ?? []}
        colorOf={colorOf}
        onClose={() => setDayPop(null)}
        onOpenEvent={openOccurrence}
        onCreate={(d) => createAt(d)}
      />

      {formState && (formState.mode === "create" || editingEvent) && (
        <EventForm
          calendars={calendars}
          initialStart={formState.start}
          editing={formState.mode === "edit" ? editingEvent ?? null : null}
          onClose={() => setFormState(null)}
        />
      )}
    </div>
  )
}
