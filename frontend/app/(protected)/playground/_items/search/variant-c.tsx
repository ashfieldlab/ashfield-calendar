"use client"

// 안 C: 필터 칩. 캘린더, 기간, 찾을 곳을 칩으로 좁히고 결과는 카드 격자.

import { useMemo, useState } from "react"
import { Check, MapPin, Search, X } from "lucide-react"

import { useToast } from "@/components/ui-custom/use-toast"
import { cn } from "@/lib/utils"

import { CALENDARS, calendarOf } from "../_mock"
import {
  FIELD_LABEL,
  Highlight,
  isPast,
  search,
  shiftDay,
  timeLabel,
  type Field,
  type Hit,
} from "./shared"

const T = "pg-search-c"
const WD = ["일", "월", "화", "수", "목", "금", "토"]

type Range = "all" | "past30" | "month" | "next30" | "custom"

const RANGE_LABEL: Record<Range, string> = {
  all: "전체 기간",
  past30: "지난 30일",
  month: "이번 달",
  next30: "앞으로 30일",
  custom: "직접 지정",
}

function rangeDates(r: Range, from: string, to: string) {
  switch (r) {
    case "past30":
      return { from: shiftDay(-30), to: shiftDay(0) }
    case "month":
      return { from: "2026-10-01", to: "2026-10-31" }
    case "next30":
      return { from: shiftDay(0), to: shiftDay(30) }
    case "custom":
      return { from, to }
    default:
      return {}
  }
}

const ALL_FIELDS: Field[] = ["title", "location", "description"]

