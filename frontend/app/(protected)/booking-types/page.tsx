"use client"

// 예약 양식 목록: 소유별 묶음 + 펼치는 줄. 펼치면 요일별 가능 시간, 예약 통계, 링크, QR 이 그 자리에 열린다.

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import QRCode from "qrcode"
import { Check, ChevronDown, Copy, Download, ExternalLink, Pencil, Plus } from "lucide-react"

import { BookingSwitch, durationText } from "@/components/booking/booking-controls"
import { useToast } from "@/components/ui-custom/use-toast"
import { api } from "@/lib/api-client"
import { invalidateApi, useApiGet } from "@/lib/hooks/use-api"
import { cn } from "@/lib/utils"
import type { CalendarListResponse, CalendarResponse } from "@/lib/types/api"
import type { BookingTypeListItem, BookingTypeListResponse, WeeklySchedule } from "@/lib/types/booking"

const LIST_URL = "/api/v1/booking-types"

const GROUPS: { key: "user" | "workspace"; label: string }[] = [
  { key: "user", label: "내 양식" },
  { key: "workspace", label: "워크스페이스" },
]

type DayKey = keyof WeeklySchedule
const DAYS: { key: DayKey; label: string }[] = [
  { key: "mon", label: "월" },
  { key: "tue", label: "화" },
  { key: "wed", label: "수" },
  { key: "thu", label: "목" },
  { key: "fri", label: "금" },
  { key: "sat", label: "토" },
  { key: "sun", label: "일" },
]

function publicUrl(publicKey: string): string {
  if (typeof window === "undefined") return `/book/${publicKey}`
  return `${window.location.origin}/book/${publicKey}`
}

