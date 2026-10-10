"use client"

// 안 D: 소유별 묶음 + 펼치는 줄. 펼치면 주간 가능 시간 그림, 링크, QR 이 그 자리에 열린다.

import { useState } from "react"
import { Check, ChevronDown, Copy, Download, ExternalLink, Pencil, Plus } from "lucide-react"

import { useToast } from "@/components/ui-custom/use-toast"
import { cn } from "@/lib/utils"

import {
  ALL_DAYS,
  QrImage,
  Switch,
  calendarName,
  colorOf,
  dayLabel,
  downloadQr,
  durationText,
  nextText,
  publicUrl,
  shortUrl,
  useBookingTypes,
  useCopy,
  useQr,
  type MockBookingType,
} from "./shared"

const GROUPS: { key: "user" | "workspace"; label: string }[] = [
  { key: "user", label: "내 양식" },
  { key: "workspace", label: "워크스페이스" },
]

export function VariantD() {
  const { toast } = useToast()
  const { items, toggle } = useBookingTypes()
  const [open, setOpen] = useState<string | null>("bt1")

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">예약 양식</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            켜짐 {items.filter((x) => x.enabled).length}, 다가오는 예약 {items.reduce((n, x) => n + x.upcoming, 0)}건
          </p>
        </div>
        <button
          onClick={() => toast.info("새 양식")}
          className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          data-testid="pg-booking-types-d-create"
        >
          <Plus className="size-4" /> 새 양식
        </button>
      </header>

      {GROUPS.map((g) => {
        const list = items
          .filter((x) => x.ownerType === g.key)
          .sort((a, b) => Number(b.enabled) - Number(a.enabled))
        if (list.length === 0) return null
        return (
          <section key={g.key} className="space-y-2">
            <h2 className="px-1 text-xs font-semibold tracking-wide text-muted-foreground">{g.label}</h2>
            <div className="divide-y overflow-hidden rounded-2xl border bg-card" data-testid={`pg-booking-types-d-group-${g.key}`}>
              {list.map((bt) => (
                <Row
                  key={bt.id}
                  bt={bt}
                  open={open === bt.id}
                  onOpen={() => setOpen(open === bt.id ? null : bt.id)}
                  onToggle={() => toggle(bt.id)}
                  onEdit={() => toast.info(`편집: ${bt.title}`)}
                />
              ))}
            </div>
          </section>
        )
      })}
    </div>
  )
}

function Row({
  bt,
  open,
  onOpen,
  onToggle,
  onEdit,
}: {
  bt: MockBookingType
  open: boolean
  onOpen: () => void
  onToggle: () => void
  onEdit: () => void
}) {
  const { copied, copy } = useCopy()
  const url = publicUrl(bt.publicKey)
  return (
    <div className={cn(open && "bg-muted/20")} data-testid={`pg-booking-types-d-row-${bt.id}`}>
      <div className="flex items-center gap-3 px-4 py-3">
        <button
          onClick={onOpen}
          className="flex min-w-0 flex-1 items-center gap-3 text-left"
          data-testid={`pg-booking-types-d-row-${bt.id}-expand`}
        >
          <span className={cn("size-2.5 shrink-0 rounded-full", !bt.enabled && "opacity-30")} style={{ backgroundColor: colorOf(bt) }} />
          <div className="min-w-0 flex-1">
            <div className={cn("truncate font-medium", !bt.enabled && "text-muted-foreground")}>{bt.title}</div>
            <div className="truncate text-xs text-muted-foreground">
              {durationText(bt.duration)}
              {bt.capacity > 1 && `, ${bt.capacity}명`}
              {bt.upcoming > 0 && `, 예약 ${bt.upcoming}건`}
            </div>
          </div>
          <ChevronDown className={cn("size-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")} />
        </button>
        <button
          onClick={() => copy(bt.id, url)}
          disabled={!bt.enabled}
          className={cn(
            "hidden items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium hover:bg-muted disabled:opacity-40 sm:inline-flex",
            copied && "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400",
          )}
          data-testid={`pg-booking-types-d-row-${bt.id}-copy`}
        >
          {copied ? <Check className="size-3" /> : <Copy className="size-3" />}
          {copied ? "복사됨" : "링크"}
        </button>
        <Switch on={bt.enabled} onChange={onToggle} testId={`pg-booking-types-d-row-${bt.id}-toggle`} />
      </div>
      {open && <Expanded bt={bt} onEdit={onEdit} />}
    </div>
  )
}

