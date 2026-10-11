"use client"

// B: 시간 막대. 내 시간과 기존 예약을 한 축에 겹쳐 그린다.

import { Lock } from "lucide-react"

import { cn } from "@/lib/utils"
import { formatTime } from "@/lib/utils/day-format"

import { fieldClass, Prop, roomLabel, type VariantProps } from "./shared"

export function VariantB({ rooms, roomId, onRoomChange, start, end, conflict }: VariantProps) {
  return (
    <Prop label="회의실">
      <select
        value={roomId}
        onChange={(e) => onRoomChange(e.target.value)}
        aria-invalid={conflict ? true : undefined}
        data-testid="pg-room-conflict-b-select"
        className={cn(fieldClass, "w-full", conflict && "border-rose-400 dark:border-rose-700")}
      >
        <option value="">없음</option>
        {rooms.map((r) => (
          <option key={r.id} value={r.id}>
            {roomLabel(r)}
          </option>
        ))}
      </select>
      {conflict && <Timeline start={start} end={end} conflict={conflict} />}
    </Prop>
  )
}

function Timeline({
  start,
  end,
  conflict,
}: {
  start: Date
  end: Date
  conflict: NonNullable<VariantProps["conflict"]>
}) {
  const cs = new Date(conflict.start_at).getTime()
  const ce = new Date(conflict.end_at).getTime()
  const ms = start.getTime()
  const me = end.getTime()
  const lo = Math.min(cs, ms)
  const hi = Math.max(ce, me)
  const span = Math.max(hi - lo, 1)
  const pos = (a: number, b: number) => ({
    left: `${((a - lo) / span) * 100}%`,
    width: `${((b - a) / span) * 100}%`,
  })
  const os = Math.max(cs, ms)
  const oe = Math.min(ce, me)

  return (
    <div role="alert" className="space-y-1.5 rounded-lg border border-rose-200 bg-card px-2.5 py-2 dark:border-rose-900/60" data-testid="pg-room-conflict-b-timeline">
      <div className="flex items-center justify-between gap-2 text-xs">
        {conflict.title ? (
          <span className="truncate font-medium">{conflict.title}</span>
        ) : (
          <span className="flex items-center gap-1 text-muted-foreground">
            <Lock className="size-3" />
            비공개 일정
          </span>
        )}
        <span className="shrink-0 font-semibold text-rose-600 dark:text-rose-400">겹침</span>
      </div>

      <div className="space-y-1">
        <Row label="예약">
          <span className="absolute inset-y-0 rounded-sm bg-muted-foreground/30" style={pos(cs, ce)} />
          {oe > os && <span className="absolute inset-y-0 rounded-sm bg-rose-400 dark:bg-rose-600" style={pos(os, oe)} />}
        </Row>
        <Row label="내 일정">
          <span className="absolute inset-y-0 rounded-sm bg-primary/70" style={pos(ms, me)} />
          {oe > os && <span className="absolute inset-y-0 rounded-sm bg-rose-400 dark:bg-rose-600" style={pos(os, oe)} />}
        </Row>
      </div>

      <div className="flex justify-between pl-11 text-[10px] text-muted-foreground tabular-nums">
        <span>{formatTime(new Date(lo))}</span>
        <span>{formatTime(new Date(hi))}</span>
      </div>
    </div>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-9 shrink-0 text-[10px] text-muted-foreground">{label}</span>
      <div className="relative h-2.5 flex-1 rounded-sm bg-muted">{children}</div>
    </div>
  )
}
