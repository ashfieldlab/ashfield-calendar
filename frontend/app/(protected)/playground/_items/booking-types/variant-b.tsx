"use client"

// 안 B: 카드 격자. 카드마다 큰 길이 표시와 예약 수, QR 은 카드가 뒤집히듯 그 자리에서 보인다.

import { useState } from "react"
import { ArrowLeft, Check, Clock, Download, Link2, Pencil, Plus, QrCode, Users } from "lucide-react"

import { useToast } from "@/components/ui-custom/use-toast"
import { cn } from "@/lib/utils"

import {
  QrImage,
  Switch,
  WorkspaceBadge,
  colorOf,
  downloadQr,
  durationText,
  iconBtn,
  nextText,
  publicUrl,
  shortUrl,
  useBookingTypes,
  useCopy,
  useQr,
  weeklySummary,
  type MockBookingType,
} from "./shared"

type Filter = "all" | "on" | "off"
const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "전체" },
  { key: "on", label: "켜짐" },
  { key: "off", label: "꺼짐" },
]

export function VariantB() {
  const { toast } = useToast()
  const { items, toggle } = useBookingTypes()
  const { copied, copy } = useCopy()
  const [filter, setFilter] = useState<Filter>("all")
  const [flipped, setFlipped] = useState<string | null>(null)

  const shown = items.filter((x) => (filter === "all" ? true : filter === "on" ? x.enabled : !x.enabled))
  const count = (f: Filter) => items.filter((x) => (f === "all" ? true : f === "on" ? x.enabled : !x.enabled)).length

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">예약 양식</h1>
          <div className="mt-3 inline-flex rounded-lg bg-muted p-0.5">
            {FILTERS.map((f) => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={cn(
                  "rounded-md px-3 py-1 text-sm transition-colors",
                  filter === f.key ? "bg-background font-medium shadow-sm" : "text-muted-foreground hover:text-foreground",
                )}
                data-testid={`pg-booking-types-b-filter-${f.key}`}
              >
                {f.label}
                <span className="ml-1.5 text-xs text-muted-foreground">{count(f.key)}</span>
              </button>
            ))}
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3" data-testid="pg-booking-types-b-list">
        {shown.map((bt) =>
          flipped === bt.id ? (
            <QrFace key={bt.id} bt={bt} onBack={() => setFlipped(null)} />
          ) : (
            <article
              key={bt.id}
              className={cn(
                "group relative flex flex-col overflow-hidden rounded-2xl border bg-card transition-shadow hover:shadow-md",
                !bt.enabled && "bg-muted/30",
              )}
              data-testid={`pg-booking-types-b-card-${bt.id}`}
            >
              <div className={cn("h-1.5", !bt.enabled && "opacity-30")} style={{ backgroundColor: colorOf(bt) }} />
              <div className="flex flex-1 flex-col p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className={cn("truncate text-base font-semibold", !bt.enabled && "text-muted-foreground")}>{bt.title}</h2>
                    <p className="mt-0.5 h-4 truncate text-xs text-muted-foreground">{bt.description}</p>
                  </div>
                  <Switch on={bt.enabled} onChange={() => toggle(bt.id)} testId={`pg-booking-types-b-card-${bt.id}-toggle`} />
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                  <span className="inline-flex items-center gap-1 font-medium">
                    <Clock className="size-3.5 text-muted-foreground" />
                    {durationText(bt.duration)}
                  </span>
                  {bt.capacity > 1 && (
                    <span className="inline-flex items-center gap-1 text-muted-foreground">
                      <Users className="size-3.5" />
                      {bt.capacity}명
                    </span>
                  )}
                  {bt.ownerType === "workspace" && <WorkspaceBadge />}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{weeklySummary(bt.weekly)}</p>

                <div className="mt-4 flex items-end justify-between rounded-xl bg-muted/50 px-3.5 py-2.5">
                  <div>
                    <div className="text-2xl font-semibold leading-none tabular-nums">{bt.upcoming}</div>
                    <div className="mt-1 text-[11px] text-muted-foreground">다가오는 예약</div>
                  </div>
                  <div className="text-right text-[11px] text-muted-foreground">
                    {bt.nextAt ? <>다음 {nextText(bt.nextAt)}</> : `30일 ${bt.last30}건`}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1 border-t px-3 py-2">
                <button
                  onClick={() => copy(bt.id, publicUrl(bt.publicKey))}
                  disabled={!bt.enabled}
                  className={cn(
                    "inline-flex flex-1 items-center gap-1.5 rounded-md px-2 py-1.5 text-sm font-medium text-primary hover:bg-primary/10 disabled:text-muted-foreground disabled:hover:bg-transparent dark:text-foreground",
                    copied === bt.id && "text-emerald-700 dark:text-emerald-400",
                  )}
                  data-testid={`pg-booking-types-b-card-${bt.id}-copy`}
                >
                  {copied === bt.id ? <Check className="size-4" /> : <Link2 className="size-4" />}
                  {copied === bt.id ? "복사됨" : "링크 복사"}
                </button>
                <button onClick={() => setFlipped(bt.id)} title="QR 코드" className={iconBtn} data-testid={`pg-booking-types-b-card-${bt.id}-qr`}>
                  <QrCode className="size-4" />
                </button>
                <button onClick={() => toast.info(`편집: ${bt.title}`)} title="편집" className={iconBtn} data-testid={`pg-booking-types-b-card-${bt.id}-edit`}>
                  <Pencil className="size-4" />
                </button>
              </div>
            </article>
          ),
        )}

        {filter !== "off" && (
          <button
            onClick={() => toast.info("새 양식")}
            className="flex min-h-56 flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed text-muted-foreground transition-colors hover:border-primary/50 hover:bg-muted/30 hover:text-foreground"
            data-testid="pg-booking-types-b-create"
          >
            <span className="grid size-10 place-items-center rounded-full bg-muted">
              <Plus className="size-5" />
            </span>
            <span className="text-sm font-medium">새 양식</span>
          </button>
        )}
      </div>
    </div>
  )
}

function QrFace({ bt, onBack }: { bt: MockBookingType; onBack: () => void }) {
  const url = publicUrl(bt.publicKey)
  const data = useQr(url)
  return (
    <article
      className="flex flex-col overflow-hidden rounded-2xl border bg-card shadow-md"
      data-testid={`pg-booking-types-b-card-${bt.id}-qrface`}
    >
      <div className="flex items-center gap-1 border-b px-2 py-1.5">
        <button onClick={onBack} className={iconBtn} data-testid={`pg-booking-types-b-card-${bt.id}-back`}>
          <ArrowLeft className="size-4" />
        </button>
        <span className="truncate text-sm font-medium">{bt.title}</span>
      </div>
      <div className="flex flex-1 flex-col items-center justify-center gap-3 p-4">
        <div className="rounded-xl border bg-card p-2">
          <QrImage url={url} className="size-36" />
        </div>
        <span className="max-w-full truncate font-mono text-[11px] text-muted-foreground">{shortUrl(bt.publicKey)}</span>
      </div>
      <div className="border-t px-3 py-2">
        <button
          onClick={() => downloadQr(data, bt.title)}
          disabled={!data}
          className="inline-flex w-full items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-sm font-medium hover:bg-muted disabled:opacity-50"
          data-testid={`pg-booking-types-b-card-${bt.id}-download`}
        >
          <Download className="size-4" /> PNG 다운로드
        </button>
      </div>
    </article>
  )
}
