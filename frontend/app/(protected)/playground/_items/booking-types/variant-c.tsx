"use client"

// 안 C: 목록 + 오른쪽 공유 패널. 고른 양식의 링크, QR, 재발급을 한곳에서.

import { useState } from "react"
import { Check, Copy, Download, ExternalLink, Pencil, Plus, RotateCw } from "lucide-react"

import { useToast } from "@/components/ui-custom/use-toast"
import { cn } from "@/lib/utils"

import {
  QrImage,
  StatusPill,
  Switch,
  WorkspaceBadge,
  calendarName,
  colorOf,
  downloadQr,
  durationText,
  nextText,
  publicUrl,
  useBookingTypes,
  useCopy,
  useQr,
  weeklySummary,
  type MockBookingType,
} from "./shared"

export function VariantC() {
  const { toast } = useToast()
  const { items, toggle, rotate } = useBookingTypes()
  const [selId, setSelId] = useState(items[0].id)
  const sel = items.find((x) => x.id === selId) ?? items[0]

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-5 lg:h-[calc(100vh-11rem)] lg:min-h-[560px]">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">예약 양식</h1>
        <button
          onClick={() => toast.info("새 양식")}
          className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          data-testid="pg-booking-types-c-create"
        >
          <Plus className="size-4" /> 새 양식
        </button>
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-1 overflow-hidden rounded-2xl border bg-card lg:grid-cols-[minmax(0,1fr)_400px]">
        <ul className="min-h-0 divide-y overflow-y-auto" data-testid="pg-booking-types-c-list">
          {items.map((bt) => (
            <li key={bt.id}>
              <button
                onClick={() => setSelId(bt.id)}
                className={cn(
                  "flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-muted/40",
                  sel.id === bt.id && "bg-muted/60 hover:bg-muted/60",
                )}
                data-testid={`pg-booking-types-c-row-${bt.id}`}
              >
                <span
                  className={cn("grid size-10 shrink-0 place-items-center rounded-xl text-xs font-semibold text-white", !bt.enabled && "opacity-40")}
                  style={{ backgroundColor: colorOf(bt) }}
                >
                  {bt.duration}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className={cn("truncate font-medium", !bt.enabled && "text-muted-foreground")}>{bt.title}</span>
                    {bt.ownerType === "workspace" && <WorkspaceBadge />}
                  </div>
                  <div className="truncate text-xs text-muted-foreground">{weeklySummary(bt.weekly)}</div>
                </div>
                <div className="hidden w-24 text-right sm:block">
                  <div className="text-sm font-medium tabular-nums">{bt.upcoming > 0 ? `${bt.upcoming}건` : "-"}</div>
                  <div className="text-[11px] text-muted-foreground">다가오는 예약</div>
                </div>
                <div className="w-14 text-right">
                  <StatusPill on={bt.enabled} />
                </div>
              </button>
            </li>
          ))}
        </ul>

        <SharePanel
          key={sel.id}
          bt={sel}
          onToggle={() => toggle(sel.id)}
          onRotate={() => {
            rotate(sel.id)
            toast.success("새 링크를 발급했습니다")
          }}
          onEdit={() => toast.info(`편집: ${sel.title}`)}
        />
      </div>
    </div>
  )
}

