"use client"

// 안 B: 넓은 상세 모달. 왼쪽 일정 정보, 오른쪽 참석자 응답 현황 그룹, 아래 고정 행동 바.

import { useState } from "react"
import {
  AlertTriangle,
  AlignLeft,
  Bell,
  Copy,
  DoorOpen,
  Download,
  Link2,
  Lock,
  MapPin,
  Repeat,
  Ticket,
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
  RSVP_ORDER,
  RSVP_TEXT,
  SCOPE_LABEL,
  ScenarioFrame,
  hostOf,
  type Detail,
  type Scope,
} from "./shared"

const T = "pg-event-detail-b"

export function VariantB() {
  return <ScenarioFrame View={Modal} prefix="b" />
}

function Modal({ d }: { d: Detail }) {
  const [deleting, setDeleting] = useState(false)
  const { ev, cal } = d

  return (
    <div className="relative w-full max-w-[780px] overflow-hidden rounded-2xl border bg-background shadow-2xl">
      {/* 머리 */}
      <div className="relative px-7 pb-5 pt-6" style={{ backgroundColor: `${cal.color}14` }}>
        <span className="absolute inset-x-0 top-0 h-1" style={{ backgroundColor: cal.color }} />
        <div className="absolute right-3 top-3 flex gap-0.5">
          <Button variant="ghost" size="icon-sm" onClick={d.duplicate} title="복제" data-testid={`${T}-duplicate-button`}>
            <Copy />
          </Button>
          <Button variant="ghost" size="icon-sm" onClick={d.ics} title=".ics 다운로드" data-testid={`${T}-ics-button`}>
            <Download />
          </Button>
          <Button variant="ghost" size="icon-sm" onClick={d.close} title="닫기" data-testid={`${T}-close-button`}>
            <X />
          </Button>
        </div>
        <div className="flex items-center gap-2 text-xs font-medium">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-background/80 px-2.5 py-1">
            <span className="size-2 rounded-full" style={{ backgroundColor: cal.color }} />
            {cal.name}
          </span>
          {ev.repeat && (
            <span className="inline-flex items-center gap-1 rounded-full bg-background/80 px-2.5 py-1 text-muted-foreground">
              <Repeat className="size-3" />
              {ev.repeat}
            </span>
          )}
          {d.kind === "readonly" && (
            <span className="inline-flex items-center gap-1 rounded-full bg-background/80 px-2.5 py-1 text-muted-foreground">
              <Lock className="size-3" />
              읽기 전용
            </span>
          )}
          {d.kind === "booking" && (
            <span className="inline-flex items-center gap-1 rounded-full bg-violet-100 px-2.5 py-1 text-violet-700 dark:bg-violet-950/60 dark:text-violet-300">
              <Ticket className="size-3" />
              예약
            </span>
          )}
        </div>
        <h2 className="mt-3 pr-28 text-2xl font-semibold tracking-tight">{ev.title}</h2>
        <p className="mt-1.5 text-[15px]">
          <span className="font-medium">{d.dayText}</span>
          <span className="text-muted-foreground">
            {", "}
            {d.timeText}
            {!ev.allDay && ` (${d.duration})`}
          </span>
        </p>
      </div>

      {/* 몸통 */}
      <div className="grid gap-0 sm:grid-cols-[1fr_280px]">
        <div className="space-y-5 px-7 py-6">
          {(ev.location || d.room) && (
            <Section label="장소">
              {ev.location && (
                <Item icon={MapPin}>{ev.location}</Item>
              )}
              {d.room && (
                <Item icon={DoorOpen}>
                  {d.room.name}
                  <span className="text-muted-foreground">, {d.room.capacity}인</span>
                </Item>
              )}
            </Section>
          )}
          {ev.description && (
            <Section label="설명">
              <Item icon={AlignLeft}>
                <span className="whitespace-pre-wrap leading-relaxed">{ev.description}</span>
              </Item>
            </Section>
          )}
          {d.reminder && (
            <Section label="알림">
              <Item icon={Bell}>{d.reminder}</Item>
            </Section>
          )}
          {d.kind === "readonly" && (
            <Section label="구독">
              <Item icon={Link2}>
                <span className="truncate">{hostOf(cal.url)}</span>
              </Item>
            </Section>
          )}
          {!ev.location && !d.room && !ev.description && !d.reminder && d.kind !== "readonly" && (
            <p className="text-sm text-muted-foreground">추가 정보 없음</p>
          )}
        </div>

        <aside className="border-t bg-muted/30 px-6 py-6 sm:border-l sm:border-t-0">
          {d.kind === "booking" && ev.booking ? (
            <BookingSide d={d} />
          ) : d.attendees.length > 0 ? (
            <People d={d} />
          ) : (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground">주최</p>
              <div className="flex items-center gap-2.5 text-sm">
                <Avatar member={d.organizer} size={28} />
                {d.organizer.name}
              </div>
            </div>
          )}
        </aside>
      </div>

      {/* 행동 바 */}
      <div className="flex flex-wrap items-center gap-2 border-t px-5 py-3">
        {d.canDelete && (
          <Button
            variant="ghost"
            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
            onClick={() => setDeleting(true)}
            data-testid={`${T}-delete-button`}
          >
            삭제
          </Button>
        )}
        <div className="ml-auto flex flex-wrap items-center gap-2">
          {d.kind === "invitee" && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">참석 여부</span>
              <div className="inline-flex rounded-lg border p-0.5">
                {RSVP_CHOICES.map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => d.setRsvp(r)}
                    className={cn(
                      "rounded-md border border-transparent px-3 py-1 text-sm font-medium transition-colors",
                      d.myRsvp === r ? RSVP_ACTIVE[r] : "text-muted-foreground hover:bg-muted hover:text-foreground",
                    )}
                    data-testid={`${T}-rsvp-${r}`}
                  >
                    {RSVP_LABEL[r]}
                  </button>
                ))}
              </div>
            </div>
          )}
          {d.kind === "booking" && (
            <Button variant="outline" onClick={d.openBooking} data-testid={`${T}-booking-button`}>
              예약 관리
            </Button>
          )}
          {d.kind === "readonly" && (
            <Button variant="outline" onClick={d.duplicate} data-testid={`${T}-copy-mine-button`}>
              내 캘린더로 복제
            </Button>
          )}
          {d.canEdit && (
            <Button onClick={() => d.edit()} data-testid={`${T}-edit-button`}>
              편집
            </Button>
          )}
        </div>
      </div>

      {deleting && <DeleteLayer d={d} onCancel={() => setDeleting(false)} />}
    </div>
  )
}

