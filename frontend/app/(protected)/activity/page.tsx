"use client"

import { useMemo, useState } from "react"
import { X } from "lucide-react"

import { ActivityMonth } from "@/components/activity/activity-month"
import { KindBadge } from "@/components/activity/kind-badge"
import { useAppContext } from "@/components/providers/app-context"
import { Segmented } from "@/components/shared/segmented"
import { Sentence } from "@/components/shared/sentence"
import { cn } from "@/lib/utils"
import { useApiGet } from "@/lib/hooks/use-api"
import type { ActivityItem, ActivityResponse } from "@/lib/types/activity"
import type { CalendarListResponse } from "@/lib/types/api"
import {
  CATEGORIES,
  SCOPES,
  activityKind,
  activitySentence,
  actorOf,
  categoryOf,
  inScope,
  type ActCategory,
  type Scope,
} from "@/lib/utils/activity-format"
import { clock, formatDay, parseYmd, seedColor, ymdOf } from "@/lib/utils/day-format"
import { formatDateTime } from "@/lib/utils/format"

function monthStart(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1)
}

export default function ActivityPage() {
  const { authUser, activeWorkspaceId } = useAppContext()
  const me = authUser?.id ?? null

  const [scope, setScope] = useState<Scope>("all")
  const [cat, setCat] = useState<ActCategory | "all">("all")
  const [day, setDay] = useState<string | null>(null)
  const [month, setMonth] = useState(() => monthStart(new Date()))

  const from = month.toISOString()
  const to = new Date(month.getFullYear(), month.getMonth() + 1, 1).toISOString()
  const { data, error, isLoading } = useApiGet<ActivityResponse>(
    activeWorkspaceId
      ? `/api/v1/me/activity?limit=1000&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`
      : null,
  )
  const { data: calData } = useApiGet<CalendarListResponse>(activeWorkspaceId ? "/api/v1/calendars" : null)
  const calColor = useMemo(() => {
    const m = new Map<string, string>()
    for (const c of calData?.calendars ?? []) m.set(c.id, c.color_override ?? c.color)
    return (id: string) => m.get(id) ?? null
  }, [calData])

  const items = useMemo(() => data?.items ?? [], [data])
  const scoped = useMemo(() => items.filter((a) => inScope(a, scope, me)), [items, scope, me])
  const filtered = useMemo(
    () => scoped.filter((a) => cat === "all" || categoryOf(a) === cat),
    [scoped, cat],
  )

  const perDay = useMemo(() => {
    const m = new Map<string, number>()
    for (const a of filtered) {
      const k = ymdOf(new Date(a.created_at))
      m.set(k, (m.get(k) ?? 0) + 1)
    }
    return m
  }, [filtered])

  const catCount = (k: ActCategory | "all") => scoped.filter((a) => k === "all" || categoryOf(a) === k).length

  const shown = day ? filtered.filter((a) => ymdOf(new Date(a.created_at)) === day) : filtered
  const byDay: { key: string; items: ActivityItem[] }[] = []
  for (const a of shown) {
    const k = ymdOf(new Date(a.created_at))
    const last = byDay[byDay.length - 1]
    if (last && last.key === k) last.items.push(a)
    else byDay.push({ key: k, items: [a] })
  }

  function changeMonth(m: Date) {
    setMonth(m)
    setDay(null)
  }

  return (
    <div className="h-full overflow-y-auto px-4 py-8 sm:px-6 lg:px-8" data-testid="activity-page">
      <div className="mx-auto flex max-w-5xl flex-col gap-6 md:flex-row">
        <aside className="w-full shrink-0 space-y-6 md:w-64">
          <h1 className="text-2xl font-bold text-foreground">활동 내역</h1>

          <ActivityMonth month={month} onMonth={changeMonth} perDay={perDay} day={day} onDay={setDay} />

          <nav className="space-y-0.5" data-testid="activity-categories">
            {CATEGORIES.map((c) => (
              <button
                key={c.key}
                type="button"
                onClick={() => setCat(c.key)}
                data-testid={`activity-cat-${c.key}`}
                aria-pressed={cat === c.key}
                className={cn(
                  "flex w-full items-center justify-between rounded-md px-2.5 py-1.5 text-sm",
                  cat === c.key
                    ? "bg-muted font-medium text-foreground"
                    : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                )}
              >
                {c.label}
                <span className="text-xs tabular-nums text-muted-foreground">{catCount(c.key)}</span>
              </button>
            ))}
          </nav>
        </aside>

        <main className="min-w-0 flex-1 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              {day ? (
                <span className="inline-flex items-center gap-1 rounded-full border bg-card py-0.5 pr-1 pl-3 text-sm font-medium">
                  {formatDay(parseYmd(day))}
                  <button
                    type="button"
                    onClick={() => setDay(null)}
                    className="rounded-full p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                    aria-label="날짜 해제"
                    data-testid="activity-clear-day"
                  >
                    <X className="size-3.5" />
                  </button>
                </span>
              ) : (
                <span className="text-sm font-medium">{month.getMonth() + 1}월</span>
              )}
              <span className="text-xs tabular-nums text-muted-foreground" data-testid="activity-count">
                {shown.length}건
              </span>
            </div>
            <Segmented value={scope} options={SCOPES} onChange={setScope} testid="activity-scope" />
          </div>

          {error ? (
            <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300">
              불러오지 못했습니다
            </div>
          ) : isLoading ? (
            <p className="text-sm text-muted-foreground">불러오는 중…</p>
          ) : byDay.length === 0 ? (
            <div
              className="rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground"
              data-testid="activity-empty"
            >
              활동 없음
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border bg-card" data-testid="activity-list">
              {byDay.map((g) => (
                <section key={g.key}>
                  {!day && (
                    <div className="border-b bg-muted/60 px-4 py-1.5 text-xs font-medium text-muted-foreground">
                      {formatDay(parseYmd(g.key))}
                    </div>
                  )}
                  <ul className="divide-y divide-border/60">
                    {g.items.map((a) => {
                      const actor = actorOf(a, me)
                      return (
                        <li
                          key={a.id}
                          className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/40"
                          data-testid={`activity-row-${a.id}`}
                        >
                          <time
                            dateTime={a.created_at}
                            title={formatDateTime(a.created_at)}
                            className="w-11 shrink-0 text-xs tabular-nums text-muted-foreground"
                          >
                            {clock(a.created_at)}
                          </time>
                          <KindBadge kind={activityKind(a)} />
                          <p className="min-w-0 flex-1 text-sm break-keep text-muted-foreground">
                            <Sentence
                              parts={activitySentence(a, { meSub: me, calendarColor: calColor })}
                              actor={(x) => <span className="text-foreground">{x}</span>}
                              em={(x) => <span className="text-foreground">{x}</span>}
                              target={(x, color) => (
                                <span className="font-semibold text-foreground">
                                  {color && (
                                    <span
                                      className="mr-1 inline-block size-2 rounded-full align-middle"
                                      style={{ background: color }}
                                    />
                                  )}
                                  {x}
                                </span>
                              )}
                            />
                          </p>
                          <span
                            className="hidden size-[22px] shrink-0 items-center justify-center rounded-full text-[9px] font-medium text-white sm:inline-flex"
                            style={{ background: actor.kind === "member" ? seedColor(a.actor_sub ?? actor.name) : "#64748b" }}
                            title={actor.name}
                          >
                            {actor.kind === "guest" ? "@" : actor.name.slice(0, 1)}
                          </span>
                        </li>
                      )
                    })}
                  </ul>
                </section>
              ))}
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
