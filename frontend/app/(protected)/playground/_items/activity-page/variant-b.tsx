"use client"

// 안 B: 달력으로 찾기. 왼쪽 작은 달력에 활동이 있던 날이 진하게 표시되고, 날짜를 누르면 그날만 본다.
// 종류 필터는 왼쪽 목록, 오른쪽은 시각, 아이콘, 문장만 있는 촘촘한 줄.

import { useMemo, useState } from "react"
import { ChevronLeft, ChevronRight, X } from "lucide-react"

import { cn } from "@/lib/utils"

import { NOW, formatDay } from "../_mock"
import {
  ACTIVITIES,
  CATEGORIES,
  SCOPES,
  Avatar,
  KindBadge,
  Segmented,
  activitySentence,
  actorOf,
  categoryOf,
  clock,
  inScope,
  ymdOf,
  type ActCategory,
  type Scope,
} from "./shared"

const WD = ["일", "월", "화", "수", "목", "금", "토"]

export function VariantB() {
  const [scope, setScope] = useState<Scope>("all")
  const [cat, setCat] = useState<ActCategory | "all">("all")
  const [day, setDay] = useState<string | null>(null)
  const [month, setMonth] = useState(() => new Date(NOW.getFullYear(), NOW.getMonth(), 1))

  const filtered = useMemo(
    () => ACTIVITIES.filter((a) => inScope(a, scope) && (cat === "all" || categoryOf(a) === cat)),
    [scope, cat],
  )

  const perDay = useMemo(() => {
    const m = new Map<string, number>()
    for (const a of filtered) {
      const k = ymdOf(new Date(a.created_at))
      m.set(k, (m.get(k) ?? 0) + 1)
    }
    return m
  }, [filtered])

  const catCount = (k: ActCategory | "all") =>
    ACTIVITIES.filter((a) => inScope(a, scope) && (k === "all" || categoryOf(a) === k)).length

  const shown = day ? filtered.filter((a) => ymdOf(new Date(a.created_at)) === day) : filtered
  const byDay: { key: string; items: typeof shown }[] = []
  for (const a of shown) {
    const k = ymdOf(new Date(a.created_at))
    const last = byDay[byDay.length - 1]
    if (last && last.key === k) last.items.push(a)
    else byDay.push({ key: k, items: [a] })
  }

  // 달력 칸
  const first = new Date(month)
  const startPad = first.getDay()
  const daysIn = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate()
  const cells: (Date | null)[] = [
    ...Array.from({ length: startPad }, () => null),
    ...Array.from({ length: daysIn }, (_, i) => new Date(month.getFullYear(), month.getMonth(), i + 1)),
  ]
  const todayKey = ymdOf(NOW)

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 md:flex-row" data-testid="pg-activity-page-b">
      <aside className="w-full shrink-0 space-y-6 md:w-64">
        <h1 className="text-2xl font-bold">활동 내역</h1>

        <div className="rounded-xl border bg-card p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm font-semibold">
              {month.getFullYear()}년 {month.getMonth() + 1}월
            </span>
            <div className="flex">
              <button
                type="button"
                onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}
                className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                aria-label="이전 달"
                data-testid="pg-activity-page-b-prev-month"
              >
                <ChevronLeft className="size-4" />
              </button>
              <button
                type="button"
                onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}
                className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                aria-label="다음 달"
                data-testid="pg-activity-page-b-next-month"
              >
                <ChevronRight className="size-4" />
              </button>
            </div>
          </div>
          <div className="grid grid-cols-7 gap-0.5 text-center text-[11px] text-muted-foreground">
            {WD.map((w) => (
              <span key={w} className="py-1">
                {w}
              </span>
            ))}
            {cells.map((d, i) => {
              if (!d) return <span key={`p${i}`} />
              const k = ymdOf(d)
              const n = perDay.get(k) ?? 0
              const future = d > NOW
              return (
                <button
                  key={k}
                  type="button"
                  disabled={n === 0}
                  onClick={() => setDay(day === k ? null : k)}
                  data-testid={`pg-activity-page-b-day-${k}`}
                  title={n ? `${n}건` : undefined}
                  className={cn(
                    "relative flex aspect-square items-center justify-center rounded-md text-xs tabular-nums transition-colors",
                    n === 0 && (future ? "text-muted-foreground/40" : "text-muted-foreground"),
                    n === 1 && "bg-primary/15 text-foreground hover:bg-primary/25",
                    n === 2 && "bg-primary/30 text-foreground hover:bg-primary/40",
                    n >= 3 && "bg-primary font-medium text-primary-foreground hover:bg-primary/85",
                    day === k && "ring-2 ring-primary ring-offset-1 ring-offset-card",
                    k === todayKey && "font-bold underline underline-offset-2",
                  )}
                >
                  {d.getDate()}
                </button>
              )
            })}
          </div>
        </div>

        <nav className="space-y-0.5">
          {CATEGORIES.map((c) => (
            <button
              key={c.key}
              type="button"
              onClick={() => setCat(c.key)}
              data-testid={`pg-activity-page-b-cat-${c.key}`}
              className={cn(
                "flex w-full items-center justify-between rounded-md px-2.5 py-1.5 text-sm",
                cat === c.key ? "bg-muted font-medium text-foreground" : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
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
                {formatDay(new Date(`${day}T12:00:00+09:00`).toISOString())}
                <button
                  type="button"
                  onClick={() => setDay(null)}
                  className="rounded-full p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                  aria-label="날짜 해제"
                  data-testid="pg-activity-page-b-clear-day"
                >
                  <X className="size-3.5" />
                </button>
              </span>
            ) : (
              <span className="text-sm font-medium">최근</span>
            )}
            <span className="text-xs tabular-nums text-muted-foreground">{shown.length}건</span>
          </div>
          <Segmented value={scope} options={SCOPES} onChange={setScope} testid="pg-activity-page-b-scope" />
        </div>

        {byDay.length === 0 ? (
          <div className="rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">활동 없음</div>
        ) : (
          <div className="overflow-hidden rounded-xl border bg-card">
            {byDay.map((g) => (
              <section key={g.key}>
                {!day && (
                  <div className="sticky top-0 border-b bg-muted/60 px-4 py-1.5 text-xs font-medium text-muted-foreground backdrop-blur">
                    {formatDay(new Date(`${g.key}T12:00:00+09:00`).toISOString())}
                  </div>
                )}
                <ul className="divide-y divide-border/60">
                  {g.items.map((a) => {
                    const actor = actorOf(a)
                    return (
                      <li key={a.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/40" data-testid={`pg-activity-page-b-row-${a.id}`}>
                        <span className="w-11 shrink-0 text-xs tabular-nums text-muted-foreground">{clock(a.created_at)}</span>
                        <KindBadge it={a} />
                        <p className="min-w-0 flex-1 text-sm text-muted-foreground">
                          {activitySentence(a, {
                            actor: (x) => <span className="text-foreground">{x.name}</span>,
                            em: (s) => <span className="text-foreground">{s}</span>,
                            target: (t) => (
                              <span className="font-semibold text-foreground">
                                {t.color && <span className="mr-1 inline-block size-2 rounded-full align-middle" style={{ background: t.color }} />}
                                {t.name}
                              </span>
                            ),
                          })}
                        </p>
                        <Avatar actor={actor} size={22} className="hidden sm:inline-flex" />
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
  )
}