function People({ d }: { d: Detail }) {
  const total = d.attendees.length
  return (
    <div className="space-y-4" data-testid={`${T}-people`}>
      <div>
        <div className="flex items-baseline justify-between">
          <p className="text-xs font-semibold text-muted-foreground">참석자</p>
          <span className="text-xs text-muted-foreground">{total}명</span>
        </div>
        <div className="mt-2 flex h-1.5 overflow-hidden rounded-full bg-muted">
          {RSVP_ORDER.map((r) =>
            d.counts[r] > 0 ? (
              <span key={r} className={RSVP_DOT[r]} style={{ width: `${(d.counts[r] / total) * 100}%` }} />
            ) : null,
          )}
        </div>
      </div>

      {d.conflicts.length > 0 && (
        <div className="flex items-start gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-2 text-xs text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200">
          <AlertTriangle className="mt-px size-3.5 shrink-0" />
          겹치는 일정: {d.conflicts.join(", ")}
        </div>
      )}

      {RSVP_ORDER.filter((r) => d.counts[r] > 0).map((r) => (
        <div key={r} className="space-y-1.5">
          <p className={cn("flex items-center gap-1.5 text-xs font-medium", RSVP_TEXT[r])}>
            <span className={cn("size-1.5 rounded-full", RSVP_DOT[r])} />
            {RSVP_LABEL[r]} {d.counts[r]}
          </p>
          <ul className="space-y-1">
            {d.attendees
              .filter((a) => a.rsvp === r)
              .map((a) => (
                <li key={a.member.id} className={cn("flex items-center gap-2 text-sm", r === "declined" && "opacity-60")}>
                  <Avatar member={a.member} size={24} />
                  <span className="truncate">{a.member.name}</span>
                  {a.me && <span className="text-[11px] text-muted-foreground">나</span>}
                  {a.organizer && (
                    <span className="ml-auto rounded bg-background px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground ring-1 ring-border">
                      주최
                    </span>
                  )}
                </li>
              ))}
          </ul>
        </div>
      ))}
    </div>
  )
}

function BookingSide({ d }: { d: Detail }) {
  const b = d.ev.booking!
  return (
    <div className="space-y-3">
      <p className="text-xs font-semibold text-muted-foreground">예약자</p>
      <div className="rounded-xl border bg-background p-3.5">
        <p className="font-medium">{b.guestName}</p>
        <p className="truncate text-xs text-muted-foreground">{b.guestEmail}</p>
        <div className="mt-3 flex items-center gap-1.5 border-t pt-3 text-xs text-muted-foreground">
          <Ticket className="size-3.5" />
          {b.typeName}
        </div>
      </div>
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Lock className="size-3" />
        예약에서 변경, 취소
      </p>
    </div>
  )
}

function DeleteLayer({ d, onCancel }: { d: Detail; onCancel: () => void }) {
  const [scope, setScope] = useState<Scope>("occurrence")
  return (
    <div className="absolute inset-0 grid place-items-center bg-background/70 backdrop-blur-sm" data-testid={`${T}-delete-layer`}>
      <div className="w-80 space-y-4 rounded-xl border bg-card p-5 shadow-xl">
        <h3 className="font-semibold">{d.recurring ? "반복 일정 삭제" : "일정 삭제"}</h3>
        {d.recurring ? (
          <div className="space-y-2" role="radiogroup">
            {(["occurrence", "series"] as Scope[]).map((s) => (
              <button
                key={s}
                type="button"
                role="radio"
                aria-checked={scope === s}
                onClick={() => setScope(s)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors",
                  scope === s ? "border-primary bg-primary/5" : "hover:bg-muted",
                )}
                data-testid={`${T}-scope-${s}`}
              >
                <span className={cn("grid size-4 place-items-center rounded-full border", scope === s && "border-primary")}>
                  {scope === s && <span className="size-2 rounded-full bg-primary" />}
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-medium">{SCOPE_LABEL[s]}</span>
                  <span className="block text-xs text-muted-foreground">
                    {s === "occurrence" ? d.dayText : d.ev.repeat}
                  </span>
                </span>
              </button>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">{d.ev.title}</p>
        )}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onCancel} data-testid={`${T}-delete-cancel`}>
            취소
          </Button>
          <Button
            variant="destructive"
            onClick={() => d.remove(d.recurring ? scope : undefined)}
            data-testid={`${T}-delete-ok`}
          >
            삭제
          </Button>
        </div>
      </div>
    </div>
  )
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <p className="text-xs font-semibold text-muted-foreground">{label}</p>
      {children}
    </div>
  )
}

function Item({ icon: Icon, children }: { icon: typeof MapPin; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2.5 text-sm">
      <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  )
}
