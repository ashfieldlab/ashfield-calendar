"use client"

import { Lock, Plus } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover"
import type { EventOccurrence } from "@/lib/types/api"

export interface DayPopoverState {
  date: Date
  /** 누른 날짜 칸의 화면 위치 (팝오버 기준점) */
  rect: DOMRect
}

interface Props {
  state: DayPopoverState | null
  occurrences: EventOccurrence[]
  colorOf: Map<string, string>
  onClose: () => void
  onOpenEvent: (occ: EventOccurrence) => void
  onCreate: (date: Date) => void
}

/** 월 보기에서 날짜 칸을 누르면 뜨는 그날 일정 목록. */
export function DayPopover({ state, occurrences, colorOf, onClose, onOpenEvent, onCreate }: Props) {
  const items = state ? occurrencesOn(occurrences, state.date) : []

  return (
    <Popover open={!!state} onOpenChange={(o) => !o && onClose()}>
      {state && (
        <PopoverAnchor asChild>
          <div
            className="pointer-events-none fixed"
            style={{ left: state.rect.left, top: state.rect.top, width: state.rect.width, height: state.rect.height }}
          />
        </PopoverAnchor>
      )}
      <PopoverContent
        side="right"
        align="start"
        className="w-72 p-0"
        onOpenAutoFocus={(e) => e.preventDefault()}
        data-testid="calendar-day-popover"
      >
        {state && (
          <>
            <div className="border-b px-4 py-3">
              <p className="text-xs font-medium text-muted-foreground">
                {state.date.toLocaleDateString("ko-KR", { weekday: "long" })}
              </p>
              <p className="text-lg font-semibold">
                {state.date.toLocaleDateString("ko-KR", { month: "long", day: "numeric" })}
              </p>
            </div>
            <div className="max-h-72 overflow-y-auto p-2">
              {items.length === 0 ? (
                <p className="px-2 py-6 text-center text-sm text-muted-foreground">일정 없음</p>
              ) : (
                <ul className="space-y-1">
                  {items.map((o) => (
                    <li key={`${o.event_id}-${o.start_at}`}>
                      <button
                        type="button"
                        onClick={() => onOpenEvent(o)}
                        data-testid={`calendar-day-popover-event-${o.event_id}`}
                        className="flex w-full items-start gap-2.5 rounded-lg px-2 py-2 text-left hover:bg-muted"
                      >
                        <span
                          className="mt-1 h-3.5 w-1 shrink-0 rounded-full"
                          style={{ backgroundColor: colorOf.get(o.calendar_id) ?? "#6b7280" }}
                        />
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-1 truncate text-sm font-medium">
                            {o.booking_id && <Lock className="size-3 shrink-0 text-muted-foreground" />}
                            <span className="truncate">{o.title}</span>
                          </span>
                          <span className="block text-xs text-muted-foreground">{timeLabel(o)}</span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="border-t p-2">
              <Button
                variant="ghost"
                className="w-full justify-start gap-2"
                onClick={() => onCreate(state.date)}
                data-testid="calendar-day-popover-new"
              >
                <Plus className="size-4" />
                새 일정
              </Button>
            </div>
          </>
        )}
      </PopoverContent>
    </Popover>
  )
}

function occurrencesOn(all: EventOccurrence[], date: Date): EventOccurrence[] {
  const start = new Date(date)
  start.setHours(0, 0, 0, 0)
  const end = new Date(start.getTime() + 86_400_000)
  return all
    .filter((o) => new Date(o.start_at) < end && new Date(o.end_at) > start)
    .sort((a, b) => Number(b.all_day) - Number(a.all_day) || a.start_at.localeCompare(b.start_at))
}

function timeLabel(o: EventOccurrence): string {
  if (o.all_day) return "종일"
  const f = (s: string) => new Date(s).toLocaleTimeString("ko-KR", { hour: "numeric", minute: "2-digit" })
  return `${f(o.start_at)} – ${f(o.end_at)}`
}
