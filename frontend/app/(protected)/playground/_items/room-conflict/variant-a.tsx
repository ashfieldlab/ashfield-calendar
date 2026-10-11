"use client"

// A: 겹친 일정 카드. 일정 칩처럼 제목과 시각.

import { Lock } from "lucide-react"

import { cn } from "@/lib/utils"

import { conflictWhen, fieldClass, Prop, roomLabel, type VariantProps } from "./shared"

export function VariantA({ rooms, roomId, onRoomChange, start, conflict }: VariantProps) {
  return (
    <Prop label="회의실">
      <select
        value={roomId}
        onChange={(e) => onRoomChange(e.target.value)}
        aria-invalid={conflict ? true : undefined}
        data-testid="pg-room-conflict-a-select"
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
          className="overflow-hidden rounded-lg border border-rose-200 bg-card dark:border-rose-900/60"
          data-testid="pg-room-conflict-a-card"
        >
          <p className="bg-rose-50 px-2.5 py-1 text-[11px] font-semibold text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">
            예약 겹침
          </p>
          <div className="flex gap-2 px-2.5 py-2">
            <span className="w-0.5 shrink-0 rounded-full bg-rose-400 dark:bg-rose-600" />
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
          </div>
        </div>
      )}
    </Prop>
  )
}
