"use client"

// 안 C: 종 팝오버 중심. 대부분 팝오버에서 끝나게 넓은 팝오버에 탭, 응답 대기 줄, 아이콘 응답 버튼을 넣었다.
// 페이지는 "할 일"(응답, 안 읽은 변경)과 "기록"(나머지 한 줄 목록) 두 칸.

import { useState } from "react"
import { Check, CircleHelp, Eye, EyeOff, X } from "lucide-react"

import { cn } from "@/lib/utils"

import type { MockRsvp } from "../_mock"
import {
  BellStage,
  DAY_BUCKETS,
  RSVP_LABEL,
  TYPE_META,
  TypeIcon,
  WithBell,
  dayBucket,
  needsResponse,
  notifDetail,
  notifSentence,
  relTime,
  useNotifs,
  type MockNotification,
  type NotifGroup,
  type NotifState,
} from "./shared"

export function VariantC() {
  const state = useNotifs()
  const [bellOpen, setBellOpen] = useState(true)
  return (
    <WithBell
      page={<Page state={state} />}
      bell={
        <BellStage state={state} open={bellOpen} onToggle={() => setBellOpen((v) => !v)} slug="c">
          <Popover state={state} />
        </BellStage>
      }
    />
  )
}

// ---------------------------------------------------------------------------
// 아이콘 응답 버튼

const RSVP_ICON: { r: Exclude<MockRsvp, "pending">; icon: typeof Check; on: string }[] = [
  { r: "accepted", icon: Check, on: "bg-emerald-600 text-white dark:bg-emerald-500 dark:text-emerald-950" },
  { r: "tentative", icon: CircleHelp, on: "bg-amber-500 text-white dark:bg-amber-400 dark:text-amber-950" },
  { r: "declined", icon: X, on: "bg-rose-600 text-white dark:bg-rose-500 dark:text-rose-950" },
]

