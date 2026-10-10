"use client"

// 안 C: 대상별 묶음. 같은 일정(캘린더, 예약 양식)에 일어난 일을 카드 하나에 모아 그 대상의 이력을 한눈에.
// 최근에 움직인 대상이 앞에 오고, 검색과 종류 칩으로 좁힌다.

import { useMemo, useState } from "react"
import { ArrowUpRight, CalendarDays, KeyRound, Search, Ticket } from "lucide-react"

import { useToast } from "@/components/ui-custom/use-toast"
import { cn } from "@/lib/utils"

import { relativeTime } from "../_mock"
import {
  ACTIVITIES,
  CATEGORIES,
  Avatar,
  KindBadge,
  actionPhrase,
  actorOf,
  categoryOf,
  targetOf,
  type ActCategory,
  type MockActivity,
  type Target,
} from "./shared"

interface Group {
  key: string
  target: Target
  entityType: MockActivity["entity_type"]
  items: MockActivity[]
}

const FOLD = 3

export function VariantC() {
  const { toast } = useToast()
  const [q, setQ] = useState("")
  const [cat, setCat] = useState<ActCategory | "all">("all")
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  const groups = useMemo(() => {
    const map = new Map<string, Group>()
    for (const a of ACTIVITIES) {
      if (cat !== "all" && categoryOf(a) !== cat) continue
      const key = `${a.entity_type}:${a.entity_id}`
      const g = map.get(key)
      if (g) g.items.push(a)
      else map.set(key, { key, target: targetOf(a), entityType: a.entity_type, items: [a] })
    }
    const needle = q.trim().toLowerCase()
    return [...map.values()].filter((g) => !needle || g.target.name.toLowerCase().includes(needle))
  }, [q, cat])

  function toggle(key: string) {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  return (
    <div className="mx-auto max-w-5xl space-y-5" data-testid="pg-activity-page-c">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-2xl font-bold">활동 내역</h1>
        <label className="relative w-full sm:w-64">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="일정, 캘린더 이름"
            className="h-9 w-full rounded-lg border bg-background pr-3 pl-8 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
            data-testid="pg-activity-page-c-search"
          />
        </label>
      </header>

      <div className="flex flex-wrap gap-1.5">
        {CATEGORIES.map((c) => (
          <button
            key={c.key}
            type="button"
            onClick={() => setCat(c.key)}
            data-testid={`pg-activity-page-c-cat-${c.key}`}
            className={cn(
              "rounded-full border px-3 py-1 text-xs transition-colors",
              cat === c.key ? "border-primary bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:text-foreground",
            )}
          >
            {c.label}
          </button>
        ))}
      </div>

      {groups.length === 0 ? (
        <div className="rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">활동 없음</div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {groups.map((g) => {
            const open = expanded.has(g.key)
            const visible = open ? g.items : g.items.slice(0, FOLD)
            const rest = g.items.length - FOLD
            return (
              <article key={g.key} className="flex flex-col overflow-hidden rounded-xl border bg-card" data-testid={`pg-activity-page-c-group-${g.key}`}>
                <div className="flex items-center gap-3 border-b px-4 py-3">
                  <TargetIcon g={g} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{g.target.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {g.target.typeLabel}, {relativeTime(g.items[0].created_at)}
                    </p>
                  </div>
                  <span className="rounded-full bg-muted px-2 py-0.5 text-xs tabular-nums text-muted-foreground">{g.items.length}</span>
                </div>

                <ol className="flex-1 space-y-2.5 px-4 py-3">
                  {visible.map((a) => {
                    const actor = actorOf(a)
                    return (
                      <li key={a.id} className="flex items-start gap-2.5 text-sm" data-testid={`pg-activity-page-c-row-${a.id}`}>
                        <KindBadge it={a} className="size-6 [&_svg]:size-3" />
                        <p className="min-w-0 flex-1 pt-0.5 leading-5 text-muted-foreground">
                          <span className="font-medium text-foreground">{actor.isMe ? "내가" : `${actor.name}님이`}</span> {actionPhrase(a)}
                        </p>
                        <span className="flex shrink-0 items-center gap-1.5 pt-0.5 text-xs tabular-nums text-muted-foreground">
                          {relativeTime(a.created_at)}
                          <Avatar actor={actor} size={18} />
                        </span>
                      </li>
                    )
                  })}
                </ol>

                <div className="flex items-center justify-between border-t bg-muted/30 px-4 py-2">
                  {rest > 0 ? (
                    <button
                      type="button"
                      onClick={() => toggle(g.key)}
                      className="text-xs text-muted-foreground hover:text-foreground"
                      data-testid={`pg-activity-page-c-group-${g.key}-more`}
                    >
                      {open ? "접기" : `${rest}건 더`}
                    </button>
                  ) : (
                    <span />
                  )}
                  {g.target.eventId ? (
                    <button
                      type="button"
                      onClick={() => toast.info(`${g.target.name} 열기`)}
                      className="inline-flex items-center gap-1 text-xs font-medium text-foreground hover:underline"
                      data-testid={`pg-activity-page-c-group-${g.key}-open`}
                    >
                      일정 열기
                      <ArrowUpRight className="size-3" />
                    </button>
                  ) : g.entityType === "event" || g.entityType === "booking" ? (
                    <span className="text-xs text-muted-foreground">{g.entityType === "event" ? "삭제됨" : "취소됨"}</span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => toast.info(`${g.target.typeLabel} 설정 열기`)}
                      className="inline-flex items-center gap-1 text-xs font-medium text-foreground hover:underline"
                      data-testid={`pg-activity-page-c-group-${g.key}-settings`}
                    >
                      설정
                      <ArrowUpRight className="size-3" />
                    </button>
                  )}
                </div>
              </article>
            )
          })}
        </div>
      )}
    </div>
  )
}

function TargetIcon({ g }: { g: Group }) {
  if (g.target.color) {
    return (
      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg" style={{ background: `${g.target.color}22`, color: g.target.color }}>
        <CalendarDays className="size-4" />
      </span>
    )
  }
  const Icon = g.entityType === "caldav_token" ? KeyRound : g.entityType === "event" ? CalendarDays : Ticket
  return (
    <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
      <Icon className="size-4" />
    </span>
  )
}