export function VariantC() {
  const { toast } = useToast()
  const [q, setQ] = useState("리뷰")
  const [cals, setCals] = useState<Set<string>>(new Set())
  const [range, setRange] = useState<Range>("all")
  const [from, setFrom] = useState("")
  const [to, setTo] = useState("")
  const [fields, setFields] = useState<Set<Field>>(new Set(ALL_FIELDS))

  const hits = useMemo(
    () => search(q, { ...rangeDates(range, from, to), calendars: cals, fields }),
    [q, range, from, to, cals, fields],
  )
  const filtered = cals.size > 0 || range !== "all" || fields.size < ALL_FIELDS.length

  const toggleCal = (id: string) =>
    setCals((s) => {
      const n = new Set(s)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })
  const toggleField = (f: Field) =>
    setFields((s) => {
      const n = new Set(s)
      if (n.has(f)) {
        if (n.size > 1) n.delete(f)
      } else n.add(f)
      return n
    })
  const reset = () => {
    setCals(new Set())
    setRange("all")
    setFrom("")
    setTo("")
    setFields(new Set(ALL_FIELDS))
  }

  return (
    <div className="flex max-h-[680px] w-full max-w-[720px] flex-col overflow-hidden rounded-2xl border bg-background shadow-2xl">
      <div className="flex items-center gap-3 border-b px-5">
        <Search className="size-5 text-muted-foreground" />
        <input
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="일정 검색"
          className="h-14 min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-muted-foreground/70"
          data-testid={`${T}-input`}
        />
        <button
          type="button"
          onClick={() => toast("닫기")}
          className="rounded-full p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
          aria-label="닫기"
          data-testid={`${T}-close-button`}
        >
          <X className="size-4" />
        </button>
      </div>

      <div className="space-y-2.5 border-b bg-muted/30 px-5 py-3.5">
        <ChipRow label="캘린더">
          {CALENDARS.map((c) => {
            const on = cals.has(c.id)
            return (
              <Chip key={c.id} on={on} onClick={() => toggleCal(c.id)} testid={`${T}-cal-${c.id}`}>
                <span className="size-2 rounded-full" style={{ backgroundColor: c.color }} />
                {c.name}
              </Chip>
            )
          })}
        </ChipRow>
        <ChipRow label="기간">
          {(Object.keys(RANGE_LABEL) as Range[]).map((r) => (
            <Chip key={r} on={range === r} onClick={() => setRange(r)} testid={`${T}-range-${r}`}>
              {RANGE_LABEL[r]}
            </Chip>
          ))}
          {range === "custom" && (
            <span className="inline-flex items-center gap-1.5 text-xs">
              <input
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                className="rounded-md border border-input bg-background px-2 py-0.5"
                data-testid={`${T}-from-input`}
              />
              ~
              <input
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                className="rounded-md border border-input bg-background px-2 py-0.5"
                data-testid={`${T}-to-input`}
              />
            </span>
          )}
        </ChipRow>
        <ChipRow label="찾을 곳">
          {ALL_FIELDS.map((f) => (
            <Chip key={f} on={fields.has(f)} onClick={() => toggleField(f)} testid={`${T}-field-${f}`} check>
              {FIELD_LABEL[f]}
            </Chip>
          ))}
        </ChipRow>
      </div>

      <div className="flex items-center gap-2 px-5 pb-1 pt-3 text-xs text-muted-foreground">
        <span className="font-medium tabular-nums" data-testid={`${T}-count`}>
          {q.trim() ? `${hits.length}건` : ""}
        </span>
        {filtered && (
          <button type="button" onClick={reset} className="ml-auto hover:text-foreground" data-testid={`${T}-reset-button`}>
            필터 초기화
          </button>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-5 pt-2" data-testid={`${T}-results`}>
        {!q.trim() ? (
          <p className="py-12 text-center text-sm text-muted-foreground">검색어 입력</p>
        ) : hits.length === 0 ? (
          <div className="py-12 text-center text-sm text-muted-foreground" data-testid={`${T}-empty`}>
            결과 없음
          </div>
        ) : (
          <div className="grid gap-2.5 sm:grid-cols-2">
            {hits.map((h) => (
              <ResultCard key={h.item.id} h={h} q={q} onOpen={() => toast.info(`${h.item.title}: 달력에서 열기`)} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function ResultCard({ h, q, onOpen }: { h: Hit; q: string; onOpen: () => void }) {
  const { item } = h
  const cal = calendarOf(item.calendarId)
  const d = new Date(item.start)
  const past = isPast(item)
  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn(
        "group flex gap-3 rounded-xl border bg-card p-3 text-left transition-all hover:border-foreground/20 hover:shadow-md",
        past && "bg-muted/30",
      )}
      data-testid={`${T}-card-${item.id}`}
    >
      <div
        className={cn("flex w-11 shrink-0 flex-col items-center rounded-lg py-1.5", past ? "bg-muted text-muted-foreground" : "text-white")}
        style={past ? undefined : { backgroundColor: cal.color }}
      >
        <span className="text-[10px] font-medium opacity-90">{d.getMonth() + 1}월</span>
        <span className="text-lg font-bold leading-tight tabular-nums">{d.getDate()}</span>
        <span className="text-[10px] font-medium opacity-90">{WD[d.getDay()]}</span>
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">
          <Highlight text={item.title} q={q} />
        </p>
        <p className="mt-0.5 truncate text-xs text-muted-foreground">
          {timeLabel(item)}, {cal.name}
        </p>
        {h.field === "location" && item.location ? (
          <p className="mt-1.5 flex items-center gap-1 truncate text-xs">
            <MapPin className="size-3 shrink-0 text-muted-foreground" />
            <Highlight text={item.location} q={q} />
          </p>
        ) : h.field === "description" && item.description ? (
          <p className="mt-1.5 line-clamp-2 text-xs">
            <span className="mr-1 rounded bg-muted px-1 py-px text-[10px] text-muted-foreground">설명</span>
            <Highlight text={item.description} q={q} />
          </p>
        ) : item.location ? (
          <p className="mt-1.5 flex items-center gap-1 truncate text-xs text-muted-foreground">
            <MapPin className="size-3 shrink-0" />
            {item.location}
          </p>
        ) : null}
      </div>
    </button>
  )
}

function ChipRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <span className="w-12 shrink-0 pt-1 text-xs font-medium text-muted-foreground">{label}</span>
      <div className="flex flex-1 flex-wrap items-center gap-1.5">{children}</div>
    </div>
  )
}

function Chip({
  on,
  onClick,
  testid,
  check,
  children,
}: {
  on: boolean
  onClick: () => void
  testid: string
  check?: boolean
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
        on ? "border-foreground/80 bg-foreground text-background" : "border-input bg-background text-foreground hover:bg-muted",
      )}
      data-testid={testid}
    >
      {check && on && <Check className="size-3" />}
      {children}
    </button>
  )
}
