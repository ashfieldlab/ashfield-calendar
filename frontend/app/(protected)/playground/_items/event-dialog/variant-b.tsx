"use client"

// 안 B: 넓은 2단. 왼쪽은 제목·시간·설명, 오른쪽은 속성 패널(캘린더, 회의실, 장소, 반복, 알림).

import { useState } from "react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

import {
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

export function VariantB({ calendars, rooms, onClose, onSubmit }: VariantProps) {
  const [d, setD] = useState<EventDraft>(() => initialDraft(calendars))
  const set = (p: Partial<EventDraft>) => setD((x) => ({ ...x, ...p }))

  return (
    <div className="flex w-full max-w-[820px] flex-col overflow-hidden rounded-2xl border bg-background shadow-2xl">
      <div className="grid min-h-[420px] grid-cols-1 md:grid-cols-[1fr_260px]">
        <div className="space-y-6 p-7">
          <input
            autoFocus
            value={d.title}
            onChange={(e) => set({ title: e.target.value })}
            placeholder="새 일정"
            className="w-full bg-transparent text-2xl font-semibold outline-none placeholder:text-muted-foreground/50"
            data-testid="proto-b-title"
          />

          <div className="rounded-xl border bg-muted/30 p-4">
            <div className="flex items-baseline justify-between">
              <p className="text-sm font-semibold">{formatDateKo(d.date)}</p>
              <div className="inline-flex rounded-lg bg-muted p-0.5 text-xs">
                {[
                  [false, "시간 지정"],
                  [true, "종일"],
                ].map(([v, label]) => (
                  <button
                    key={String(v)}
                    type="button"
                    onClick={() => set({ allDay: v as boolean })}
                    data-testid={`proto-b-allday-${v}`}
                    className={cn(
                      "rounded-md px-2.5 py-1 font-medium",
                      d.allDay === v ? "bg-background shadow-sm" : "text-muted-foreground",
                    )}
                  >
                    {label as string}
                  </button>
                ))}
              </div>
            </div>
            <div className="mt-3 grid grid-cols-[auto_1fr_auto] items-center gap-x-2 gap-y-2 text-xs text-muted-foreground">
              <span>시작</span>
              <input type="date" value={d.date} onChange={(e) => set({ date: e.target.value })} className={field} data-testid="proto-b-date" />
              <input type="time" step={900} value={d.startTime} disabled={d.allDay} onChange={(e) => set({ startTime: e.target.value })} className={cn(field, d.allDay && "invisible")} data-testid="proto-b-start" />
              <span>종료</span>
              <input type="date" value={d.endDate} onChange={(e) => set({ endDate: e.target.value })} className={field} data-testid="proto-b-end-date" />
              <input type="time" step={900} value={d.endTime} disabled={d.allDay} onChange={(e) => set({ endTime: e.target.value })} className={cn(field, d.allDay && "invisible")} data-testid="proto-b-end" />
            </div>
          </div>

          <textarea
            value={d.description}
            onChange={(e) => set({ description: e.target.value })}
            placeholder="메모"
            rows={6}
            className="w-full resize-none rounded-xl border border-transparent bg-transparent p-0 text-sm leading-relaxed outline-none placeholder:text-muted-foreground focus:border-transparent"
            data-testid="proto-b-description"
          />
        </div>

        <aside className="space-y-4 border-t bg-muted/40 p-5 md:border-t-0 md:border-l">
          <Prop label="캘린더">
            <div className="space-y-1">
              {writableCalendars(calendars).map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => set({ calendarId: c.id })}
                  data-testid={`proto-b-calendar-${c.id}`}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm",
                    d.calendarId === c.id ? "bg-background font-medium shadow-sm" : "text-muted-foreground hover:bg-background/60",
                  )}
                >
                  <span className="size-2.5 rounded-full" style={{ backgroundColor: c.color }} />
                  <span className="truncate">{c.name}</span>
                </button>
              ))}
            </div>
          </Prop>
          {rooms.length > 0 && (
            <Prop label="회의실">
              <select value={d.roomId} onChange={(e) => set({ roomId: e.target.value })} className={cn(field, "w-full")} data-testid="proto-b-room">
                <option value="">없음</option>
                {rooms.map((r) => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </select>
            </Prop>
          )}
          <Prop label="장소">
            <input value={d.location} onChange={(e) => set({ location: e.target.value })} className={cn(field, "w-full")} data-testid="proto-b-location" />
          </Prop>
          <Prop label="반복">
            <select value={d.repeat} onChange={(e) => set({ repeat: e.target.value as Repeat })} className={cn(field, "w-full")} data-testid="proto-b-repeat">
              {Object.entries(REPEAT_LABEL).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </Prop>
          <Prop label="알림">
            <select value={d.reminder} onChange={(e) => set({ reminder: e.target.value })} className={cn(field, "w-full")} data-testid="proto-b-reminder">
              {Object.entries(REMINDER_LABEL).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </Prop>
        </aside>
      </div>
      <div className="flex justify-end gap-2 border-t px-6 py-3">
        <Button variant="ghost" onClick={onClose} data-testid="proto-b-cancel">취소</Button>
        <Button disabled={!d.title.trim() || !d.calendarId} onClick={() => onSubmit(d)} data-testid="proto-b-save">저장</Button>
      </div>
    </div>
  )
}

function Prop({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <p className="text-[11px] font-semibold tracking-wide text-muted-foreground">{label}</p>
      {children}
    </div>
  )
}
