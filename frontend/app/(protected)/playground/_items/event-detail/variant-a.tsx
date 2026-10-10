"use client"

// 안 A: 작은 팝오버 카드. 누른 일정 옆에 붙는 카드, 위쪽 아이콘 툴바, 아래 응답 바.

import { useState } from "react"
import {
  AlignLeft,
  Bell,
  CalendarDays,
  Copy,
  DoorOpen,
  Download,
  Lock,
  MapPin,
  Pencil,
  Repeat,
  Ticket,
  Trash2,
  Users,
  X,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

import {
  Avatar,
  RSVP_ACTIVE,
  RSVP_CHOICES,
  RSVP_DOT,
  RSVP_LABEL,
  RSVP_TEXT,
  SCOPE_LABEL,
  ScenarioFrame,
  countsText,
  hostOf,
  type Detail,
  type Scope,
} from "./shared"

const T = "pg-event-detail-a"

export function VariantA() {
  return <ScenarioFrame View={Card} prefix="a" />
}

function Card({ d }: { d: Detail }) {
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [showPeople, setShowPeople] = useState(false)
  const [moreDesc, setMoreDesc] = useState(false)
  const { ev, cal } = d

  return (
    <div className="flex items-start gap-3">
      {/* 누른 일정 자리 */}
      <div className="mt-6 hidden w-36 rounded-lg bg-background/70 p-2 shadow-sm sm:block">
        <p className="px-1 pb-1.5 text-[11px] font-medium text-muted-foreground">{d.dayText.split(" (")[0]}</p>
        <div
          className="truncate rounded-md px-2 py-1 text-xs font-medium text-white ring-2 ring-offset-2 ring-offset-background"
          style={{ backgroundColor: cal.color, ["--tw-ring-color" as string]: cal.color }}
        >
          {ev.allDay ? ev.title : `${d.timeText.split(" ~")[0]} ${ev.title}`}
        </div>
      </div>

      <div className="relative w-[380px] rounded-2xl border bg-popover text-popover-foreground shadow-2xl">
        <span className="absolute -left-[7px] top-9 hidden size-3 rotate-45 border-b border-l bg-popover sm:block" />

        <div className="flex items-center justify-end gap-0.5 px-2 pt-2">
          {d.canEdit && (
            <IconBtn label="편집" onClick={() => d.edit()} testid={`${T}-edit-button`}>
              <Pencil className="size-4" />
            </IconBtn>
          )}
          <IconBtn label="복제" onClick={d.duplicate} testid={`${T}-duplicate-button`}>
            <Copy className="size-4" />
          </IconBtn>
          <IconBtn label=".ics 다운로드" onClick={d.ics} testid={`${T}-ics-button`}>
            <Download className="size-4" />
          </IconBtn>
          {d.canDelete && (
            <IconBtn label="삭제" onClick={() => setConfirmDelete(true)} testid={`${T}-delete-button`} danger>
              <Trash2 className="size-4" />
            </IconBtn>
          )}
          <span className="mx-1 h-4 w-px bg-border" />
          <IconBtn label="닫기" onClick={d.close} testid={`${T}-close-button`}>
            <X className="size-4" />
          </IconBtn>
        </div>

        <div className="space-y-3 px-5 pb-4 pt-1">
          <div className="flex gap-3">
            <span className="mt-1.5 size-3.5 shrink-0 rounded" style={{ backgroundColor: cal.color }} />
            <div className="min-w-0">
              <h2 className="text-lg font-semibold leading-snug">{ev.title}</h2>
              <p className="mt-0.5 text-sm text-muted-foreground">{d.whenText}</p>
              {ev.repeat && (
                <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                  <Repeat className="size-3" />
                  {ev.repeat}
                </p>
              )}
            </div>
          </div>

          <div className="space-y-2 text-sm">
            {ev.location && (
              <Line icon={MapPin}>
                <span className="truncate">{ev.location}</span>
              </Line>
            )}
            {d.room && (
              <Line icon={DoorOpen}>
                {d.room.name}
                <span className="text-xs text-muted-foreground">{d.room.capacity}인</span>
              </Line>
            )}
            {ev.booking && (
              <Line icon={Ticket}>
                <span className="min-w-0 truncate">
                  {ev.booking.typeName}, {ev.booking.guestName}
                  <span className="ml-1 text-xs text-muted-foreground">{ev.booking.guestEmail}</span>
                </span>
              </Line>
            )}
            {d.attendees.length > 0 && (
              <div>
                <button
                  type="button"
                  onClick={() => setShowPeople((v) => !v)}
                  className="-mx-1.5 flex w-[calc(100%+0.75rem)] items-center gap-3 rounded-md px-1.5 py-1 text-left hover:bg-muted"
                  data-testid={`${T}-people-toggle`}
                >
                  <Users className="size-4 shrink-0 text-muted-foreground" />
                  <span className="flex -space-x-1.5">
                    {d.attendees.slice(0, 5).map((a) => (
                      <Avatar key={a.member.id} member={a.member} size={22} className="ring-2 ring-popover" />
                    ))}
                  </span>
                  <span className="min-w-0 truncate text-xs text-muted-foreground">
                    {d.attendees.length}명, {countsText(d.counts)}
                  </span>
                </button>
                {showPeople && (
                  <ul className="mt-1 space-y-1 pl-7" data-testid={`${T}-people-list`}>
                    {d.attendees.map((a) => (
                      <li key={a.member.id} className="flex items-center gap-2 text-sm">
                        <span className={cn("size-1.5 rounded-full", RSVP_DOT[a.rsvp])} />
                        <span className="truncate">{a.member.name}</span>
                        {a.organizer && <span className="text-[11px] text-muted-foreground">주최</span>}
                        <span className={cn("ml-auto text-xs", RSVP_TEXT[a.rsvp])}>{RSVP_LABEL[a.rsvp]}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
            {d.reminder && <Line icon={Bell}>{d.reminder}</Line>}
            <Line icon={CalendarDays}>
              {cal.name}
              {cal.source === "external_ics" && (
                <span className="truncate text-xs text-muted-foreground">{hostOf(cal.url)}</span>
              )}
            </Line>
            {ev.description && (
              <Line icon={AlignLeft} top>
                <button
                  type="button"
                  onClick={() => setMoreDesc((v) => !v)}
                  className={cn("text-left text-muted-foreground", !moreDesc && "line-clamp-2")}
                  data-testid={`${T}-description-toggle`}
                >
                  {ev.description}
                </button>
              </Line>
            )}
          </div>
        </div>

        <Footer d={d} confirmDelete={confirmDelete} onCancelDelete={() => setConfirmDelete(false)} />
      </div>
    </div>
  )
}

function Footer({ d, confirmDelete, onCancelDelete }: { d: Detail; confirmDelete: boolean; onCancelDelete: () => void }) {
  if (confirmDelete) {
    return (
      <div className="flex items-center gap-2 rounded-b-2xl border-t bg-rose-50 px-4 py-3 dark:bg-rose-950/40" data-testid={`${T}-delete-confirm`}>
        <span className="mr-auto text-sm font-medium text-rose-800 dark:text-rose-200">
          {d.recurring ? "반복 일정 삭제" : "삭제할까요?"}
        </span>
        <Button size="sm" variant="ghost" onClick={onCancelDelete} data-testid={`${T}-delete-cancel`}>
          취소
        </Button>
        {d.recurring ? (
          (["occurrence", "series"] as Scope[]).map((s) => (
            <Button key={s} size="sm" variant="destructive" onClick={() => d.remove(s)} data-testid={`${T}-delete-${s}`}>
              {SCOPE_LABEL[s]}
            </Button>
          ))
        ) : (
          <Button size="sm" variant="destructive" onClick={() => d.remove()} data-testid={`${T}-delete-ok`}>
            삭제
          </Button>
        )}
      </div>
    )
  }

  if (d.kind === "invitee") {
    return (
      <div className="flex items-center gap-2 rounded-b-2xl border-t bg-muted/40 px-4 py-2.5">
        <span className="mr-auto text-sm font-medium">참석</span>
        {RSVP_CHOICES.map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => d.setRsvp(r)}
            className={cn(
              "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
              d.myRsvp === r ? RSVP_ACTIVE[r] : "border-input bg-background hover:bg-muted",
            )}
            data-testid={`${T}-rsvp-${r}`}
          >
            {RSVP_LABEL[r]}
          </button>
        ))}
      </div>
    )
  }

  if (d.kind === "readonly") {
    return (
      <div className="flex items-center gap-2 rounded-b-2xl border-t bg-muted/40 px-5 py-2.5 text-xs text-muted-foreground">
        <Lock className="size-3.5" />
        구독 캘린더, 읽기 전용
      </div>
    )
  }

  if (d.kind === "booking") {
    return (
      <div className="flex items-center gap-2 rounded-b-2xl border-t bg-muted/40 px-4 py-2.5">
        <span className="mr-auto flex items-center gap-1.5 text-xs text-muted-foreground">
          <Lock className="size-3.5" />
          예약 일정
        </span>
        <Button size="sm" variant="outline" onClick={d.openBooking} data-testid={`${T}-booking-button`}>
          예약 관리
        </Button>
      </div>
    )
  }

  return null
}

function IconBtn({
  label,
  onClick,
  testid,
  danger,
  children,
}: {
  label: string
  onClick: () => void
  testid: string
  danger?: boolean
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className={cn(
        "rounded-full p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
        danger && "hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/50 dark:hover:text-rose-400",
      )}
      data-testid={testid}
    >
      {children}
    </button>
  )
}

function Line({ icon: Icon, children, top }: { icon: typeof MapPin; children: React.ReactNode; top?: boolean }) {
  return (
    <div className={cn("flex gap-3", top ? "items-start" : "items-center")}>
      <Icon className={cn("size-4 shrink-0 text-muted-foreground", top && "mt-0.5")} />
      <div className="flex min-w-0 flex-1 items-center gap-2">{children}</div>
    </div>
  )
}
