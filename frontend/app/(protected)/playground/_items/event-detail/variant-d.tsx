"use client"

// 안 D: 날짜 타일 + 단축키 메뉴. 큰 날짜 타일 옆에 요약, 아래로 행동 목록. 키보드만으로 응답, 편집, 삭제.

import { useEffect, useState } from "react"
import {
  AlertTriangle,
  Check,
  Copy,
  Download,
  Lock,
  Pencil,
  Ticket,
  Trash2,
  X,
} from "lucide-react"

import { cn } from "@/lib/utils"

import {
  Avatar,
  RSVP_CHOICES,
  RSVP_DOT,
  RSVP_LABEL,
  RSVP_TEXT,
  SCOPE_LABEL,
  ScenarioFrame,
  countsText,
  hostOf,
  type Detail,
} from "./shared"

const T = "pg-event-detail-d"
const WD = ["일", "월", "화", "수", "목", "금", "토"]

interface MenuItem {
  key: string
  label: string
  kbd: string
  icon: typeof Pencil
  run: () => void
  danger?: boolean
  checked?: boolean
}

export function VariantD() {
  return <ScenarioFrame View={Panel} prefix="d" />
}

function Panel({ d }: { d: Detail }) {
  const [mode, setMode] = useState<"main" | "delete">("main")
  const { ev, cal } = d
  const start = new Date(ev.start)

  const rsvpItems: MenuItem[] =
    d.kind === "invitee"
      ? RSVP_CHOICES.map((r, i) => ({
          key: `rsvp-${r}`,
          label: RSVP_LABEL[r],
          kbd: String(i + 1),
          icon: Check,
          run: () => d.setRsvp(r),
          checked: d.myRsvp === r,
        }))
      : []

  const actionItems: MenuItem[] = [
    ...(d.canEdit ? [{ key: "edit", label: "편집", kbd: "E", icon: Pencil, run: () => d.edit() }] : []),
    ...(d.kind === "booking" ? [{ key: "booking", label: "예약 관리", kbd: "B", icon: Ticket, run: d.openBooking }] : []),
    { key: "duplicate", label: d.kind === "readonly" ? "내 캘린더로 복제" : "복제", kbd: "D", icon: Copy, run: d.duplicate },
    { key: "ics", label: ".ics 다운로드", kbd: "I", icon: Download, run: d.ics },
    ...(d.canDelete
      ? [
          {
            key: "delete",
            label: "삭제",
            kbd: "⌫",
            icon: Trash2,
            danger: true,
            run: () => (d.recurring ? setMode("delete") : d.remove()),
          },
        ]
      : []),
  ]

  const deleteItems: MenuItem[] = [
    { key: "delete-occurrence", label: SCOPE_LABEL.occurrence, kbd: "1", icon: Trash2, danger: true, run: () => d.remove("occurrence") },
    { key: "delete-series", label: SCOPE_LABEL.series, kbd: "2", icon: Trash2, danger: true, run: () => d.remove("series") },
    { key: "delete-cancel", label: "취소", kbd: "Esc", icon: X, run: () => setMode("main") },
  ]

  const all = mode === "main" ? [...rsvpItems, ...actionItems] : deleteItems

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement | null
      if (t?.closest("input, textarea, select, [contenteditable='true']")) return
      if (e.metaKey || e.ctrlKey || e.altKey) return
      const k = e.key === "Backspace" || e.key === "Delete" ? "⌫" : e.key === "Escape" ? "Esc" : e.key.toUpperCase()
      const hit = all.find((m) => m.kbd === k)
      if (hit) {
        e.preventDefault()
        hit.run()
      } else if (k === "Esc") {
        d.close()
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  })

  return (
    <div className="w-[480px] overflow-hidden rounded-2xl border bg-background shadow-2xl">
      <div className="flex gap-4 p-5">
        <div
          className="flex w-20 shrink-0 flex-col items-center justify-center rounded-xl py-3 text-white"
          style={{ backgroundColor: cal.color }}
        >
          <span className="text-[11px] font-medium opacity-85">{start.getMonth() + 1}월</span>
          <span className="text-3xl font-bold leading-none tabular-nums">{start.getDate()}</span>
          <span className="mt-1 text-[11px] font-medium opacity-85">{WD[start.getDay()]}요일</span>
        </div>
        <div className="min-w-0 flex-1 py-0.5">
          <h2 className="text-lg font-semibold leading-snug">{ev.title}</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {ev.allDay ? d.dayText : d.timeText}
            {ev.repeat && `, ${ev.repeat}`}
          </p>
          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <span className="size-2 rounded-full" style={{ backgroundColor: cal.color }} />
              {cal.name}
            </span>
            {ev.location && <span>{ev.location}</span>}
            {d.room && <span>{d.room.name}</span>}
            {d.reminder && <span>{d.reminder}</span>}
          </div>
        </div>
      </div>

      {(ev.description || d.attendees.length > 0 || ev.booking || d.kind === "readonly") && (
        <div className="space-y-3 border-t px-5 py-4 text-sm">
          {ev.description && <p className="text-muted-foreground">{ev.description}</p>}
          {d.attendees.length > 0 && (
            <div className="flex items-center gap-3">
              <div className="flex -space-x-1">
                {d.attendees.map((a) => (
                  <span key={a.member.id} className="relative">
                    <Avatar member={a.member} size={26} className={cn("ring-2 ring-background", a.rsvp === "declined" && "opacity-40")} />
                    <span className={cn("absolute -bottom-px right-0 size-2 rounded-full ring-2 ring-background", RSVP_DOT[a.rsvp])} />
                  </span>
                ))}
              </div>
              <span className="text-xs text-muted-foreground">{countsText(d.counts)}</span>
            </div>
          )}
          {d.conflicts.length > 0 && (
            <p className="flex items-center gap-1.5 text-xs text-amber-700 dark:text-amber-300">
              <AlertTriangle className="size-3.5" />
              겹치는 일정: {d.conflicts.join(", ")}
            </p>
          )}
          {ev.booking && (
            <p className="flex items-center gap-1.5 text-xs">
              <Ticket className="size-3.5 text-muted-foreground" />
              {ev.booking.typeName}, {ev.booking.guestName}
              <span className="text-muted-foreground">{ev.booking.guestEmail}</span>
            </p>
          )}
          {d.kind === "readonly" && (
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Lock className="size-3.5" />
              읽기 전용, {hostOf(cal.url)}
            </p>
          )}
        </div>
      )}

      <div className="border-t bg-muted/30 p-2">
        {mode === "delete" && (
          <p className="px-3 pb-1 pt-1.5 text-xs font-semibold text-rose-700 dark:text-rose-300">반복 일정 삭제</p>
        )}
        {mode === "main" && rsvpItems.length > 0 && (
          <>
            <p className="px-3 pb-1 pt-1.5 text-xs font-semibold text-muted-foreground">
              내 응답
              {d.myRsvp && <span className={cn("ml-1.5 font-medium", RSVP_TEXT[d.myRsvp])}>{RSVP_LABEL[d.myRsvp]}</span>}
            </p>
            <div className="grid grid-cols-3 gap-1 pb-1">
              {rsvpItems.map((m) => (
                <Row key={m.key} m={m} compact />
              ))}
            </div>
            <div className="mx-2 my-1 h-px bg-border" />
          </>
        )}
        <ul>
          {(mode === "main" ? actionItems : deleteItems).map((m) => (
            <li key={m.key}>
              <Row m={m} />
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

function Row({ m, compact }: { m: MenuItem; compact?: boolean }) {
  const Icon = m.icon
  return (
    <button
      type="button"
      onClick={m.run}
      className={cn(
        "group flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-background",
        m.danger && "text-rose-700 hover:bg-rose-50 dark:text-rose-300 dark:hover:bg-rose-950/40",
        m.checked && "bg-background font-medium shadow-sm ring-1 ring-border",
      )}
      data-testid={`${T}-${m.key}`}
    >
      {compact ? (
        <Icon className={cn("size-4", m.checked ? "opacity-100" : "opacity-0")} />
      ) : (
        <Icon className="size-4 text-muted-foreground group-hover:text-current" />
      )}
      <span className="flex-1">{m.label}</span>
      <kbd className="rounded border bg-background px-1.5 py-px font-mono text-[10px] text-muted-foreground">{m.kbd}</kbd>
    </button>
  )
}