function SharePanel({
  bt,
  onToggle,
  onRotate,
  onEdit,
}: {
  bt: MockBookingType
  onToggle: () => void
  onRotate: () => void
  onEdit: () => void
}) {
  const url = publicUrl(bt.publicKey)
  const data = useQr(url)
  const { copied, copy } = useCopy()
  const [confirmRotate, setConfirmRotate] = useState(false)

  return (
    <aside className="flex min-h-0 flex-col overflow-y-auto border-t bg-muted/20 lg:border-l lg:border-t-0" data-testid="pg-booking-types-c-panel">
      <div className="flex items-start justify-between gap-3 p-5 pb-4">
        <div className="min-w-0">
          <h2 className="truncate text-lg font-semibold">{bt.title}</h2>
          <p className="text-xs text-muted-foreground">
            {durationText(bt.duration)}
            {bt.capacity > 1 && `, 최대 ${bt.capacity}명`}, {calendarName(bt)}
          </p>
        </div>
        <button
          onClick={onEdit}
          className="inline-flex shrink-0 items-center gap-1 rounded-md border bg-background px-2.5 py-1.5 text-xs font-medium hover:bg-muted"
          data-testid="pg-booking-types-c-edit"
        >
          <Pencil className="size-3.5" /> 편집
        </button>
      </div>

      <div className="mx-5 flex items-center justify-between rounded-xl border bg-background px-4 py-3">
        <div>
          <div className="text-sm font-medium">{bt.enabled ? "예약 받는 중" : "예약 안 받음"}</div>
          <div className="text-[11px] text-muted-foreground">
            {bt.nextAt ? `다음 ${nextText(bt.nextAt)}` : `30일 ${bt.last30}건`}
          </div>
        </div>
        <Switch on={bt.enabled} onChange={onToggle} testId="pg-booking-types-c-toggle" />
      </div>

      <div className={cn("flex flex-1 flex-col gap-4 p-5 transition-opacity", !bt.enabled && "opacity-50")}>
        <div className="space-y-1.5">
          <div className="text-xs font-medium text-muted-foreground">공개 링크</div>
          <div className="flex items-stretch overflow-hidden rounded-lg border bg-background">
            <input
              readOnly
              value={url}
              onFocus={(e) => e.currentTarget.select()}
              className="min-w-0 flex-1 bg-transparent px-3 py-2 font-mono text-xs outline-none"
              data-testid="pg-booking-types-c-url"
            />
            <button
              onClick={() => copy("url", url)}
              className={cn(
                "inline-flex shrink-0 items-center gap-1 border-l px-3 text-xs font-medium hover:bg-muted",
                copied && "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400",
              )}
              data-testid="pg-booking-types-c-copy"
            >
              {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
              {copied ? "복사됨" : "복사"}
            </button>
          </div>
          <div className="flex items-center gap-3 pt-1 text-xs">
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground"
              data-testid="pg-booking-types-c-open"
            >
              <ExternalLink className="size-3.5" /> 열기
            </a>
            {confirmRotate ? (
              <span className="inline-flex items-center gap-1.5">
                <span className="text-rose-600 dark:text-rose-400">기존 링크 무효</span>
                <button
                  onClick={() => {
                    onRotate()
                    setConfirmRotate(false)
                  }}
                  className="rounded bg-rose-600 px-2 py-0.5 font-medium text-white hover:bg-rose-700 dark:bg-rose-700 dark:hover:bg-rose-600"
                  data-testid="pg-booking-types-c-rotate-confirm"
                >
                  재발급
                </button>
                <button
                  onClick={() => setConfirmRotate(false)}
                  className="rounded px-1.5 py-0.5 text-muted-foreground hover:bg-muted"
                  data-testid="pg-booking-types-c-rotate-cancel"
                >
                  취소
                </button>
              </span>
            ) : (
              <button
                onClick={() => setConfirmRotate(true)}
                className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground"
                data-testid="pg-booking-types-c-rotate"
              >
                <RotateCw className="size-3.5" /> 재발급
              </button>
            )}
          </div>
        </div>

        <div className="space-y-1.5">
          <div className="text-xs font-medium text-muted-foreground">QR 코드</div>
          <div className="flex items-center gap-4 rounded-xl border bg-background p-3">
            <div className="rounded-lg border bg-card p-1.5">
              <QrImage url={url} className="size-28" />
            </div>
            <button
              onClick={() => downloadQr(data, bt.title)}
              disabled={!data}
              className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-muted disabled:opacity-50"
              data-testid="pg-booking-types-c-download"
            >
              <Download className="size-3.5" /> PNG
            </button>
          </div>
        </div>

        <dl className="grid grid-cols-2 gap-2 text-xs">
          <div className="rounded-lg border bg-background px-3 py-2">
            <dt className="text-muted-foreground">다가오는 예약</dt>
            <dd className="mt-0.5 text-lg font-semibold tabular-nums">{bt.upcoming}</dd>
          </div>
          <div className="rounded-lg border bg-background px-3 py-2">
            <dt className="text-muted-foreground">지난 30일</dt>
            <dd className="mt-0.5 text-lg font-semibold tabular-nums">{bt.last30}</dd>
          </div>
        </dl>
      </div>
    </aside>
  )
}
