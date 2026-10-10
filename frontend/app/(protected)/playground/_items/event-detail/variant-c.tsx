"use client"

// 안 C: 오른쪽 시트. 달력을 가리지 않고 옆에서 열린다. 반복 범위를 먼저 고르고 편집, 삭제.

import { useState } from "react"
import {
  AlertTriangle,
  AlignLeft,
  Bell,
  Check,
  CircleHelp,
  Clock,
  Copy,
  DoorOpen,
  Download,
  Lock,
  MapPin,
  Pencil,
  Ticket,
  Trash2,
  X,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

import { EVENTS, calendarOf } from "../_mock"
import {
  Avatar,
  RSVP_ACTIVE,
  RSVP_CHOICES,
  RSVP_DOT,
  RSVP_LABEL,
  RSVP_ORDER,
  RSVP_TEXT,
  SCOPE_LABEL,
  ScenarioFrame,
  hostOf,
  type Detail,
  type Rsvp,
  type Scope,
} from "./shared"

const T = "pg-event-detail-c"

const RSVP_ICON: Record<Rsvp, typeof Check> = {
  accepted: Check,
  tentative: CircleHelp,
  declined: X,
  pending: Clock,
}

export function VariantC() {
  return <ScenarioFrame View={Screen} prefix="c" />
}

function Screen({ d }: { d: Detail }) {
  return (
    <div className="flex h-[620px] w-full max-w-[1000px] overflow-hidden rounded-2xl border bg-background shadow-2xl">
      <FauxWeek d={d} />
      <Sheet d={d} />
    </div>
  )
}

/** 뒤쪽 달력 자리 (장식) */
function FauxWeek({ d }: { d: Detail }) {
  const days = ["월 12", "화 13", "수 14", "목 15", "금 16"]
  const blocks = EVENTS.filter((e) => !e.allDay).slice(0, 6)
  return (
    <div className="relative hidden flex-1 select-none bg-muted/20 md:block" aria-hidden>
      <div className="grid grid-cols-5 border-b text-center text-xs text-muted-foreground">
        {days.map((x) => (
          <div key={x} className="py-2.5">{x}</div>
        ))}
      </div>
      <div className="absolute inset-x-0 bottom-0 top-9 grid grid-cols-5">
        {days.map((x) => (
          <div key={x} className="border-r border-border/50" />
        ))}
      </div>
      {blocks.map((e, i) => {
        const active = e.id === d.ev.id
        return (
          <div
            key={e.id}
            className={cn(
              "absolute rounded-md px-2 py-1 text-[11px] font-medium text-white transition-opacity",
              active ? "z-10 ring-2 ring-foreground/70 ring-offset-2 ring-offset-background" : "opacity-40",
            )}
            style={{
              backgroundColor: calendarOf(e.calendarId).color,
              left: `calc(${(i % 5) * 20}% + 6px)`,
              width: "calc(20% - 12px)",
              top: 60 + ((i * 97) % 420),
              height: 52,
            }}
          >
            {e.title}
          </div>
        )
      })}
      {!blocks.some((e) => e.id === d.ev.id) && (
        <div
          className="absolute z-10 rounded-md px-2 py-1 text-[11px] font-medium text-white ring-2 ring-foreground/70 ring-offset-2 ring-offset-background"
          style={{ backgroundColor: d.cal.color, left: "calc(40% + 6px)", width: "calc(20% - 12px)", top: 44, height: 22 }}
        >
          {d.ev.title}
        </div>
      )}
    </div>
  )
}

function Sheet({ d }: { d: Detail }) {
  const [tab, setTab] = useState<"info" | "people">("info")
  const [scope, setScope] = useState<Scope>("occurrence")
  const [confirm, setConfirm] = useState(false)
  const { ev, cal } = d
  const scopeArg = d.recurring ? scope : undefined
  const hasPeople = d.attendees.length > 0

  return (
    <aside className="flex w-full flex-col border-l bg-card md:w-[400px]">
      <div className="flex items-center gap-1 border-b px-3 py-2">
        <Button variant="ghost" size="icon-sm" onClick={d.close} title="닫기" data-testid={`${T}-close-button`}>
          <X />
        </Button>
        <div className="ml-auto flex gap-0.5">
          <Button variant="ghost" size="icon-sm" onClick={d.duplicate} title="복제" data-testid={`${T}-duplicate-button`}>
            <Copy />
          </Button>
          <Button variant="ghost" size="icon-sm" onClick={d.ics} title=".ics 다운로드" data-testid={`${T}-ics-button`}>
            <Download />
          </Button>
        </div>
      </div>

      <div className="flex gap-3 px-5 pb-4 pt-5">
        <span className="w-1 shrink-0 rounded-full" style={{ backgroundColor: cal.color }} />
        <div className="min-w-0">
          <p className="text-xs font-medium text-muted-foreground">{cal.name}</p>
          <h2 className="mt-0.5 text-xl font-semibold leading-snug">{ev.title}</h2>
          <p className="mt-1 text-sm">{d.dayText}</p>
          <p className="text-sm text-muted-foreground">
            {d.timeText}
            {!ev.allDay && `, ${d.duration}`}
          </p>
        </div>
      </div>

      {d.recurring && (d.canEdit || d.canDelete) && (
        <div className="mx-5 mb-4 flex items-center gap-2 rounded-lg bg-muted/60 p-1 text-sm">
          <span className="pl-2 text-xs text-muted-foreground">{ev.repeat}</span>
          <div className="ml-auto inline-flex">
            {(["occurrence", "series"] as Scope[]).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setScope(s)}
                className={cn(
                  "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                  scope === s ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
                )}
                data-testid={`${T}-scope-${s}`}
              >
                {s === "occurrence" ? "이 일정만" : "전체"}
              </button>
            ))}
          </div>
        </div>
      )}

      {hasPeople && (
        <div className="flex gap-4 border-b px-5 text-sm">
          {(
            [
              ["info", "상세"],
              ["people", `참석자 ${d.attendees.length}`],
            ] as const
          ).map(([k, label]) => (
            <button
              key={k}
              type="button"
              onClick={() => setTab(k)}
              className={cn(
                "-mb-px border-b-2 py-2 font-medium transition-colors",
                tab === k ? "border-foreground text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
              )}
              data-testid={`${T}-tab-${k}`}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
        {tab === "info" || !hasPeople ? <Info d={d} /> : <PeopleTab d={d} />}
      </div>

      <div className="border-t p-3">
        {confirm ? (
          <div className="flex items-center gap-2 rounded-lg bg-rose-50 p-2 dark:bg-rose-950/40" data-testid={`${T}-delete-confirm`}>
            <span className="mr-auto pl-1 text-sm font-medium text-rose-800 dark:text-rose-200">
              {d.recurring ? `${SCOPE_LABEL[scope]} 삭제` : "삭제할까요?"}
            </span>
            <Button size="sm" variant="ghost" onClick={() => setConfirm(false)} data-testid={`${T}-delete-cancel`}>
              취소
            </Button>
            <Button size="sm" variant="destructive" onClick={() => d.remove(scopeArg)} data-testid={`${T}-delete-ok`}>
              삭제
            </Button>
          </div>
        ) : d.kind === "invitee" ? (
          <div className="space-y-2">
            <div className="grid grid-cols-3 gap-2">
              {RSVP_CHOICES.map((r) => {
                const Icon = RSVP_ICON[r]
                return (
                  <button
                    key={r}
                    type="button"
                    onClick={() => d.setRsvp(r)}
                    className={cn(
                      "flex flex-col items-center gap-1 rounded-lg border py-2 text-xs font-medium transition-colors",
                      d.myRsvp === r ? RSVP_ACTIVE[r] : "border-input hover:bg-muted",
                    )}
                    data-testid={`${T}-rsvp-${r}`}
                  >
                    <Icon className="size-4" />
                    {RSVP_LABEL[r]}
                  </button>
                )
              })}
            </div>
            {d.canEdit && (
              <Button variant="outline" className="w-full" onClick={() => d.edit(scopeArg)} data-testid={`${T}-edit-button`}>
                <Pencil />
                {d.recurring ? `${SCOPE_LABEL[scope]} 편집` : "편집"}
              </Button>
            )}
          </div>
        ) : d.kind === "organizer" ? (
          <div className="flex gap-2">
            <Button
              variant="ghost"
              className="text-destructive hover:bg-destructive/10 hover:text-destructive"
              onClick={() => setConfirm(true)}
              data-testid={`${T}-delete-button`}
            >
              <Trash2 />
              삭제
            </Button>
            <Button className="ml-auto" onClick={() => d.edit(scopeArg)} data-testid={`${T}-edit-button`}>
              <Pencil />
              {d.recurring ? `${SCOPE_LABEL[scope]} 편집` : "편집"}
            </Button>
          </div>
        ) : d.kind === "booking" ? (
          <Button variant="outline" className="w-full" onClick={d.openBooking} data-testid={`${T}-booking-button`}>
            <Ticket />
            예약 관리
          </Button>
        ) : (
          <Button variant="outline" className="w-full" onClick={d.duplicate} data-testid={`${T}-copy-mine-button`}>
            <Copy />
            내 캘린더로 복제
          </Button>
        )}
      </div>
    </aside>
  )
}

function Info({ d }: { d: Detail }) {
  const { ev, cal } = d
  return (
    <dl className="space-y-4 text-sm">
      {ev.booking && (
        <div className="rounded-xl border border-violet-200 bg-violet-50 p-3 dark:border-violet-900/60 dark:bg-violet-950/40">
          <p className="flex items-center gap-1.5 text-xs font-medium text-violet-700 dark:text-violet-300">
            <Ticket className="size-3.5" />
            {ev.booking.typeName}
          </p>
          <p className="mt-1.5 font-medium">{ev.booking.guestName}</p>
          <p className="text-xs text-muted-foreground">{ev.booking.guestEmail}</p>
        </div>
      )}
      {ev.location && <Field icon={MapPin} label="장소" value={ev.location} />}
      {d.room && <Field icon={DoorOpen} label="회의실" value={`${d.room.name}, ${d.room.capacity}인`} />}
      {d.reminder && <Field icon={Bell} label="알림" value={d.reminder} />}
      {ev.description && <Field icon={AlignLeft} label="설명" value={ev.description} />}
      {cal.source === "external_ics" && (
        <Field icon={Lock} label="구독, 읽기 전용" value={hostOf(cal.url)} />
      )}
      {d.attendees.length > 0 && d.myRsvp && (
        <Field icon={Check} label="내 응답" value={RSVP_LABEL[d.myRsvp]} />
      )}
    </dl>
  )
}

function PeopleTab({ d }: { d: Detail }) {
  return (
    <div className="space-y-3" data-testid={`${T}-people`}>
      {d.conflicts.length > 0 && (
        <div className="flex items-start gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-2 text-xs text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200">
          <AlertTriangle className="mt-px size-3.5 shrink-0" />
          겹치는 일정: {d.conflicts.join(", ")}
        </div>
      )}
      <div className="flex flex-wrap gap-1.5">
        {RSVP_ORDER.filter((r) => d.counts[r] > 0).map((r) => (
          <span key={r} className={cn("inline-flex items-center gap-1.5 rounded-full bg-muted px-2 py-0.5 text-xs font-medium", RSVP_TEXT[r])}>
            <span className={cn("size-1.5 rounded-full", RSVP_DOT[r])} />
            {RSVP_LABEL[r]} {d.counts[r]}
          </span>
        ))}
      </div>
      <ul className="divide-y">
        {[...d.attendees]
          .sort((a, b) => RSVP_ORDER.indexOf(a.rsvp) - RSVP_ORDER.indexOf(b.rsvp))
          .map((a) => {
            const Icon = RSVP_ICON[a.rsvp]
            return (
              <li key={a.member.id} className="flex items-center gap-3 py-2.5">
                <span className="relative">
                  <Avatar member={a.member} size={32} />
                  <span className={cn("absolute -bottom-0.5 -right-0.5 grid size-3.5 place-items-center rounded-full ring-2 ring-card", RSVP_DOT[a.rsvp])}>
                    <Icon className="size-2.5 text-white" strokeWidth={3} />
                  </span>
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {a.member.name}
                    {a.me && <span className="ml-1 text-xs font-normal text-muted-foreground">(나)</span>}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">{a.organizer ? "주최" : a.member.email}</p>
                </div>
                <span className={cn("text-xs", RSVP_TEXT[a.rsvp])}>{RSVP_LABEL[a.rsvp]}</span>
              </li>
            )
          })}
      </ul>
    </div>
  )
}

function Field({ icon: Icon, label, value }: { icon: typeof MapPin; label: string; value: string }) {
  return (
    <div className="flex gap-3">
      <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0">
        <dt className="text-xs text-muted-foreground">{label}</dt>
        <dd className="mt-0.5 whitespace-pre-wrap">{value}</dd>
      </div>
    </div>
  )
}
