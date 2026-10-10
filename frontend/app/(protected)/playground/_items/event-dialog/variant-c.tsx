"use client"

// 안 C: 빠른 입력 우선. 제목 한 줄 + 시간 칩, 나머지는 "옵션" 칩을 눌러야 펼쳐진다.

import { useState } from "react"
import { AlignLeft, Bell, ChevronDown, DoorOpen, MapPin, Repeat as RepeatIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

import {
  Chip,
  REMINDER_LABEL,
  REPEAT_LABEL,
  field,
  formatDateKo,
  initialDraft,
  writableCalendars,
  type EventDraft,
  type Repeat,
  type VariantProps,
} from "./shared"

type Extra = "repeat" | "room" | "location" | "reminder" | "description"

export function VariantC({ calendars, rooms, onClose, onSubmit }: VariantProps) {
  const [d, setD] = useState<EventDraft>(() => initialDraft(calendars))
  const [open, setOpen] = useState<Set<Extra>>(new Set())
  const [editTime, setEditTime] = useState(false)
  const set = (p: Partial<EventDraft>) => setD((x) => ({ ...x, ...p }))
  const toggle = (k: Extra) =>
    setOpen((s) => {
      const n = new Set(s)
      if (n.has(k)) n.delete(k)
      else n.add(k)
      return n
    })
  const cal = calendars.find((c) => c.id === d.calendarId)

  return (
    <div className="w-full max-w-[560px] rounded-2xl border bg-background p-2 shadow-2xl">
      <div className="flex items-center gap-2 rounded-xl px-3 py-2">
        <span className="size-3 shrink-0 rounded-full" style={{ backgroundColor: cal?.color }} />
        <input
          autoFocus
          value={d.title}
          onChange={(e) => set({ title: e.target.value })}
          onKeyDown={(e) => {
            if (e.key === "Enter" && d.title.trim()) onSubmit(d)
            if (e.key === "Escape") onClose()
          }}
          placeholder="무엇을 하나요?"
          className="h-10 min-w-0 flex-1 bg-transparent text-lg outline-none placeholder:text-muted-foreground/60"
          data-testid="proto-c-title"
        />
        <select
          value={d.calendarId}
          onChange={(e) => set({ calendarId: e.target.value })}
          className="h-8 max-w-36 truncate rounded-md bg-muted px-2 text-xs font-medium outline-none"
          data-testid="proto-c-calendar"
        >
          {writableCalendars(calendars).map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>

      <div className="flex flex-wrap items-center gap-1.5 px-3 pb-2">
        <button
          type="button"
          onClick={() => setEditTime((v) => !v)}
          data-testid="proto-c-time"
          className="inline-flex h-8 items-center gap-1 rounded-full bg-primary px-3 text-xs font-medium text-primary-foreground"
        >
          {formatDateKo(d.date)} {d.allDay ? "종일" : `${d.startTime} – ${d.endTime}`}
          <ChevronDown className="size-3.5 opacity-70" />
        </button>
        <Chip testid="proto-c-chip-repeat" active={open.has("repeat") || d.repeat !== "none"} onClick={() => toggle("repeat")}>
          <RepeatIcon className="size-3.5" /> {d.repeat === "none" ? "반복" : REPEAT_LABEL[d.repeat]}
        </Chip>
        {rooms.length > 0 && (
          <Chip testid="proto-c-chip-room" active={open.has("room") || !!d.roomId} onClick={() => toggle("room")}>
            <DoorOpen className="size-3.5" /> {rooms.find((r) => r.id === d.roomId)?.name ?? "회의실"}
          </Chip>
        )}
        <Chip testid="proto-c-chip-location" active={open.has("location") || !!d.location} onClick={() => toggle("location")}>
          <MapPin className="size-3.5" /> {d.location || "장소"}
        </Chip>
        <Chip testid="proto-c-chip-reminder" active={open.has("reminder") || !!d.reminder} onClick={() => toggle("reminder")}>
          <Bell className="size-3.5" /> {d.reminder ? REMINDER_LABEL[d.reminder] : "알림"}
        </Chip>
        <Chip testid="proto-c-chip-description" active={open.has("description") || !!d.description} onClick={() => toggle("description")}>
          <AlignLeft className="size-3.5" /> 메모
        </Chip>
      </div>

      {(editTime || open.size > 0) && (
        <div className="mx-2 mb-2 space-y-3 rounded-xl bg-muted/50 p-3">
          {editTime && (
            <div className="flex flex-wrap items-center gap-1.5">
              <input type="date" value={d.date} onChange={(e) => set({ date: e.target.value, endDate: e.target.value })} className={field} data-testid="proto-c-date" />
              {!d.allDay && (
                <>
                  <input type="time" step={900} value={d.startTime} onChange={(e) => set({ startTime: e.target.value })} className={field} data-testid="proto-c-start" />
                  <span className="text-muted-foreground">–</span>
                  <input type="time" step={900} value={d.endTime} onChange={(e) => set({ endTime: e.target.value })} className={field} data-testid="proto-c-end" />
                </>
              )}
              <label className="ml-1 inline-flex items-center gap-1.5 text-sm text-muted-foreground">
                <input type="checkbox" checked={d.allDay} onChange={(e) => set({ allDay: e.target.checked })} data-testid="proto-c-allday" />
                종일
              </label>
            </div>
          )}
          {open.has("repeat") && (
            <div className="flex flex-wrap gap-1.5">
              {(Object.keys(REPEAT_LABEL) as Repeat[]).map((k) => (
                <Chip key={k} testid={`proto-c-repeat-${k}`} active={d.repeat === k} onClick={() => set({ repeat: k })}>
                  {REPEAT_LABEL[k]}
                </Chip>
              ))}
            </div>
          )}
          {open.has("room") && (
            <select value={d.roomId} onChange={(e) => set({ roomId: e.target.value })} className={cn(field, "w-full")} data-testid="proto-c-room">
              <option value="">회의실 없음</option>
              {rooms.map((r) => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </select>
          )}
          {open.has("location") && (
            <input value={d.location} onChange={(e) => set({ location: e.target.value })} placeholder="장소" className={cn(field, "w-full")} data-testid="proto-c-location" />
          )}
          {open.has("reminder") && (
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(REMINDER_LABEL).map(([k, v]) => (
                <Chip key={k} testid={`proto-c-reminder-${k || "none"}`} active={d.reminder === k} onClick={() => set({ reminder: k })}>
                  {v}
                </Chip>
              ))}
            </div>
          )}
          {open.has("description") && (
            <textarea value={d.description} onChange={(e) => set({ description: e.target.value })} placeholder="메모" rows={3} className="w-full resize-none rounded-lg border border-input bg-background p-2.5 text-sm outline-none" data-testid="proto-c-description" />
          )}
        </div>
      )}

      <div className="flex items-center justify-end gap-2 px-2 pb-1">
        <Button variant="ghost" size="sm" onClick={onClose} data-testid="proto-c-cancel">취소</Button>
        <Button size="sm" disabled={!d.title.trim() || !d.calendarId} onClick={() => onSubmit(d)} data-testid="proto-c-save">저장</Button>
      </div>
    </div>
  )
}
