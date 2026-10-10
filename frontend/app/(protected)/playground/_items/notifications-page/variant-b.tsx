"use client"

// 안 B: 카드형 + 바로 응답. 응답할 초대는 맨 위에 따로 모으고, 카드마다 종류에 맞는 버튼이 바로 붙는다.
// 팝오버도 같은 카드를 작게 써서 초대에 거기서 바로 답한다.

import { useState } from "react"
import { ArrowRight, Check, MapPin } from "lucide-react"

import { cn } from "@/lib/utils"

import { Segmented } from "../activity-page/shared"
import {
  BellStage,
  DAY_BUCKETS,
  RSVP_LABEL,
  RsvpButtons,
  TypeIcon,
  WithBell,
  actorMember,
  calColor,
  dayBucket,
  isPast,
  needsResponse,
  notifSentence,
  relTime,
  useNotifs,
  whenOf,
  type MockNotification,
  type NotifState,
} from "./shared"

type Filter = "all" | "unread" | "booking"

export function VariantB() {
  const state = useNotifs()
  const [bellOpen, setBellOpen] = useState(true)
  return (
    <WithBell
      page={<Page state={state} />}
      bell={
        <BellStage state={state} open={bellOpen} onToggle={() => setBellOpen((v) => !v)} slug="b">
          <Popover state={state} />
        </BellStage>
      }
    />
  )
}

