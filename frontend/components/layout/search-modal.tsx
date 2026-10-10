"use client"

import { Fragment, useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { CalendarRange, CornerDownLeft, History, Search, X } from "lucide-react"

import { api } from "@/lib/api-client"
import { useApiGet } from "@/lib/hooks/use-api"
import type { CalendarListResponse, OccurrenceListResponse } from "@/lib/types/api"
import type { SearchEventItem, SearchMatchedField, SearchResponse } from "@/lib/types/search"
import { cn } from "@/lib/utils"
import { dayLabel, timeOfDay } from "@/lib/utils/event-format"
import { logger } from "@/lib/utils/logger"

const T = "search-modal"
const RECENT_KEY = "calendar.search.recent"
const RECENT_MAX = 5

const FIELD_LABEL: Record<SearchMatchedField, string> = {
  title: "제목",
  location: "장소",
  description: "설명",
}

interface Row {
  key: string
  eventId: string
  title: string
  calendarId: string
  calendarName: string | null
  calendarColor: string | null
  start: string
  end: string
  allDay: boolean
  location: string | null
  description: string | null
  field?: SearchMatchedField
}

function readRecent(): string[] {
  try {
    const raw = window.localStorage.getItem(RECENT_KEY)
    const v = raw ? (JSON.parse(raw) as unknown) : []
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string").slice(0, RECENT_MAX) : []
  } catch {
    return []
  }
}

function writeRecent(list: string[]) {
  try {
    window.localStorage.setItem(RECENT_KEY, JSON.stringify(list))
  } catch {
    // 저장소를 못 쓰면 최근 검색만 빠진다.
  }
}

/** 커맨드 팔레트식 일정 검색. 입력하는 대로 찾고, ↑↓ Enter 로 연다. */
export function SearchModal({ onClose }: { onClose: () => void }) {
  const router = useRouter()
  const [q, setQ] = useState("")
  const [showRange, setShowRange] = useState(false)
  const [from, setFrom] = useState("")
  const [to, setTo] = useState("")
  const [active, setActive] = useState(0)
  const [recent, setRecent] = useState<string[]>(readRecent)
  const [result, setResult] = useState<{ key: string; events: SearchEventItem[] } | null>(null)
  const listRef = useRef<HTMLUListElement>(null)

  // 다가오는 일정: 열 때의 시각 기준 30일
  const [upcomingUrl] = useState(() => {
    const now = new Date()
    const end = new Date(now.getTime() + 30 * 86_400_000)
    return `/api/v1/events?from=${encodeURIComponent(now.toISOString())}&to=${encodeURIComponent(end.toISOString())}`
  })
  const [nowMs] = useState(() => Date.now())
  const { data: upcomingData } = useApiGet<OccurrenceListResponse>(upcomingUrl)
  const { data: calList } = useApiGet<CalendarListResponse>("/api/v1/calendars")
  const calById = useMemo(() => new Map((calList?.calendars ?? []).map((c) => [c.id, c])), [calList])

  const term = q.trim()
  const searchKey = term ? JSON.stringify([term, from, to]) : ""

  useEffect(() => {
    if (!searchKey) return
    let cancelled = false
    const timer = setTimeout(async () => {
      const p = new URLSearchParams({ q: term, limit: "30" })
      if (from) p.set("date_from", new Date(`${from}T00:00:00`).toISOString())
      if (to) p.set("date_to", new Date(`${to}T23:59:59`).toISOString())
      try {
        const r = await api<SearchResponse>(`/api/v1/search?${p}`)
        if (!cancelled) setResult({ key: searchKey, events: r.events })
      } catch (e) {
        logger.warn("search_failed", { category: "api", error: (e as Error).message })
        if (!cancelled) setResult({ key: searchKey, events: [] })
      }
    }, 200)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [searchKey, term, from, to])

  const loading = !!searchKey && result?.key !== searchKey

  const rows: Row[] = useMemo(() => {
    if (term) {
      if (!result || result.key !== searchKey) return []
      return [...result.events]
        .sort((a, b) => a.start_at.localeCompare(b.start_at))
        .map((e) => ({
          key: e.id,
          eventId: e.id,
          title: e.title,
          calendarId: e.calendar_id,
          calendarName: e.calendar_name ?? null,
          calendarColor: e.calendar_color ?? null,
          start: e.start_at,
          end: e.end_at,
          allDay: e.all_day ?? false,
          location: e.location,
          description: e.description,
          field: e.matched_field,
        }))
    }
    return (upcomingData?.occurrences ?? [])
      .filter((o) => !o.all_day || Date.parse(o.end_at) > nowMs)
      .sort((a, b) => a.start_at.localeCompare(b.start_at))
      .slice(0, 5)
      .map((o) => ({
        key: `${o.event_id}-${o.start_at}`,
        eventId: o.event_id,
        title: o.title,
        calendarId: o.calendar_id,
        calendarName: null,
        calendarColor: null,
        start: o.start_at,
        end: o.end_at,
        allDay: o.all_day,
        location: o.location,
        description: o.description,
      }))
  }, [term, result, searchKey, upcomingData, nowMs])

  const cur = Math.min(active, Math.max(rows.length - 1, 0))

  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-index="${cur}"]`)?.scrollIntoView({ block: "nearest" })
  }, [cur])

  function open(row: Row) {
    if (term) {
      const next = [term, ...recent.filter((x) => x !== term)].slice(0, RECENT_MAX)
      setRecent(next)
      writeRecent(next)
    }
    onClose()
    const p = new URLSearchParams({ event: row.eventId, start: row.start, end: row.end })
    router.push(`/calendar?${p}`)
  }

  function removeRecent(r: string) {
    const next = recent.filter((x) => x !== r)
    setRecent(next)
    writeRecent(next)
  }

  function onKey(e: React.KeyboardEvent) {
    if (e.nativeEvent.isComposing) return
    if (e.key === "ArrowDown") {
      e.preventDefault()
      setActive(Math.min(cur + 1, rows.length - 1))
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      setActive(Math.max(cur - 1, 0))
    } else if (e.key === "Enter" && rows[cur]) {
      e.preventDefault()
      open(rows[cur])
    } else if (e.key === "Escape") {
      e.preventDefault()
      if (q) setQ("")
      else onClose()
    }
  }

  const rangeOn = !!(from || to)

  return (
    <div
      className="fixed inset-0 z-[60] flex items-start justify-center bg-black/30 p-4 pt-[10vh]"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="일정 검색"
        className="flex max-h-[75vh] w-full max-w-[620px] flex-col overflow-hidden rounded-2xl border bg-popover text-popover-foreground shadow-2xl ring-1 ring-foreground/5"
        data-testid={T}
      >
        <div className="flex items-center gap-3 px-4">
          <Search className="size-5 shrink-0 text-muted-foreground" />
          <input
            autoFocus
            value={q}
            onChange={(e) => {
              setQ(e.target.value)
              setActive(0)
            }}
            onKeyDown={onKey}
            placeholder="일정 검색"
            aria-label="일정 검색"
            className="h-14 min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-muted-foreground/70"
            data-testid={`${T}-input`}
          />
          {q && (
            <button
              type="button"
              onClick={() => setQ("")}
              className="rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
              aria-label="지우기"
              data-testid={`${T}-clear-button`}
            >
              <X className="size-4" />
            </button>
          )}
          <button
            type="button"
            onClick={() => setShowRange((v) => !v)}
            aria-expanded={showRange}
            className={cn(
              "inline-flex shrink-0 items-center gap-1.5 rounded-md border px-2 py-1 text-xs font-medium transition-colors",
              rangeOn
                ? "border-primary/40 bg-primary/10 text-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
            data-testid={`${T}-range-button`}
          >
            <CalendarRange className="size-3.5" />
            {rangeOn ? `${from || "처음"} ~ ${to || "끝"}` : "기간"}
          </button>
        </div>

        {showRange && (
          <div className="flex flex-wrap items-center gap-2 border-t bg-muted/30 px-4 py-2 text-xs">
            <input
              type="date"
              value={from}
              onChange={(e) => {
                setFrom(e.target.value)
                setActive(0)
              }}
              aria-label="시작일"
              className="rounded-md border border-input bg-background px-2 py-1"
              data-testid={`${T}-from`}
            />
            <span className="text-muted-foreground">~</span>
            <input
              type="date"
              value={to}
              onChange={(e) => {
                setTo(e.target.value)
                setActive(0)
              }}
              aria-label="종료일"
              className="rounded-md border border-input bg-background px-2 py-1"
              data-testid={`${T}-to`}
            />
            {rangeOn && (
              <button
                type="button"
                onClick={() => {
                  setFrom("")
                  setTo("")
                }}
                className="ml-auto text-muted-foreground hover:text-foreground"
                data-testid={`${T}-range-reset`}
              >
                초기화
              </button>
            )}
          </div>
        )}

        <div className="min-h-0 flex-1 overflow-y-auto border-t p-2" data-testid={`${T}-results`}>
          {!term && recent.length > 0 && (
            <div className="px-2 pb-2 pt-1">
              <p className="mb-2 text-[11px] font-semibold text-muted-foreground">최근 검색</p>
              <div className="flex flex-wrap gap-1.5">
                {recent.map((r) => (
                  <span key={r} className="group inline-flex items-center rounded-full bg-muted text-xs">
                    <button
                      type="button"
                      onClick={() => {
                        setQ(r)
                        setActive(0)
                      }}
                      className="inline-flex items-center gap-1 rounded-l-full py-1 pl-2.5 pr-1 hover:text-foreground"
                      data-testid={`${T}-recent-${r}`}
                    >
                      <History className="size-3 text-muted-foreground" />
                      {r}
                    </button>
                    <button
                      type="button"
                      onClick={() => removeRecent(r)}
                      aria-label="최근 검색 지우기"
                      className="rounded-r-full py-1 pl-0.5 pr-2 text-muted-foreground opacity-60 hover:opacity-100"
                      data-testid={`${T}-recent-${r}-remove`}
                    >
                      <X className="size-3" />
                    </button>
                  </span>
                ))}
              </div>
            </div>
          )}

          {rows.length > 0 && (
            <p className="px-2 pb-1 pt-2 text-[11px] font-semibold text-muted-foreground">
              {term ? `일정 ${rows.length}` : "다가오는 일정"}
            </p>
          )}

          {term && loading && rows.length === 0 && (
            <p className="py-10 text-center text-sm text-muted-foreground">검색 중</p>
          )}
          {term && !loading && rows.length === 0 && (
            <p className="py-10 text-center text-sm text-muted-foreground" data-testid={`${T}-empty`}>
              결과 없음
            </p>
          )}

          <ul ref={listRef}>
            {rows.map((row, i) => {
              const cal = calById.get(row.calendarId)
              const color = cal?.color_override ?? cal?.color ?? row.calendarColor ?? "#6b7280"
              const calName = cal?.name ?? row.calendarName ?? ""
              const on = i === cur
              const past = Date.parse(row.end) < nowMs
              const note = row.field && row.field !== "title" ? row.field : null
              const start = new Date(row.start)
              return (
                <li key={row.key}>
                  <button
                    type="button"
                    data-index={i}
                    onMouseMove={() => active !== i && setActive(i)}
                    onClick={() => open(row)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left",
                      on && "bg-accent text-accent-foreground",
                      past && !on && "opacity-60",
                    )}
                    data-testid={`${T}-event-${row.eventId}`}
                  >
                    <span className="h-8 w-1 shrink-0 rounded-full" style={{ backgroundColor: color }} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">
                        <Highlight text={row.title} q={term} />
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {note ? (
                          <>
                            {FIELD_LABEL[note]}:{" "}
                            <Highlight text={(note === "location" ? row.location : row.description) ?? ""} q={term} />
                          </>
                        ) : (
                          <>
                            {calName}
                            {row.location && `${calName ? ", " : ""}${row.location}`}
                          </>
                        )}
                      </span>
                    </span>
                    <span className="shrink-0 text-right text-xs tabular-nums text-muted-foreground">
                      <span className="block">{dayLabel(start)}</span>
                      <span className="block">
                        {row.allDay ? "종일" : `${timeOfDay(start)} ~ ${timeOfDay(new Date(row.end))}`}
                      </span>
                    </span>
                    <CornerDownLeft className={cn("size-3.5 shrink-0 text-muted-foreground", !on && "invisible")} />
                  </button>
                </li>
              )
            })}
          </ul>
        </div>

        <div className="hidden items-center gap-4 border-t bg-muted/30 px-4 py-2 text-[11px] text-muted-foreground sm:flex">
          <span className="inline-flex items-center gap-1">
            <Kbd>↑</Kbd>
            <Kbd>↓</Kbd>
            이동
          </span>
          <span className="inline-flex items-center gap-1">
            <Kbd>Enter</Kbd>
            열기
          </span>
          <span className="inline-flex items-center gap-1">
            <Kbd>Esc</Kbd>
            닫기
          </span>
        </div>
      </div>
    </div>
  )
}

function Kbd({ children }: { children: React.ReactNode }) {
  return <kbd className="rounded border bg-background px-1 py-px font-mono text-[10px]">{children}</kbd>
}

/** 일치 부분 강조 */
function Highlight({ text, q }: { text: string; q: string }) {
  const term = q.trim().toLowerCase()
  if (!term) return <>{text}</>
  const lower = text.toLowerCase()
  const parts: { s: string; hit: boolean }[] = []
  let i = 0
  while (i < text.length) {
    const j = lower.indexOf(term, i)
    if (j < 0) {
      parts.push({ s: text.slice(i), hit: false })
      break
    }
    if (j > i) parts.push({ s: text.slice(i, j), hit: false })
    parts.push({ s: text.slice(j, j + term.length), hit: true })
    i = j + term.length
  }
  return (
    <>
      {parts.map((p, k) =>
        p.hit ? (
          <mark key={k} className="rounded-sm bg-amber-200/80 px-px text-inherit dark:bg-amber-400/30">
            {p.s}
          </mark>
        ) : (
          <Fragment key={k}>{p.s}</Fragment>
        ),
      )}
    </>
  )
}
