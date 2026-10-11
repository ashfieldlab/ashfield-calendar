"use client"

import { Lock } from "lucide-react"

import type { Room, RoomConflict } from "@/lib/types/api"
import { formatTime, rangeText, ymdOf } from "@/lib/utils/day-format"

/** 폼 날짜와 같은 날이면 시각만, 아니면 날짜까지 */
function conflictWhen(c: Pick<RoomConflict, "start_at" | "end_at" | "all_day">, formStart: Date): string {
  const day = ymdOf(formStart)
  const sameDay =
    !c.all_day && ymdOf(new Date(c.start_at)) === day && ymdOf(new Date(c.end_at)) === day
  return sameDay
    ? `${formatTime(c.start_at)} ~ ${formatTime(c.end_at)}`
    : rangeText(c.start_at, c.end_at, c.all_day)
}

/** 이벤트 폼 회의실 칸 아래: 겹친 일정 + 같은 시간 빈 회의실 바로 고르기. */
export function RoomConflictCard({
  conflict,
  formStart,
  freeRooms,
  onPick,
}: {
  conflict: Pick<RoomConflict, "start_at" | "end_at" | "all_day" | "title">
  formStart: Date
  freeRooms: Room[]
  onPick: (roomId: string) => void
}) {
  return (
    <div
      role="alert"
      className="space-y-2 rounded-lg border border-rose-200 bg-rose-50/60 px-2.5 py-2 dark:border-rose-900/60 dark:bg-rose-950/30"
      data-testid="event-form-room-conflict"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          {conflict.title ? (
            <p className="truncate text-sm font-medium" data-testid="event-form-room-conflict-title">
              {conflict.title}
            </p>
          ) : (
            <p className="flex items-center gap-1 text-sm text-muted-foreground">
              <Lock className="size-3" />
              비공개 일정
            </p>
          )}
          <p className="text-xs text-muted-foreground tabular-nums">{conflictWhen(conflict, formStart)}</p>
        </div>
        <span className="shrink-0 rounded-full bg-rose-100 px-1.5 py-0.5 text-[10px] font-semibold text-rose-700 dark:bg-rose-900/50 dark:text-rose-300">
          겹침
        </span>
      </div>
      {freeRooms.length > 0 && (
        <div className="space-y-1 border-t border-rose-200/70 pt-2 dark:border-rose-900/50">
          <p className="text-[11px] text-muted-foreground">빈 회의실</p>
          <div className="flex flex-wrap gap-1">
            {freeRooms.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => onPick(r.id)}
                data-testid={`event-form-room-free-${r.id}`}
                className="rounded-md border border-input bg-background px-2 py-0.5 text-xs transition hover:border-ring hover:bg-muted"
              >
                {r.name}
                {r.capacity != null ? ` (${r.capacity}인)` : ""}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
