"use client"

import type { DayCellContentArg, DayHeaderContentArg, EventContentArg } from "@fullcalendar/core"

import { cn } from "@/lib/utils"

/** 일정 블록: 캘린더 색으로 채운 칩. 목록 보기는 제목만 (색 점은 FullCalendar 가 그린다). */
export function renderEventContent(arg: EventContentArg) {
  if (arg.view.type.startsWith("list")) return arg.event.title
  const color = (arg.event.extendedProps.color as string | undefined) ?? arg.event.backgroundColor
  const timed = !arg.event.allDay
  const inGrid = arg.view.type.startsWith("timeGrid") && timed
  return (
    <div
      className={cn(
        "flex min-w-0 gap-1.5 overflow-hidden rounded-md px-1.5 text-[13px] leading-snug text-white",
        inGrid ? "h-full flex-col py-1" : "items-center py-0.5",
      )}
      style={{ backgroundColor: color }}
    >
      <span className="truncate font-semibold">{arg.event.title}</span>
      {timed && <span className="shrink-0 tabular-nums opacity-80">{arg.timeText}</span>}
    </div>
  )
}

/** 월 보기 날짜 칸: "1일" 대신 숫자만. */
export function renderDayCellContent(arg: DayCellContentArg) {
  if (arg.view.type === "dayGridMonth") return arg.date.getDate()
  if (arg.view.type.startsWith("timeGrid")) return null
  return arg.date.getDate()
}

/** 주·일 보기 머리: 요일 + 큰 날짜 숫자 (오늘은 녹색 원). */
export function renderDayHeaderContent(arg: DayHeaderContentArg) {
  if (!arg.view.type.startsWith("timeGrid")) return arg.text
  return (
    <div className="flex flex-col items-center gap-1 py-1">
      <span className="text-xs font-semibold text-muted-foreground">
        {arg.date.toLocaleDateString("ko-KR", { weekday: "short" })}
      </span>
      <span
        className={cn(
          "grid size-9 place-items-center rounded-full text-lg font-semibold text-foreground",
          arg.isToday && "bg-primary text-primary-foreground",
        )}
      >
        {arg.date.getDate()}
      </span>
    </div>
  )
}
