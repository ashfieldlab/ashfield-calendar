"use client"

// 안 A: 커맨드 팔레트. 입력하는 즉시 결과, 위아래 키로 고르고 Enter 로 이동.

import { useMemo, useState } from "react"
import { CalendarRange, CornerDownLeft, History, Search, X } from "lucide-react"

import { useToast } from "@/components/ui-custom/use-toast"
import { cn } from "@/lib/utils"

import { NOW, calendarOf } from "../_mock"
import {
  FIELD_LABEL,
  Highlight,
  RECENT_QUERIES,
  SEARCH_ITEMS,
  formatDay,
  isPast,
  search,
  timeLabel,
  type SearchItem,
} from "./shared"

const T = "pg-search-a"

export function VariantA() {
  const { toast } = useToast()
  const [q, setQ] = useState("")
  const [showRange, setShowRange] = useState(false)
  const [from, setFrom] = useState("")
  const [to, setTo] = useState("")
  const [active, setActive] = useState(0)
  const [recent, setRecent] = useState(RECENT_QUERIES)

  const hits = useMemo(() => search(q, { from, to }), [q, from, to])
  const upcoming = useMemo(
    () => SEARCH_ITEMS.filter((e) => new Date(e.start) >= NOW).slice(0, 4),
    [],
  )
  const rows: { item: SearchItem; note?: string }[] = q.trim()
    ? hits.map((h) => ({ item: h.item, note: h.field !== "title" ? FIELD_LABEL[h.field] : undefined }))
    : upcoming.map((item) => ({ item }))
  const cur = Math.min(active, Math.max(rows.length - 1, 0))

  function open(item: SearchItem) {
    const term = q.trim()
    if (term) setRecent((r) => [term, ...r.filter((x) => x !== term)].slice(0, 5))
    toast.info(`${formatDay(item.start)} 일정으로 이동`)
  }

  function onKey(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault()
      setActive((i) => Math.min(i + 1, rows.length - 1))
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      setActive((i) => Math.max(i - 1, 0))
    } else if (e.key === "Enter" && rows[cur]) {
      e.preventDefault()
      open(rows[cur].item)
    } else if (e.key === "Escape") {
      if (q) setQ("")
      else toast("닫기")
    }
  }

  const rangeOn = !!(from || to)

  return (
    <div className="w-full max-w-[620px] overflow-hidden rounded-2xl border bg-popover text-popover-foreground shadow-2xl ring-1 ring-foreground/5">
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
          className={cn(
            "inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs font-medium transition-colors",
            rangeOn ? "border-primary/40 bg-primary/10 text-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground",
          )}
          data-testid={`${T}-range-button`}
        >
          <CalendarRange className="size-3.5" />
          {rangeOn ? `${from || "처음"} ~ ${to || "끝"}` : "기간"}
        </button>
      </div>

      {showRange && (
        <div className="flex items-center gap-2 border-t bg-muted/30 px-4 py-2 text-xs">
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="rounded-md border border-input bg-background px-2 py-1"
            data-testid={`${T}-from-input`}
          />
          <span className="text-muted-foreground">~</span>
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="rounded-md border border-input bg-background px-2 py-1"
            data-testid={`${T}-to-input`}
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

      <div className="max-h-[420px] overflow-y-auto border-t p-2" data-testid={`${T}-results`}>
        {!q.trim() && (
          <div className="px-2 pb-2 pt-1">
            <p className="mb-2 text-[11px] font-semibold text-muted-foreground">최근 검색</p>
            <div className="flex flex-wrap gap-1.5">
              {recent.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setQ(r)}
                  className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs hover:bg-muted/70"
                  data-testid={`${T}-recent-${r}`}
                >
                  <History className="size-3 text-muted-foreground" />
                  {r}
                </button>
              ))}
            </div>
          </div>
        )}

        {rows.length > 0 && (
          <p className="px-2 pb-1 pt-2 text-[11px] font-semibold text-muted-foreground">
            {q.trim() ? `일정 ${rows.length}` : "다가오는 일정"}
          </p>
        )}

        {q.trim() && rows.length === 0 && (
          <p className="py-10 text-center text-sm text-muted-foreground" data-testid={`${T}-empty`}>
            결과 없음
          </p>
        )}

        <ul>
          {rows.map(({ item, note }, i) => {
            const cal = calendarOf(item.calendarId)
            const on = i === cur
            return (
              <li key={item.id}>
                <button
                  type="button"
                  onMouseMove={() => setActive(i)}
                  onClick={() => open(item)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left",
                    on && "bg-accent text-accent-foreground",
                    isPast(item) && !on && "opacity-60",
                  )}
                  data-testid={`${T}-row-${item.id}`}
                >
                  <span className="h-8 w-1 shrink-0 rounded-full" style={{ backgroundColor: cal.color }} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">
                      <Highlight text={item.title} q={q} />
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {note ? (
                        <>
                          {note}: <Highlight text={(note === "장소" ? item.location : item.description) ?? ""} q={q} />
                        </>
                      ) : (
                        <>
                          {cal.name}
                          {item.location && `, ${item.location}`}
                        </>
                      )}
                    </span>
                  </span>
                  <span className="shrink-0 text-right text-xs tabular-nums text-muted-foreground">
                    <span className="block">{formatDay(item.start)}</span>
                    <span className="block">{timeLabel(item)}</span>
                  </span>
                  <CornerDownLeft className={cn("size-3.5 shrink-0 text-muted-foreground", !on && "invisible")} />
                </button>
              </li>
            )
          })}
        </ul>
      </div>

      <div className="flex items-center gap-4 border-t bg-muted/30 px-4 py-2 text-[11px] text-muted-foreground">
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
  )
}

function Kbd({ children }: { children: React.ReactNode }) {
  return <kbd className="rounded border bg-background px-1 py-px font-mono text-[10px]">{children}</kbd>
}