function Page({ state }: { state: NotifState }) {
  const [filter, setFilter] = useState<Filter>("all")
  const pending = state.items.filter(needsResponse)
  const rest = state.items.filter(
    (n) => !needsResponse(n) && (filter === "unread" ? !n.read : filter === "booking" ? n.type.startsWith("booking") : true),
  )
  const groups = DAY_BUCKETS.map((b) => ({ label: b, items: rest.filter((n) => dayBucket(n.at) === b) })).filter((g) => g.items.length > 0)

  return (
    <div className="mx-auto max-w-2xl space-y-8" data-testid="pg-notifications-page-b">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">알림</h1>
        <button
          type="button"
          onClick={state.markAll}
          disabled={state.unread === 0}
          className="inline-flex items-center gap-1.5 rounded-md border bg-card px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground disabled:opacity-40"
          data-testid="pg-notifications-page-b-mark-all"
        >
          <Check className="size-4" />
          모두 읽음
        </button>
      </header>

      {pending.length > 0 && (
        <section className="space-y-3">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            응답 필요
            <span className="rounded-full bg-violet-100 px-2 py-0.5 text-xs text-violet-700 dark:bg-violet-950 dark:text-violet-300">{pending.length}</span>
          </h2>
          {pending.map((n) => (
            <InviteCard key={n.id} n={n} state={state} />
          ))}
        </section>
      )}

      <section className="space-y-6">
        <Segmented
          value={filter}
          onChange={setFilter}
          testid="pg-notifications-page-b-filter"
          options={[
            { key: "all", label: "전체" },
            { key: "unread", label: "안 읽음" },
            { key: "booking", label: "예약" },
          ]}
        />
        {groups.length === 0 && <div className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">알림 없음</div>}
        {groups.map((g) => (
          <div key={g.label} className="space-y-2.5">
            <h3 className="text-xs font-medium text-muted-foreground">{g.label}</h3>
            {g.items.map((n) => (
              <Card key={n.id} n={n} state={state} />
            ))}
          </div>
        ))}
      </section>
    </div>
  )
}

function InviteCard({ n, state }: { n: MockNotification; state: NotifState }) {
  return (
    <article
      className="overflow-hidden rounded-xl border border-violet-200 bg-card shadow-sm dark:border-violet-900/60"
      data-testid={`pg-notifications-page-b-invite-${n.id}`}
    >
      <div className="flex gap-4 p-4">
        <div className="flex w-14 shrink-0 flex-col items-center rounded-lg border bg-background py-1.5">
          <span className="text-[11px] text-muted-foreground">{n.start ? `${new Date(n.start).getMonth() + 1}월` : ""}</span>
          <span className="text-xl leading-6 font-bold tabular-nums">{n.start ? new Date(n.start).getDate() : ""}</span>
        </div>
        <div className="min-w-0 flex-1 space-y-1">
          <p className="text-sm text-muted-foreground">{actorMember(n)?.name}님의 초대</p>
          <p className="text-base font-semibold">{n.title}</p>
          <p className="text-sm text-muted-foreground">
            {whenOf(n)}
            {n.location && `, ${n.location}`}
          </p>
        </div>
        {!n.read && <span className="mt-1 size-2 shrink-0 rounded-full bg-blue-500" />}
      </div>
      <div className="flex items-center justify-between gap-3 border-t bg-muted/30 px-4 py-2.5">
        <span className="text-xs text-muted-foreground">{relTime(n.at)}</span>
        <RsvpButtons n={n} onRespond={(r) => state.respond(n.id, r)} testid={`pg-notifications-page-b-invite-${n.id}-rsvp`} />
      </div>
    </article>
  )
}

function Card({ n, state }: { n: MockNotification; state: NotifState }) {
  const past = isPast(n)
  return (
    <article
      className={cn(
        "group relative flex gap-3 rounded-xl border bg-card p-4 transition-colors",
        !n.read && "border-blue-200 bg-blue-50/40 dark:border-blue-900/60 dark:bg-blue-950/20",
      )}
      data-testid={`pg-notifications-page-b-card-${n.id}`}
    >
      <TypeIcon n={n} className="size-9" />
      <div className="min-w-0 flex-1 space-y-2">
        <div className="flex items-start justify-between gap-3">
          <p className={cn("text-sm", n.read ? "text-muted-foreground" : "text-foreground")}>
            {notifSentence(n, (s) => <span className="font-semibold text-foreground">{s}</span>)}
          </p>
          <span className="shrink-0 text-xs text-muted-foreground">{relTime(n.at)}</span>
        </div>

        {n.changes ? (
          <div className="flex flex-wrap gap-1.5">
            {n.changes.map((c) => (
              <span key={c.label} className="inline-flex items-center gap-1.5 rounded-md border bg-background px-2 py-1 text-xs">
                <span className="text-muted-foreground">{c.label}</span>
                <span className="text-muted-foreground line-through">{c.from}</span>
                <ArrowRight className="size-3 text-muted-foreground" />
                <span className="font-medium">{c.to}</span>
              </span>
            ))}
          </div>
        ) : n.type === "booking_rescheduled" && n.oldStart ? (
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <span className="text-muted-foreground line-through">{whenOf({ start: n.oldStart })}</span>
            <ArrowRight className="size-3 text-muted-foreground" />
            <span className="font-medium">{whenOf({ start: n.start })}</span>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="size-2 rounded-full" style={{ background: calColor(n) }} />
            <span className={cn(past && "line-through")}>{whenOf(n)}</span>
            {n.location && (
              <>
                <MapPin className="size-3" />
                {n.location}
              </>
            )}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2 pt-0.5">
          {n.type === "event_invited" && (
            <>
              <span className="text-xs text-muted-foreground">내 응답</span>
              <RsvpButtons n={n} size="sm" onRespond={(r) => state.respond(n.id, r)} testid={`pg-notifications-page-b-card-${n.id}-rsvp`} />
            </>
          )}
          {n.type === "event_invitation_response" && n.response && (
            <span className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">{RSVP_LABEL[n.response]}</span>
          )}
          {!past && n.type !== "event_invited" && (
            <button
              type="button"
              onClick={() => state.open(n)}
              className="rounded-md border bg-background px-2.5 py-1 text-xs font-medium hover:bg-muted"
              data-testid={`pg-notifications-page-b-card-${n.id}-open`}
            >
              {n.type.startsWith("booking") ? "예약 보기" : "일정 열기"}
            </button>
          )}
          {!n.read && (
            <button
              type="button"
              onClick={() => state.markRead(n.id)}
              className="ml-auto text-xs text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 hover:text-foreground"
              data-testid={`pg-notifications-page-b-card-${n.id}-read`}
            >
              읽음
            </button>
          )}
        </div>
      </div>
    </article>
  )
}

function Popover({ state }: { state: NotifState }) {
  const items = [...state.items.filter(needsResponse), ...state.items.filter((n) => !needsResponse(n))].slice(0, 7)
  return (
    <div className="w-[360px] overflow-hidden rounded-xl border bg-card shadow-lg" data-testid="pg-notifications-page-b-popover">
      <div className="flex items-center justify-between px-4 pt-3 pb-2">
        <h3 className="text-sm font-semibold">알림</h3>
        <button
          type="button"
          onClick={state.markAll}
          disabled={state.unread === 0}
          className="text-xs text-muted-foreground hover:text-foreground disabled:opacity-40"
          data-testid="pg-notifications-page-b-popover-mark-all"
        >
          모두 읽음
        </button>
      </div>
      <div className="max-h-[420px] space-y-2 overflow-y-auto px-3 pb-3">
        {items.map((n) => (
          <div
            key={n.id}
            className={cn(
              "rounded-lg border p-2.5",
              needsResponse(n) ? "border-violet-200 dark:border-violet-900/60" : !n.read ? "bg-blue-50/40 dark:bg-blue-950/20" : "",
            )}
          >
            <button
              type="button"
              onClick={() => state.open(n)}
              className="flex w-full items-start gap-2.5 text-left"
              data-testid={`pg-notifications-page-b-popover-row-${n.id}`}
            >
              <TypeIcon n={n} className="size-7 [&_svg]:size-3.5" />
              <div className="min-w-0 flex-1">
                <p className={cn("text-[13px] leading-5", n.read ? "text-muted-foreground" : "text-foreground")}>
                  {notifSentence(n, (s) => <span className="font-semibold text-foreground">{s}</span>)}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {relTime(n.at)}
                  {n.start && `, ${whenOf({ start: n.start, allDay: n.allDay })}`}
                </p>
              </div>
            </button>
            {n.type === "event_invited" && (
              <div className="mt-2 pl-9">
                <RsvpButtons n={n} size="sm" onRespond={(r) => state.respond(n.id, r)} testid={`pg-notifications-page-b-popover-row-${n.id}-rsvp`} />
              </div>
            )}
          </div>
        ))}
      </div>
      <button
        type="button"
        className="block w-full border-t px-3 py-2 text-center text-xs font-medium text-muted-foreground hover:bg-muted/50 hover:text-foreground"
        data-testid="pg-notifications-page-b-popover-see-all"
      >
        전체 보기
      </button>
    </div>
  )
}