const H_FROM = 8
const H_TO = 20
const toH = (t: string) => {
  const [h, m] = t.split(":").map(Number)
  return h + m / 60
}

function Expanded({ bt, onEdit }: { bt: MockBookingType; onEdit: () => void }) {
  const url = publicUrl(bt.publicKey)
  const data = useQr(url)
  const color = colorOf(bt)
  return (
    <div className="grid gap-5 px-4 pb-5 pl-[38px] sm:grid-cols-[1fr_auto]">
      <div className="space-y-4">
        <div>
          <div className="mb-1.5 text-xs text-muted-foreground">가능 시간</div>
          <div className="flex gap-1.5" data-testid={`pg-booking-types-d-row-${bt.id}-week`}>
            {ALL_DAYS.map((d) => (
              <div key={d} className="flex flex-1 flex-col items-center gap-1">
                <div className="relative h-20 w-full overflow-hidden rounded-md bg-muted">
                  {(bt.weekly[d] ?? []).map(([s, e], i) => (
                    <div
                      key={i}
                      className={cn("absolute inset-x-0.5 rounded-sm", !bt.enabled && "opacity-40")}
                      style={{
                        top: `${((toH(s) - H_FROM) / (H_TO - H_FROM)) * 100}%`,
                        height: `${((toH(e) - toH(s)) / (H_TO - H_FROM)) * 100}%`,
                        backgroundColor: color,
                      }}
                    />
                  ))}
                </div>
                <span className="text-[11px] text-muted-foreground">{dayLabel(d)}</span>
                <div className="flex flex-col items-center text-[10.5px] leading-4 tabular-nums">
                  {(bt.weekly[d] ?? []).length ? (
                    bt.weekly[d]!.map(([s, e], i) => (
                      <span key={i} className="whitespace-nowrap">
                        {s}~{e}
                      </span>
                    ))
                  ) : (
                    <span className="text-muted-foreground/60">-</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
        <dl className="grid grid-cols-3 gap-3 text-xs">
          <div>
            <dt className="text-muted-foreground">다음 예약</dt>
            <dd className="mt-0.5 font-medium">{nextText(bt.nextAt) ?? "-"}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">지난 30일</dt>
            <dd className="mt-0.5 font-medium">{bt.last30}건</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">캘린더</dt>
            <dd className="mt-0.5 truncate font-medium">{calendarName(bt)}</dd>
          </div>
        </dl>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={onEdit}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90"
            data-testid={`pg-booking-types-d-row-${bt.id}-edit`}
          >
            <Pencil className="size-3.5" /> 편집
          </button>
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-muted"
            data-testid={`pg-booking-types-d-row-${bt.id}-open`}
          >
            <ExternalLink className="size-3.5" /> 공개 페이지
          </a>
          <span className="truncate font-mono text-[11px] text-muted-foreground">{shortUrl(bt.publicKey)}</span>
        </div>
      </div>
      <div className="flex flex-col items-center gap-2">
        <div className="rounded-xl border bg-card p-2">
          <QrImage url={url} className="size-32" />
        </div>
        <button
          onClick={() => downloadQr(data, bt.title)}
          disabled={!data}
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground disabled:opacity-50"
          data-testid={`pg-booking-types-d-row-${bt.id}-download`}
        >
          <Download className="size-3.5" /> QR 저장
        </button>
      </div>
    </div>
  )
}
