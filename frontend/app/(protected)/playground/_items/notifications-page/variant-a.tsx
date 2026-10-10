"use client"

// 안 A: 받은편지함. 왼쪽 목록에서 고르면 오른쪽에 일정 요약과 할 일(응답, 바뀐 내용, 손님 정보)이 펼쳐진다.
// 종 팝오버는 원본처럼 짧은 목록, 종류 아이콘과 날짜 묶음만 더했다.

import { useState } from "react"
import { ArrowRight, ArrowUpRight, Bell, CalendarDays, Mail, MailOpen, MapPin, User } from "lucide-react"

import { cn } from "@/lib/utils"

import { calendarOf } from "../_mock"
import { Segmented } from "../activity-page/shared"
import {
  BellStage,
  DAY_BUCKETS,
  RSVP_LABEL,
  RsvpButtons,
  TypeIcon,
  WithBell,
  actorMember,
  dayBucket,
  isPast,
  needsResponse,
  notifDetail,
  notifSentence,
  relTime,
  useNotifs,
  whenOf,
  type MockNotification,
  type NotifState,
} from "./shared"

type Filter = "all" | "unread" | "respond"

export function VariantA() {
  const state = useNotifs()
  const [bellOpen, setBellOpen] = useState(true)
  return (
    <WithBell
      page={<Page state={state} />}
      bell={
        <BellStage state={state} open={bellOpen} onToggle={() => setBellOpen((v) => !v)} slug="a">
          <Popover state={state} onClose={() => setBellOpen(false)} />
        </BellStage>
      }
    />
  )
}

function Page({ state }: { state: NotifState }) {
  const [filter, setFilter] = useState<Filter>("all")
  const [selected, setSelected] = useState<string | null>("n3")

  const list = state.items.filter((n) => (filter === "unread" ? !n.read : filter === "respond" ? needsResponse(n) : true))
  const current = state.items.find((n) => n.id === selected) ?? null

  function pick(n: MockNotification) {
    setSelected(n.id)
    if (!n.read) state.markRead(n.id)
  }

  return (
    <div className="space-y-4" data-testid="pg-notifications-page-a">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">알림</h1>
        <div className="flex items-center gap-3">
          <Segmented
            value={filter}
            onChange={setFilter}
            testid="pg-notifications-page-a-filter"
            options={[
              { key: "all", label: "전체" },
              { key: "unread", label: `안 읽음 ${state.unread}` },
              { key: "respond", label: `응답 필요 ${state.pending}` },
            ]}
          />
          <button
            type="button"
            onClick={state.markAll}
            disabled={state.unread === 0}
            className="text-sm text-muted-foreground hover:text-foreground disabled:opacity-40"
            data-testid="pg-notifications-page-a-mark-all"
          >
            모두 읽음
          </button>
        </div>
      </header>

      <div className="flex min-h-[560px] overflow-x-auto rounded-xl border bg-card">
        <ul className="w-[360px] shrink-0 overflow-y-auto border-r">
          {list.length === 0 && <li className="p-8 text-center text-sm text-muted-foreground">알림 없음</li>}
          {list.map((n) => (
            <li key={n.id}>
              <button
                type="button"
                onClick={() => pick(n)}
                data-testid={`pg-notifications-page-a-row-${n.id}`}
                className={cn(
                  "flex w-full items-start gap-3 border-b border-border/60 px-4 py-3 text-left transition-colors",
                  selected === n.id ? "bg-muted" : "hover:bg-muted/50",
                )}
              >
                <TypeIcon n={n} className="mt-0.5" />
                <div className="min-w-0 flex-1">
                  <p className={cn("line-clamp-2 text-sm break-keep", n.read ? "text-muted-foreground" : "font-semibold text-foreground")}>
                    {notifSentence(n)}
                  </p>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">{notifDetail(n)}</p>
                  {needsResponse(n) && (
                    <span className="mt-1.5 inline-block rounded bg-violet-100 px-1.5 py-0.5 text-[11px] font-medium text-violet-700 dark:bg-violet-950 dark:text-violet-300">
                      응답 필요
                    </span>
                  )}
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1.5">
                  <span className="text-[11px] text-muted-foreground">{relTime(n.at)}</span>
                  {!n.read && <span className="size-2 rounded-full bg-blue-500" aria-label="안 읽음" />}
                </div>
              </button>
            </li>
          ))}
        </ul>

        <section className="min-w-[420px] flex-1">
          {current ? <Detail n={current} state={state} /> : <div className="grid h-full place-items-center text-sm text-muted-foreground">선택한 알림 없음</div>}
        </section>
      </div>
    </div>
  )
}