function RsvpIcons({ n, state, testid }: { n: MockNotification; state: NotifState; testid: string }) {
  return (
    <div className="flex shrink-0 gap-1">
      {RSVP_ICON.map(({ r, icon: Icon, on }) => (
        <button
          key={r}
          type="button"
          title={RSVP_LABEL[r]}
          aria-label={RSVP_LABEL[r]}
          onClick={(e) => {
            e.stopPropagation()
            state.respond(n.id, r)
          }}
          data-testid={`${testid}-${r}`}
          className={cn(
            "inline-flex size-7 items-center justify-center rounded-full border transition-colors",
            n.myRsvp === r ? cn("border-transparent", on) : "bg-background text-muted-foreground hover:bg-muted hover:text-foreground",
          )}
        >
          <Icon className="size-3.5" />
        </button>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// 팝오버

type Tab = "all" | NotifGroup

const TABS: { key: Tab; label: string }[] = [
  { key: "all", label: "전체" },
  { key: "invite", label: "초대" },
  { key: "change", label: "변경" },
  { key: "booking", label: "예약" },
  { key: "reminder", label: "리마인더" },
]

function Popover({ state }: { state: NotifState }) {
  const [tab, setTab] = useState<Tab>("all")
  const inTab = (n: MockNotification) => tab === "all" || TYPE_META[n.type].group === tab
  const pending = state.items.filter((n) => needsResponse(n) && inTab(n))
  const rest = state.items.filter((n) => !needsResponse(n) && inTab(n)).slice(0, 8)
  const count = (k: Tab) => state.items.filter((n) => !n.read && (k === "all" || TYPE_META[n.type].group === k)).length

  return (
    <div className="w-[440px] overflow-hidden rounded-2xl border bg-card shadow-xl" data-testid="pg-notifications-page-c-popover">
      <div className="flex items-center justify-between px-4 pt-3">
        <h3 className="text-base font-semibold">알림</h3>
        <button
          type="button"
          onClick={state.markAll}
          disabled={state.unread === 0}
          className="text-xs text-muted-foreground hover:text-foreground disabled:opacity-40"
          data-testid="pg-notifications-page-c-popover-mark-all"
        >
          모두 읽음
        </button>
      </div>
      <div className="flex gap-1 border-b px-3 pt-2">
        {TABS.map((t) => {
          const c = count(t.key)
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              data-testid={`pg-notifications-page-c-popover-tab-${t.key}`}
              className={cn(
                "-mb-px flex items-center gap-1 border-b-2 px-2 pb-2 text-sm transition-colors",
                tab === t.key ? "border-foreground font-medium text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {t.label}
              {c > 0 && <span className="rounded-full bg-muted px-1.5 text-[10px] tabular-nums">{c}</span>}
            </button>
          )
        })}
      </div>

      <div className="max-h-[460px] overflow-y-auto">
        {pending.length > 0 && (
          <div className="space-y-1.5 border-b bg-violet-50/60 p-3 dark:bg-violet-950/20">
            <p className="px-1 text-[11px] font-medium text-violet-700 dark:text-violet-300">응답 대기 {pending.length}</p>
            {pending.map((n) => (
              <div key={n.id} className="flex items-center gap-3 rounded-lg bg-card px-3 py-2 shadow-sm" data-testid={`pg-notifications-page-c-popover-pending-${n.id}`}>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{n.title}</p>
                  <p className="truncate text-xs text-muted-foreground">{notifDetail(n)}</p>
                </div>
                <RsvpIcons n={n} state={state} testid={`pg-notifications-page-c-popover-pending-${n.id}-rsvp`} />
              </div>
            ))}
          </div>
        )}

        {rest.length === 0 && pending.length === 0 ? (
          <p className="p-10 text-center text-sm text-muted-foreground">알림 없음</p>
        ) : (
          <ul>
            {rest.map((n) => (
              <li key={n.id} className="group relative">
                <button
                  type="button"
                  onClick={() => state.open(n)}
                  className={cn("flex w-full items-start gap-3 px-4 py-2.5 pr-12 text-left hover:bg-muted/50", !n.read && "bg-blue-50/40 dark:bg-blue-950/20")}
                  data-testid={`pg-notifications-page-c-popover-row-${n.id}`}
                >
                  <TypeIcon n={n} className="size-7 [&_svg]:size-3.5" />
                  <div className="min-w-0 flex-1">
                    <p className={cn("text-[13px] leading-5", n.read ? "text-muted-foreground" : "text-foreground")}>
                      {notifSentence(n, (s) => <span className="font-semibold text-foreground">{s}</span>)}
                    </p>
                    <p className="truncate text-[11px] text-muted-foreground">
                      {relTime(n.at)}, {notifDetail(n)}
                    </p>
                  </div>
                  {!n.read && <span className="mt-2 size-2 shrink-0 rounded-full bg-blue-500 group-hover:invisible" />}
                </button>
                <button
                  type="button"
                  onClick={() => (n.read ? state.markUnread(n.id) : state.markRead(n.id))}
                  title={n.read ? "안 읽음으로" : "읽음으로"}
                  aria-label={n.read ? "안 읽음으로" : "읽음으로"}
                  className="absolute top-2.5 right-3 hidden rounded-md p-1 text-muted-foreground group-hover:block hover:bg-muted hover:text-foreground"
                  data-testid={`pg-notifications-page-c-popover-row-${n.id}-toggle-read`}
                >
                  {n.read ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <button
        type="button"
        className="block w-full border-t px-3 py-2.5 text-center text-xs font-medium text-muted-foreground hover:bg-muted/50 hover:text-foreground"
        data-testid="pg-notifications-page-c-popover-see-all"
      >
        알림 전체
      </button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// 페이지

const PAGE = 6

function Page({ state }: { state: NotifState }) {
  const [limit, setLimit] = useState(PAGE)
  const todo = state.items.filter((n) => needsResponse(n) || (!n.read && n.type !== "event_invitation_response" && n.type !== "event_reminder"))
  const log = state.items.filter((n) => !todo.includes(n))
  const shown = log.slice(0, limit)
  const groups = DAY_BUCKETS.map((b) => ({ label: b, items: shown.filter((n) => dayBucket(n.at) === b) })).filter((g) => g.items.length > 0)

  return (
    <div className="space-y-5" data-testid="pg-notifications-page-c">
      <header className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">알림</h1>
        <button
          type="button"
          onClick={state.markAll}
          disabled={state.unread === 0}
          className="text-sm text-muted-foreground hover:text-foreground disabled:opacity-40"
          data-testid="pg-notifications-page-c-mark-all"
        >
          모두 읽음
        </button>
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(440px,1.1fr)_minmax(360px,1fr)]">
        <section className="min-w-[360px] space-y-3">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            할 일<span className="text-xs tabular-nums text-muted-foreground">{todo.length}</span>
          </h2>
          {todo.length === 0 ? (
            <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">할 일 없음</div>
          ) : (
            <ul className="space-y-2">
              {todo.map((n) => (
                <li key={n.id} className="flex items-center gap-3 rounded-xl border bg-card p-3" data-testid={`pg-notifications-page-c-todo-${n.id}`}>
                  <TypeIcon n={n} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm">{notifSentence(n, (s) => <span className="font-semibold">{s}</span>)}</p>
                    <p className="truncate text-xs text-muted-foreground">{notifDetail(n)}</p>
                  </div>
                  {needsResponse(n) ? (
                    <RsvpIcons n={n} state={state} testid={`pg-notifications-page-c-todo-${n.id}-rsvp`} />
                  ) : (
                    <button
                      type="button"
                      onClick={() => state.markRead(n.id)}
                      className="shrink-0 rounded-md border px-2.5 py-1 text-xs hover:bg-muted"
                      data-testid={`pg-notifications-page-c-todo-${n.id}-ack`}
                    >
                      확인
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="min-w-[320px] space-y-3">
          <h2 className="text-sm font-semibold">기록</h2>
          <div className="rounded-xl border bg-card">
            {groups.map((g) => (
              <div key={g.label}>
                <p className="border-b bg-muted/40 px-4 py-1 text-[11px] font-medium text-muted-foreground first:rounded-t-xl">{g.label}</p>
                <ul className="divide-y divide-border/60">
                  {g.items.map((n) => (
                    <li key={n.id}>
                      <button
                        type="button"
                        onClick={() => state.open(n)}
                        className="flex w-full items-center gap-3 px-4 py-2 text-left text-sm hover:bg-muted/50"
                        data-testid={`pg-notifications-page-c-log-${n.id}`}
                      >
                        <span className="size-1.5 shrink-0 rounded-full bg-muted-foreground/40" />
                        <span className={cn("min-w-0 flex-1 truncate", n.read ? "text-muted-foreground" : "font-medium")}>{notifSentence(n)}</span>
                        <span className="shrink-0 text-xs text-muted-foreground">{relTime(n.at)}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
            {log.length > limit && (
              <button
                type="button"
                onClick={() => setLimit((l) => l + PAGE)}
                className="block w-full border-t px-4 py-2 text-center text-xs font-medium text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                data-testid="pg-notifications-page-c-load-more"
              >
                더 보기
              </button>
            )}
          </div>
        </section>
      </div>
    </div>
  )
}
