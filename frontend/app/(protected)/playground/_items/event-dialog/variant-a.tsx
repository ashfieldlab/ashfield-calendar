"use client"

// 안 A: 아이콘 줄 목록. 큰 제목 입력 아래로 라벨 없이 아이콘 + 값 한 줄씩.

import { useState } from "react"
import { AlignLeft, Bell, CalendarDays, Clock, DoorOpen, MapPin, Repeat as RepeatIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

import {
  REMINDER_LABEL,
  REPEAT_LABEL,
  field,
  initialDraft,
  writableCalendars,
  type EventDraft,
  type Repeat,
  type VariantProps,
} from "./shared"

export function VariantA({ calendars, rooms, onClose, onSubmit }: VariantProps) {
  const [d, setD] = useState<EventDraft>(() => initialDraft(calendars))
  const set = (p: Partial<EventDraft>) => setD((x) => ({ ...x, ...p }))
  const cal = calendars.find((c) => c.id === d.calendarId)

  return (
    <div className="w-full max-w-[520px] overflow-hidden rounded-2xl border bg-background shadow-2xl">
      <div className="h-1.5" style={{ backgroundColor: cal?.color ?? "var(--primary)" }} />
      <div className="space-y-1 p-5 pb-3">
        <input
          autoFocus
          value={d.title}
          onChange={(e) => set({ title: e.target.value })}
          placeholder="제목"
          className="w-full bg-transparent py-1 text-xl font-semibold outline-none placeholder:text-muted-foreground/60"
          data-testid="proto-a-title"
        />

        <Row icon={Clock}>
          <div className="flex flex-wrap items-center gap-1.5">
            <input type="date" value={d.date} onChange={(e) => set({ date: e.target.value, endDate: e.target.value })} className={field} data-testid="proto-a-date" />
            {!d.allDay && (
              <>
                <input type="time" step={900} value={d.startTime} onChange={(e) => set({ startTime: e.target.value })} className={field} data-testid="proto-a-start" />
                <span className="text-muted-foreground">–</span>
                <input type="time" step={900} value={d.endTime} onChange={(e) => set({ endTime: e.target.value })} className={field} data-testid="proto-a-end" />
              </>
            )}
            <label className="ml-1 inline-flex items-center gap-1.5 text-sm text-muted-foreground">
              <input type="checkbox" checked={d.allDay} onChange={(e) => set({ allDay: e.target.checked })} data-testid="proto-a-allday" />
              종일
            </label>
          </div>
        </Row>

        <Row icon={RepeatIcon}>
          <select value={d.repeat} onChange={(e) => set({ repeat: e.target.value as Repeat })} className={cn(field, "border-transparent px-1 hover:bg-muted")} data-testid="proto-a-repeat">
            {Object.entries(REPEAT_LABEL).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </Row>

        <Row icon={CalendarDays}>
          <span className="size-3 shrink-0 rounded-full" style={{ backgroundColor: cal?.color }} />
          <select value={d.calendarId} onChange={(e) => set({ calendarId: e.target.value })} className={cn(field, "border-transparent px-1 hover:bg-muted")} data-testid="proto-a-calendar">
            {writableCalendars(calendars).map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </Row>

        {rooms.length > 0 && (
          <Row icon={DoorOpen}>
            <select value={d.roomId} onChange={(e) => set({ roomId: e.target.value })} className={cn(field, "border-transparent px-1 hover:bg-muted")} data-testid="proto-a-room">
              <option value="">회의실 없음</option>
              {rooms.map((r) => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </select>
          </Row>
        )}

        <Row icon={MapPin}>
          <input value={d.location} onChange={(e) => set({ location: e.target.value })} placeholder="장소" className="h-9 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground" data-testid="proto-a-location" />
        </Row>

        <Row icon={Bell}>
          <select value={d.reminder} onChange={(e) => set({ reminder: e.target.value })} className={cn(field, "border-transparent px-1 hover:bg-muted")} data-testid="proto-a-reminder">
            {Object.entries(REMINDER_LABEL).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </Row>

        <Row icon={AlignLeft} top>
          <textarea value={d.description} onChange={(e) => set({ description: e.target.value })} placeholder="설명" rows={3} className="w-full resize-none bg-transparent py-2 text-sm outline-none placeholder:text-muted-foreground" data-testid="proto-a-description" />
        </Row>
      </div>
      <div className="flex justify-end gap-2 border-t bg-muted/40 px-5 py-3">
        <Button variant="ghost" onClick={onClose} data-testid="proto-a-cancel">취소</Button>
        <Button disabled={!d.title.trim() || !d.calendarId} onClick={() => onSubmit(d)} data-testid="proto-a-save">저장</Button>
      </div>
    </div>
  )
}

function Row({ icon: Icon, children, top }: { icon: typeof Clock; children: React.ReactNode; top?: boolean }) {
  return (
    <div className={cn("flex gap-3 rounded-lg px-1", top ? "items-start" : "items-center")}>
      <Icon className={cn("size-4 shrink-0 text-muted-foreground", top && "mt-2.5")} />
      <div className="flex min-w-0 flex-1 items-center gap-2">{children}</div>
    </div>
  )
}