const shortUrl = (key: string) => publicUrl(key).replace(/^https?:\/\//, "")

/** 오늘 오전 11:00, 내일 ..., 10/12 (월) 오전 11:00 */
function nextText(iso: string | null): string | null {
  if (!iso) return null
  const t = new Date(iso)
  const WD = ["일", "월", "화", "수", "목", "금", "토"]
  const today = new Date()
  const days = Math.round(
    (new Date(t.getFullYear(), t.getMonth(), t.getDate()).getTime() -
      new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()) /
      86400000,
  )
  const time = t.toLocaleTimeString("ko-KR", { hour: "numeric", minute: "2-digit" })
  if (days === 0) return `오늘 ${time}`
  if (days === 1) return `내일 ${time}`
  return `${t.getMonth() + 1}/${t.getDate()} (${WD[t.getDay()]}) ${time}`
}

function useQr(url: string | null) {
  const [state, setState] = useState<{ url: string; data: string } | null>(null)
  useEffect(() => {
    if (!url) return
    let aborted = false
    QRCode.toDataURL(url, { width: 512, margin: 1 })
      .then((d) => !aborted && setState({ url, data: d }))
      .catch(() => undefined)
    return () => {
      aborted = true
    }
  }, [url])
  return state && state.url === url ? state.data : null
}

function downloadQr(dataUrl: string | null, title: string) {
  if (!dataUrl) return
  const a = document.createElement("a")
  a.href = dataUrl
  a.download = `${title.replace(/[^a-z0-9가-힣]+/gi, "_")}_qr.png`
  a.click()
}

export default function BookingTypesPage() {
  const { toast } = useToast()
  const { data, error, isLoading, mutate } = useApiGet<BookingTypeListResponse>(LIST_URL)
  const { data: calData } = useApiGet<CalendarListResponse>("/api/v1/calendars")
  const [open, setOpen] = useState<string | null>(null)
  const [pending, setPending] = useState<Record<string, boolean>>({})

  const items = (data?.items ?? []).map((x) => (x.id in pending ? { ...x, enabled: pending[x.id] } : x))
  const calendars = calData?.calendars ?? []

  async function toggle(bt: BookingTypeListItem) {
    const next = !bt.enabled
    setPending((p) => ({ ...p, [bt.id]: next }))
    try {
      await api(`${LIST_URL}/${bt.id}`, { method: "PATCH", body: { enabled: next } })
      toast.success(next ? `${bt.title}: 켜짐` : `${bt.title}: 꺼짐`)
      await mutate()
      invalidateApi(`${LIST_URL}/${bt.id}`)
    } catch (e) {
      toast.error(`실패: ${(e as Error).message}`)
    } finally {
      setPending((p) => {
        const { [bt.id]: _drop, ...rest } = p
        void _drop
        return rest
      })
    }
  }

  return (
    <div className="h-full overflow-y-auto px-4 py-8 sm:px-6 lg:px-8" data-testid="booking-types-page">
      <div className="mx-auto max-w-4xl space-y-8">
        <header className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-foreground">예약 양식</h1>
            {items.length > 0 && (
              <p className="mt-1 text-sm text-muted-foreground" data-testid="booking-types-summary">
                켜짐 {items.filter((x) => x.enabled).length}, 다가오는 예약{" "}
                {items.reduce((n, x) => n + x.upcoming_count, 0)}건
              </p>
            )}
          </div>
          <Link
            href="/booking-types/new"
            data-testid="booking-types-create"
            className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            <Plus className="size-4" /> 새 양식
          </Link>
        </header>

        {error ? (
          <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300">
            불러오지 못했습니다. 잠시 후 다시 시도해주세요.
          </div>
        ) : isLoading ? (
          <p className="text-sm text-muted-foreground">불러오는 중…</p>
        ) : items.length === 0 ? (
          <div
            className="rounded-2xl border border-dashed border-input p-10 text-center text-sm text-muted-foreground"
            data-testid="booking-types-empty"
          >
            예약 양식이 없습니다
          </div>
        ) : (
          <div className="space-y-8" data-testid="booking-types-list">
            {GROUPS.map((g) => {
              const list = items
                .filter((x) => x.owner_type === g.key)
                .sort((a, b) => Number(b.enabled) - Number(a.enabled))
              if (list.length === 0) return null
              return (
                <section key={g.key} className="space-y-2">
                  <h2 className="px-1 text-xs font-semibold tracking-wide text-muted-foreground">{g.label}</h2>
                  <div
                    className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card"
                    data-testid={`booking-types-group-${g.key}`}
                  >
                    {list.map((bt) => (
                      <Row
                        key={bt.id}
                        bt={bt}
                        calendar={calendars.find((c) => c.id === bt.target_calendar_id)}
                        open={open === bt.id}
                        onOpen={() => setOpen(open === bt.id ? null : bt.id)}
                        onToggle={() => toggle(bt)}
                        busy={bt.id in pending}
                      />
                    ))}
                  </div>
                </section>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

function useCopy() {
  const { toast } = useToast()
  const [copied, setCopied] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current)
    },
    [],
  )
  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text)
    } catch {
      toast.error("복사 실패")
      return
    }
    setCopied(true)
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => setCopied(false), 1600)
  }
  return { copied, copy }
}

function Row({
  bt,
  calendar,
  open,
  onOpen,
  onToggle,
  busy,
}: {
  bt: BookingTypeListItem
  calendar: CalendarResponse | undefined
  open: boolean
  onOpen: () => void
  onToggle: () => void
  busy: boolean
}) {
  const { copied, copy } = useCopy()
  const color = calendar ? (calendar.color_override ?? calendar.color) : "#6b7280"
  return (
    <div className={cn(open && "bg-muted/20")} data-testid={`booking-types-row-${bt.id}`}>
      <div className="flex items-center gap-3 px-4 py-3">
        <button
          type="button"
          onClick={onOpen}
          aria-expanded={open}
          className="flex min-w-0 flex-1 items-center gap-3 text-left"
          data-testid={`booking-types-row-${bt.id}-expand`}
        >
          <span
            className={cn("size-2.5 shrink-0 rounded-full", !bt.enabled && "opacity-30")}
            style={{ backgroundColor: color }}
          />
          <div className="min-w-0 flex-1">
            <div className={cn("truncate font-medium", !bt.enabled && "text-muted-foreground")}>{bt.title}</div>
            <div className="truncate text-xs text-muted-foreground">
              {durationText(bt.duration_minutes)}
              {bt.capacity > 1 && `, ${bt.capacity}명`}
              {bt.upcoming_count > 0 && `, 예약 ${bt.upcoming_count}건`}
            </div>
          </div>
          <ChevronDown
            className={cn("size-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")}
          />
        </button>
        <button
          type="button"
          onClick={() => copy(publicUrl(bt.public_key))}
          disabled={!bt.enabled}
          className={cn(
            "hidden items-center gap-1 rounded-full border border-border px-2.5 py-1 text-xs font-medium hover:bg-muted disabled:opacity-40 sm:inline-flex",
            copied &&
              "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400",
          )}
          data-testid={`booking-types-row-${bt.id}-copy`}
        >
          {copied ? <Check className="size-3" /> : <Copy className="size-3" />}
          {copied ? "복사됨" : "링크"}
        </button>
        <BookingSwitch
          on={bt.enabled}
          onChange={onToggle}
          disabled={busy}
          tone="success"
          label="켜기"
          testId={`booking-types-row-${bt.id}-toggle`}
        />
      </div>
      {open && <Expanded bt={bt} color={color} calendarName={calendar?.name ?? "-"} />}
    </div>
  )
}

const H_FROM = 8
const H_TO = 20
const toH = (t: string) => {
  const [h, m] = t.split(":").map(Number)
  return h + m / 60
}

function Expanded({ bt, color, calendarName }: { bt: BookingTypeListItem; color: string; calendarName: string }) {
  const url = publicUrl(bt.public_key)
  const qr = useQr(url)
  const ws = bt.weekly_schedule
  // 막대 범위: 기본 08~20시, 블록이 밖에 있으면 넓힌다
  const all = DAYS.flatMap((d) => ws[d.key] ?? [])
  const from = Math.min(H_FROM, ...all.map(([s]) => Math.floor(toH(s))))
  const to = Math.max(H_TO, ...all.map(([, e]) => Math.ceil(toH(e))))
  return (
    <div className="grid gap-5 px-4 pb-5 sm:grid-cols-[1fr_auto] sm:pl-[38px]" data-testid={`booking-types-row-${bt.id}-detail`}>
      <div className="min-w-0 space-y-4">
        <div>
          <div className="mb-1.5 text-xs text-muted-foreground">가능 시간</div>
          <div className="flex gap-1 sm:gap-1.5" data-testid={`booking-types-row-${bt.id}-week`}>
            {DAYS.map(({ key, label }) => {
              const blocks = ws[key] ?? []
              return (
                <div key={key} className="flex min-w-0 flex-1 flex-col items-center gap-1">
                  <div className="relative h-20 w-full overflow-hidden rounded-md bg-muted">
                    {blocks.map(([s, e], i) => (
                      <div
                        key={i}
                        className={cn("absolute inset-x-0.5 rounded-sm", !bt.enabled && "opacity-40")}
                        style={{
                          top: `${((toH(s) - from) / (to - from)) * 100}%`,
                          height: `${((toH(e) - toH(s)) / (to - from)) * 100}%`,
                          backgroundColor: color,
                        }}
                      />
                    ))}
                  </div>
                  <span className="text-[11px] text-muted-foreground">{label}</span>
                  <div className="flex flex-col items-center text-[10.5px] leading-4 tabular-nums">
                    {blocks.length ? (
                      blocks.map(([s, e], i) => (
                        <span key={i} className="whitespace-nowrap max-sm:text-[9px]">
                          {s}~{e}
                        </span>
                      ))
                    ) : (
                      <span className="text-muted-foreground/60">-</span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
        <dl className="grid grid-cols-3 gap-3 text-xs">
          <div>
            <dt className="text-muted-foreground">다음 예약</dt>
            <dd className="mt-0.5 font-medium" data-testid={`booking-types-row-${bt.id}-next`}>
              {nextText(bt.next_booking_at) ?? "-"}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">지난 30일</dt>
            <dd className="mt-0.5 font-medium" data-testid={`booking-types-row-${bt.id}-last30`}>
              {bt.last_30d_count}건
            </dd>
          </div>
          <div className="min-w-0">
            <dt className="text-muted-foreground">캘린더</dt>
            <dd className="mt-0.5 truncate font-medium">{calendarName}</dd>
          </div>
        </dl>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={`/booking-types/${bt.id}`}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90"
            data-testid={`booking-types-row-${bt.id}-link`}
          >
            <Pencil className="size-3.5" /> 편집
          </Link>
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted"
            data-testid={`booking-types-row-${bt.id}-open`}
          >
            <ExternalLink className="size-3.5" /> 공개 페이지
          </a>
          <span className="min-w-0 truncate font-mono text-[11px] text-muted-foreground">{shortUrl(bt.public_key)}</span>
        </div>
      </div>
      <div className="flex flex-col items-center gap-2">
        <div className="rounded-xl border border-border bg-card p-2">
          {qr ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={qr} alt="QR" className="size-32 rounded-md" data-testid={`booking-types-row-${bt.id}-qr`} />
          ) : (
            <div className="size-32 animate-pulse rounded-md bg-muted" />
          )}
        </div>
        <button
          type="button"
          onClick={() => downloadQr(qr, bt.title)}
          disabled={!qr}
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground disabled:opacity-50"
          data-testid={`booking-types-row-${bt.id}-download`}
        >
          <Download className="size-3.5" /> QR 저장
        </button>
      </div>
    </div>
  )
}
