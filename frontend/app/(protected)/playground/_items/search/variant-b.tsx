"use client"

// 안 B: 날짜별 그룹. 다가오는 일정은 날짜순, 지난 일정은 접어 두고 최근순.

import { useMemo, useState } from "react"
import { ChevronDown, MapPin, Search, X } from "lucide-react"

import { useToast } from "@/components/ui-custom/use-toast"
import { cn } from "@/lib/utils"

import { calendarOf } from "../_mock"
import { Highlight, TODAY_KEY, dayKey, isPast, search, timeLabel, type Hit } from "./shared"

const T = "pg-search-b"
const WD = ["일", "월", "화", "수", "목", "금", "토"]

function groupByDay(hits: Hit[]) {
  const m = new Map<string, Hit[]>()
  for (const h of hits) {
    const k = dayKey(h.item.start)
    m.set(k, [...(m.get(k) ?? []), h])
  }
  return [...m.entries()]
}

export function VariantB() {
  const { toast } = useToast()
  const [q, setQ] = useState("회의")
  const [from, setFrom] = useState("")
  const [to, setTo] = useState("")
  const [showPast, setShowPast] = useState(false)

  const hits = useMemo(() => search(q, { from, to }), [q, from, to])
  const upcoming = groupByDay(hits.filter((h) => !isPast(h.item)))
  const past = groupByDay(hits.filter((h) => isPast(h.item)).reverse())
  const pastCount = past.reduce((n, [, l]) => n + l.length, 0)

  const open = (h: Hit) => toast.info(`${h.item.title}: 달력에서 열기`)

  return (
    <div className="flex max-h-[640px] w-full max-w-[600px] flex-col overflow-hidden rounded-2xl border bg-background shadow-2xl">
      <div className="space-y-3 border-b p-4">
        <div className="flex items-center gap-2 rounded-xl border border-input bg-card px-3 focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/30">
          <Search className="size-4 text-muted-foreground" />
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="일정 검색"
            className="h-10 min-w-0 flex-1 bg-transparent text-sm outline-none"
            data-testid={`${T}-input`}
          />
          {q && (
            <button
              type="button"
              onClick={() => setQ("")}
              className="rounded-full p-1 text-muted-foreground hover:bg-muted"
              aria-label="지우기"
              data-testid={`${T}-clear-button`}
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className="text-muted-foreground">기간</span>
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="rounded-md border border-input bg-card px-2 py-1"
            data-testid={`${T}-from-input`}
          />
          <span className="text-muted-foreground">~</span>
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="rounded-md border border-input bg-card px-2 py-1"
            data-testid={`${T}-to-input`}
          />
          <span className="ml-auto font-medium tabular-nums text-muted-foreground" data-testid={`${T}-count`}>
            {q.trim() ? `${hits.length}건` : ""}
          </span>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto" data-testid={`${T}-results`}>
        {!q.trim() ? (
          <p className="py-14 text-center text-sm text-muted-foreground">검색어 입력</p>
        ) : hits.length === 0 ? (
          <p className="py-14 text-center text-sm text-muted-foreground" data-testid={`${T}-empty`}>
            결과 없음
          </p>
        ) : (
          <>
            {upcoming.length > 0 && <Heading label="다가오는 일정" count={hits.length - pastCount} />}
            {upcoming.map(([k, list]) => (
              <DayGroup key={k} dayKey={k} hits={list} q={q} onOpen={open} />
            ))}
            {pastCount > 0 && (
              <button
                type="button"
                onClick={() => setShowPast((v) => !v)}
                className="sticky top-0 z-10 flex w-full items-center gap-2 border-y bg-muted/60 px-4 py-2 text-left text-xs font-semibold text-muted-foreground backdrop-blur hover:text-foreground"
                data-testid={`${T}-past-toggle`}
              >
                지난 일정 {pastCount}
                <ChevronDown className={cn("ml-auto size-4 transition-transform", showPast && "rotate-180")} />
              </button>
            )}
            {showPast &&
              past.map(([k, list]) => <DayGroup key={k} dayKey={k} hits={list} q={q} onOpen={open} past />)}
          </>
        )}
      </div>
    </div>
  )
}

function Heading({ label, count }: { label: string; count: number }) {
  return (
    <p className="sticky top-0 z-10 border-b bg-background/95 px-4 py-2 text-xs font-semibold text-muted-foreground backdrop-blur">
      {label} {count}
    </p>
  )
}

function DayGroup({
  dayKey: k,
  hits,
  q,
  onOpen,
  past,
}: {
  dayKey: string
  hits: Hit[]
  q: string
  onOpen: (h: Hit) => void
  past?: boolean
}) {
  const d = new Date(`${k}T00:00:00`)
  const today = k === TODAY_KEY
  const weekend = d.getDay() === 0 || d.getDay() === 6
  return (
    <div className={cn("flex gap-3 border-b border-border/60 px-4 py-3", past && "opacity-70")}>
      <div className="w-12 shrink-0 pt-0.5 text-center">
        <p className={cn("text-[11px] font-medium", weekend ? "text-rose-600 dark:text-rose-400" : "text-muted-foreground")}>
          {d.getMonth() + 1}월 {WD[d.getDay()]}
        </p>
        <p
          className={cn(
            "mx-auto mt-0.5 grid size-9 place-items-center rounded-full text-lg font-semibold tabular-nums",
            today && "bg-primary text-primary-foreground",
          )}
        >
          {d.getDate()}
        </p>
      </div>
      <ul className="min-w-0 flex-1 space-y-1">
        {hits.map((h) => {
          const cal = calendarOf(h.item.calendarId)
          return (
            <li key={h.item.id}>
              <button
                type="button"
                onClick={() => onOpen(h)}
                className="flex w-full items-start gap-3 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-muted"
                data-testid={`${T}-row-${h.item.id}`}
              >
                <span className="mt-1.5 size-2 shrink-0 rounded-full" style={{ backgroundColor: cal.color }} />
                <span className="w-24 shrink-0 pt-px text-xs tabular-nums text-muted-foreground">{timeLabel(h.item)}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">
                    <Highlight text={h.item.title} q={q} />
                  </span>
                  {h.item.location && (
                    <span className="mt-0.5 flex items-center gap-1 truncate text-xs text-muted-foreground">
                      <MapPin className="size-3 shrink-0" />
                      <Highlight text={h.item.location} q={q} />
                    </span>
                  )}
                  {h.field === "description" && h.item.description && (
                    <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                      <Highlight text={h.item.description} q={q} />
                    </span>
                  )}
                </span>
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
