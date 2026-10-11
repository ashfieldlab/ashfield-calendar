"use client"

// C: A 카드 + 같은 시간에 빈 회의실을 바로 고르는 버튼.

import { Lock } from "lucide-react"

import { cn } from "@/lib/utils"

import { conflictWhen, fieldClass, Prop, roomLabel, type VariantProps } from "./shared"

export function VariantC({ rooms, roomId, onRoomChange, start, conflict, busyRoomIds }: VariantProps) {
  const free = rooms.filter((r) => r.id !== roomId && !busyRoomIds.has(r.id))
  return (
    <Prop label="회의실">
      <select
        value={roomId}
        onChange={(e) => onRoomChange(e.target.value)}
        aria-invalid={conflict ? true : undefined}
        data-testid="pg-room-conflict-c-select"
        className={cn(fieldClass, "w-full", conflict && "border-rose-400 dark:border-rose-700")}
      >
        <option value="">없음</option>
        {rooms.map((r) => (
          <option key={r.id} value={r.id}>
            {roomLabel(r)}
          </option>
        ))}
      </select>
      {conflict && (
        <div
          role="alert"
          className="space-y-2 rounded-lg border border-rose-200 bg-rose-50/60 px-2.5 py-2 dark:border-rose-900/60 dark:bg-rose-950/30"
          data-testid="pg-room-conflict-c-card"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              {conflict.title ? (
                <p className="truncate text-sm font-medium">{conflict.title}</p>
              ) : (
                <p className="flex items-center gap-1 text-sm text-muted-foreground">
                  <Lock className="size-3" />
                  비공개 일정
                </p>
              )}
              <p className="text-xs text-muted-foreground tabular-nums">{conflictWhen(conflict, start)}</p>
            </div>
            <span className="shrink-0 rounded-full bg-rose-100 px-1.5 py-0.5 text-[10px] font-semibold text-rose-700 dark:bg-rose-900/50 dark:text-rose-300">
              겹침
            </span>
          </div>
          {free.length > 0 && (
            <div className="space-y-1 border-t border-rose-200/70 pt-2 dark:border-rose-900/50">
              <p className="text-[11px] text-muted-foreground">빈 회의실</p>
              <div className="flex flex-wrap gap-1">
                {free.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => onRoomChange(r.id)}
                    data-testid={`pg-room-conflict-c-free-${r.id}`}
                    className="rounded-md border border-input bg-background px-2 py-0.5 text-xs transition hover:border-ring hover:bg-muted"
                  >
                    {roomLabel(r)}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </Prop>
  )
}