function Detail({ n, state }: { n: MockNotification; state: NotifState }) {
  const actor = actorMember(n)
  const cal = n.calendarId ? calendarOf(n.calendarId) : null
  const past = isPast(n)

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-start gap-3">
        <TypeIcon n={n} className="size-10 [&_svg]:size-5" />
        <div className="min-w-0 flex-1">
          <p className="text-base font-semibold">{notifSentence(n)}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">{relTime(n.at)}</p>
        </div>
        <button
          type="button"
          onClick={() => (n.read ? state.markUnread(n.id) : state.markRead(n.id))}
          className="inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs text-muted-foreground hover:text-foreground"
          data-testid="pg-notifications-page-a-detail-toggle-read"
        >
          {n.read ? <Mail className="size-3.5" /> : <MailOpen className="size-3.5" />}
          {n.read ? "안 읽음으로" : "읽음으로"}
        </button>
      </div>

      <div className="flex gap-4 rounded-xl border p-4">
        <span className="w-1 shrink-0 rounded-full" style={{ background: cal?.color }} />
        <div className="min-w-0 space-y-2 text-sm">
          <p className={cn("text-lg font-semibold", past && "text-muted-foreground line-through")}>{n.title}</p>
          <p className="flex items-center gap-2 text-muted-foreground">
            <CalendarDays className="size-4" />
            <span className={cn(past && "line-through")}>{whenOf(n)}</span>
          </p>
          {n.location && (
            <p className="flex items-center gap-2 text-muted-foreground">
              <MapPin className="size-4" />
              {n.location}
            </p>
          )}
          {cal && (
            <p className="flex items-center gap-2 text-muted-foreground">
              <span className="ml-1 size-2 rounded-full" style={{ background: cal.color }} />
              <span className="ml-1">{cal.name}</span>
            </p>
          )}
          {n.customer && (
            <p className="flex items-center gap-2 text-muted-foreground">
              <User className="size-4" />
              {n.customer}, {n.customerEmail}
            </p>
          )}
          {actor && (
            <p className="flex items-center gap-2 text-muted-foreground">
              <span className="inline-flex size-4 items-center justify-center rounded-full text-[9px] font-medium text-white" style={{ background: actor.color }}>
                {actor.name.slice(0, 1)}
              </span>
              {actor.name}
            </p>
          )}
        </div>
      </div>

      {n.type === "event_invited" && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">내 응답: {RSVP_LABEL[n.myRsvp ?? "pending"]}</p>
          <RsvpButtons n={n} onRespond={(r) => state.respond(n.id, r)} testid="pg-notifications-page-a-detail-rsvp" />
        </div>
      )}

      {n.changes && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">바뀐 내용</p>
          <ul className="divide-y rounded-lg border text-sm">
            {n.changes.map((c) => (
              <li key={c.label} className="flex items-center gap-3 px-3 py-2">
                <span className="w-14 shrink-0 text-xs text-muted-foreground">{c.label}</span>
                <span className="text-muted-foreground line-through">{c.from}</span>
                <ArrowRight className="size-3.5 text-muted-foreground" />
                <span className="font-medium">{c.to}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {n.type === "booking_rescheduled" && n.oldStart && (
        <div className="flex items-center gap-3 rounded-lg border px-3 py-2 text-sm">
          <span className="text-muted-foreground line-through">{whenOf({ start: n.oldStart })}</span>
          <ArrowRight className="size-3.5 text-muted-foreground" />
          <span className="font-medium">{whenOf({ start: n.start })}</span>
        </div>
      )}

      {!past && (
        <button
          type="button"
          onClick={() => state.open(n)}
          className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          data-testid="pg-notifications-page-a-detail-open"
        >
          {n.type.startsWith("booking") ? "예약 양식 보기" : "일정 열기"}
          <ArrowUpRight className="size-3.5" />
        </button>
      )}
    </div>
  )
}

function Popover({ state, onClose }: { state: NotifState; onClose: () => void }) {
  const items = state.items.slice(0, 8)
  const groups = DAY_BUCKETS.map((b) => ({ label: b, items: items.filter((n) => dayBucket(n.at) === b) })).filter((g) => g.items.length > 0)

  return (
    <div className="w-80 overflow-hidden rounded-xl border bg-card shadow-lg" data-testid="pg-notifications-page-a-popover">
      <div className="flex items-center justify-between border-b px-3 py-2">
        <h3 className="text-sm font-semibold">알림</h3>
        {state.unread > 0 && (
          <button type="button" onClick={state.markAll} className="text-xs text-muted-foreground hover:text-foreground" data-testid="pg-notifications-page-a-popover-mark-all">
            모두 읽음
          </button>
        )}
      </div>
      <div className="max-h-96 overflow-y-auto">
        {groups.length === 0 ? (
          <div className="flex flex-col items-center gap-2 p-8 text-sm text-muted-foreground">
            <Bell className="size-5" />
            알림 없음
          </div>
        ) : (
          groups.map((g) => (
            <div key={g.label}>
              <p className="bg-muted/40 px-3 py-1 text-[11px] font-medium text-muted-foreground">{g.label}</p>
              <ul className="divide-y divide-border/60">
                {g.items.map((n) => (
                  <li key={n.id}>
                    <button
                      type="button"
                      onClick={() => {
                        state.open(n)
                        onClose()
                      }}
                      data-testid={`pg-notifications-page-a-popover-row-${n.id}`}
                      className="flex w-full items-start gap-2.5 px-3 py-2 text-left hover:bg-muted/50"
                    >
                      <TypeIcon n={n} className="size-6 [&_svg]:size-3" />
                      <div className="min-w-0 flex-1">
                        <p className={cn("truncate text-sm", n.read ? "text-muted-foreground" : "font-medium text-foreground")}>{notifSentence(n)}</p>
                        <p className="truncate text-xs text-muted-foreground">{notifDetail(n)}</p>
                      </div>
                      {!n.read && <span className="mt-1.5 size-2 shrink-0 rounded-full bg-blue-500" />}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))
        )}
      </div>
      <button
        type="button"
        onClick={onClose}
        className="block w-full border-t px-3 py-2 text-center text-xs font-medium text-muted-foreground hover:bg-muted/50 hover:text-foreground"
        data-testid="pg-notifications-page-a-popover-see-all"
      >
        전체 보기
      </button>
    </div>
  )
}
