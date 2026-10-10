"use client"

// 안 A: 날짜별 타임라인 + 자연스러운 문장 (ashfield-drive 활동 내역을 일정 도메인에 맞춤).
// 줄을 누르면 펼쳐져 대상 일정의 요약과 바로가기 버튼이 나온다.

import { useMemo, useState } from "react"
import { Activity as ActivityIcon, ArrowRight, ArrowUpRight, CalendarDays, DoorOpen, MapPin } from "lucide-react"

import { useToast } from "@/components/ui-custom/use-toast"
import { cn } from "@/lib/utils"

import { EVENTS, calendarOf, formatDay, formatTime, roomOf } from "../_mock"
import {
  ACTIVITIES,
  DAY_BUCKETS,
  KIND_META,
  SCOPES,
  Avatar,
  Segmented,
  TargetChip,
  activityKind,
  activitySentence,
  actorOf,
  clock,
  dayBucket,
  inScope,
  targetOf,
  whenText,
  type MockActivity,
  type Scope,
} from "./shared"

export function VariantA() {
  const [scope, setScope] = useState<Scope>("all")
  const [open, setOpen] = useState<string | null>("a7")

  const groups = useMemo(() => {
    const list = ACTIVITIES.filter((a) => inScope(a, scope))
    return DAY_BUCKETS.map((b) => ({ label: b, items: list.filter((a) => dayBucket(a.created_at) === b) })).filter(
      (g) => g.items.length > 0,
    )
  }, [scope])

  return (
    <div className="mx-auto max-w-3xl space-y-8" data-testid="pg-activity-page-a">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <ActivityIcon className="size-5 text-muted-foreground" />
          <h1 className="text-2xl font-bold">활동 내역</h1>
        </div>
        <Segmented value={scope} options={SCOPES} onChange={setScope} testid="pg-activity-page-a-scope" />
      </header>

      {groups.length === 0 ? (
        <div className="rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">활동 없음</div>
      ) : (
        <div className="space-y-10">
          {groups.map((g) => (
            <section key={g.label}>
              <div className="mb-3 flex items-baseline gap-2">
                <h2 className="text-sm font-semibold">{g.label}</h2>
                <span className="text-xs tabular-nums text-muted-foreground">{g.items.length}</span>
              </div>
              <ol>
                {g.items.map((a, i) => (
                  <Row
                    key={a.id}
                    it={a}
                    last={i === g.items.length - 1}
                    showClock={g.label === "오늘" || g.label === "어제"}
                    open={open === a.id}
                    onToggle={() => setOpen(open === a.id ? null : a.id)}
                  />
                ))}
              </ol>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}

function Row({
  it,
  last,
  showClock,
  open,
  onToggle,
}: {
  it: MockActivity
  last: boolean
  showClock: boolean
  open: boolean
  onToggle: () => void
}) {
  const meta = KIND_META[activityKind(it)]
  const Icon = meta.icon
  const actor = actorOf(it)

  return (
    <li className="relative flex gap-4 pb-1">
      {!last && <span className="absolute top-11 bottom-0 left-[17px] w-px bg-border" />}
      <div className="relative mt-1.5 shrink-0 self-start">
        <Avatar actor={actor} size={36} />
        <span
          className={cn(
            "absolute -right-1.5 -bottom-1.5 inline-flex size-5 items-center justify-center rounded-full ring-2 ring-background",
            meta.tone,
          )}
        >
          <Icon className="size-2.5" />
        </span>
      </div>
      <div className={cn("-mx-2 mb-2 min-w-0 flex-1 rounded-lg px-2 py-2 transition-colors hover:bg-muted/50", open && "bg-muted/60 hover:bg-muted/60")}>
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          data-testid={`pg-activity-page-a-row-${it.id}`}
          className="flex w-full items-start gap-3 text-left"
        >
          <p className="min-w-0 flex-1 text-sm leading-6 text-muted-foreground">
            {activitySentence(it, {
              actor: (a) => <span className="font-medium text-foreground">{a.name}</span>,
              em: (s) => <span className="font-medium text-foreground">{s}</span>,
              target: (t) => <TargetChip t={t} />,
            })}
          </p>
          <time dateTime={it.created_at} className="shrink-0 pt-0.5 text-xs tabular-nums text-muted-foreground">
            {showClock ? clock(it.created_at) : formatDay(it.created_at)}
          </time>
        </button>
        {open && <Detail it={it} />}
      </div>
    </li>
  )
}

function Detail({ it }: { it: MockActivity }) {
  const { toast } = useToast()
  const t = targetOf(it)
  const kind = activityKind(it)
  const ev = t.eventId ? EVENTS.find((e) => e.id === t.eventId) : undefined
  const room = roomOf(ev?.roomId)

  const btnPrimary =
    "inline-flex items-center gap-1 rounded-md bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground hover:bg-primary/90"
  const btnSecondary = "inline-flex items-center rounded-md border bg-background px-2.5 py-1 text-xs text-muted-foreground hover:text-foreground"

  return (
    <div className="mt-3 space-y-3">
      {kind === "reschedule" && typeof it.meta.old_start === "string" && typeof it.meta.new_start === "string" && (
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="text-muted-foreground line-through">{whenText(it.meta.old_start)}</span>
          <ArrowRight className="size-3 text-muted-foreground" />
          <span className="font-medium">{whenText(it.meta.new_start)}</span>
        </div>
      )}

      {ev && (
        <div className="flex gap-3 rounded-lg border bg-card p-3">
          <span className="w-1 shrink-0 rounded-full" style={{ background: calendarOf(ev.calendarId).color }} />
          <div className="min-w-0 space-y-1 text-xs text-muted-foreground">
            <p className="text-sm font-medium text-foreground">{ev.title}</p>
            <p className="flex items-center gap-1.5">
              <CalendarDays className="size-3" />
              {ev.allDay ? `${formatDay(ev.start)} 종일` : `${formatDay(ev.start)} ${formatTime(ev.start)} ~ ${formatTime(ev.end)}`}
            </p>
            {room && (
              <p className="flex items-center gap-1.5">
                <DoorOpen className="size-3" />
                {room.name}
              </p>
            )}
            {ev.location && (
              <p className="flex items-center gap-1.5">
                <MapPin className="size-3" />
                {ev.location}
              </p>
            )}
          </div>
        </div>
      )}

      <div className="flex items-center gap-2">
        {ev ? (
          <>
            <button type="button" className={btnPrimary} onClick={() => toast.info(`${ev.title} 열기`)} data-testid={`pg-activity-page-a-row-${it.id}-open`}>
              일정 열기
              <ArrowUpRight className="size-3" />
            </button>
            <button type="button" className={btnSecondary} onClick={() => toast.info(`${formatDay(ev.start)}로 이동`)} data-testid={`pg-activity-page-a-row-${it.id}-locate`}>
              달력에서 보기
            </button>
          </>
        ) : it.entity_type === "event" ? (
          <span className="text-xs text-muted-foreground">삭제된 일정</span>
        ) : it.entity_type === "booking" ? (
          <span className="text-xs text-muted-foreground">취소된 예약</span>
        ) : (
          <button type="button" className={btnSecondary} onClick={() => toast.info(`${t.typeLabel} 설정 열기`)} data-testid={`pg-activity-page-a-row-${it.id}-settings`}>
            {t.typeLabel} 설정
          </button>
        )}
      </div>
    </div>
  )
}
