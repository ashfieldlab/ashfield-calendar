"use client"

// 안 A: 원본 표를 다듬은 버전. 한 줄에 켜기/끄기, 예약 수, 공유 아이콘. QR 은 모달.

import { useState } from "react"
import { CalendarClock, Check, Copy, Download, ExternalLink, Pencil, Plus, QrCode, X } from "lucide-react"

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

export function VariantA() {
  const { toast } = useToast()
  const { items, toggle } = useBookingTypes()
  const { copied, copy } = useCopy()
  const [qrFor, setQrFor] = useState<MockBookingType | null>(null)

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CalendarClock className="size-5 text-muted-foreground" />
          <h1 className="text-2xl font-bold">예약 양식</h1>
          <span className="ml-1 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">{items.length}</span>
        </div>
        <button
          onClick={() => toast.info("새 양식")}
          className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          data-testid="pg-booking-types-a-create"
        >
          <Plus className="size-4" /> 새 양식
        </button>
      </header>

      <div className="overflow-x-auto rounded-xl border bg-card">
        <table className="w-full text-sm" data-testid="pg-booking-types-a-list">
          <thead className="border-b bg-muted/40 text-left text-xs text-muted-foreground">
            <tr>
              <th className="w-14 px-4 py-2.5 font-medium">켜짐</th>
              <th className="px-2 py-2.5 font-medium">양식</th>
              <th className="px-4 py-2.5 font-medium">가능 시간</th>
              <th className="w-40 px-4 py-2.5 font-medium">예약</th>
              <th className="px-4 py-2.5 font-medium">공개 링크</th>
              <th className="w-28" />
            </tr>
          </thead>
          <tbody className="divide-y">
            {items.map((bt) => (
              <tr
                key={bt.id}
                className={cn("group transition-colors hover:bg-muted/40", !bt.enabled && "text-muted-foreground")}
                data-testid={`pg-booking-types-a-row-${bt.id}`}
              >
                <td className="px-4 py-3">
                  <Switch on={bt.enabled} onChange={() => toggle(bt.id)} testId={`pg-booking-types-a-row-${bt.id}-toggle`} />
                </td>
                <td className="px-2 py-3">
                  <div className="flex items-center gap-2.5">
                    <span className={cn("h-8 w-1 rounded-full", !bt.enabled && "opacity-40")} style={{ backgroundColor: colorOf(bt) }} />
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => toast.info(`편집: ${bt.title}`)}
                          className={cn("truncate font-medium hover:underline", bt.enabled && "text-foreground")}
                          data-testid={`pg-booking-types-a-row-${bt.id}-title`}
                        >
                          {bt.title}
                        </button>
                        {bt.ownerType === "workspace" && <WorkspaceBadge />}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {durationText(bt.duration)}
                        {bt.capacity > 1 && `, 최대 ${bt.capacity}명`}
                      </div>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 text-xs text-muted-foreground">{weeklySummary(bt.weekly)}</td>
                <td className="px-4 py-3">
                  {bt.upcoming > 0 ? (
                    <div>
                      <span className="font-medium text-foreground">{bt.upcoming}건</span>
                      <div className="text-[11px] text-muted-foreground">다음 {nextText(bt.nextAt)}</div>
                    </div>
                  ) : (
                    <span className="text-xs text-muted-foreground">없음</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => copy(bt.id, publicUrl(bt.publicKey))}
                    disabled={!bt.enabled}
                    className={cn(
                      "inline-flex max-w-full items-center gap-1.5 rounded-md bg-muted px-2 py-1 font-mono text-[11px] text-foreground/80 hover:bg-muted/70 disabled:line-through disabled:opacity-60",
                      copied === bt.id && "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
                    )}
                    data-testid={`pg-booking-types-a-row-${bt.id}-url`}
                  >
                    {copied === bt.id ? <Check className="size-3" /> : <Copy className="size-3" />}
                    <span className="truncate">{copied === bt.id ? "복사됨" : shortUrl(bt.publicKey)}</span>
                  </button>
                </td>
                <td className="px-3 py-3">
                  <div className="flex justify-end opacity-70 group-hover:opacity-100">
                    <button onClick={() => setQrFor(bt)} title="QR 코드" className={iconBtn} data-testid={`pg-booking-types-a-row-${bt.id}-qr`}>
                      <QrCode className="size-4" />
                    </button>
                    <a href={publicUrl(bt.publicKey)} target="_blank" rel="noopener noreferrer" title="공개 페이지" className={iconBtn} data-testid={`pg-booking-types-a-row-${bt.id}-open`}>
                      <ExternalLink className="size-4" />
                    </a>
                    <button onClick={() => toast.info(`편집: ${bt.title}`)} title="편집" className={iconBtn} data-testid={`pg-booking-types-a-row-${bt.id}-edit`}>
                      <Pencil className="size-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {qrFor && <QrModal bt={qrFor} onClose={() => setQrFor(null)} />}
    </div>
  )
}

function QrModal({ bt, onClose }: { bt: MockBookingType; onClose: () => void }) {
  const url = publicUrl(bt.publicKey)
  const data = useQr(url)
  const { copied, copy } = useCopy()
  return (
    <div className="fixed inset-0 z-40 grid place-items-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="w-full max-w-sm overflow-hidden rounded-2xl border bg-card shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        data-testid="pg-booking-types-a-qr-modal"
      >
        <div className="flex items-center justify-between px-5 pt-4">
          <h3 className="truncate text-sm font-semibold">{bt.title}</h3>
          <button onClick={onClose} className={iconBtn} data-testid="pg-booking-types-a-qr-close">
            <X className="size-4" />
          </button>
        </div>
        <div className="flex flex-col items-center gap-4 px-6 pb-6 pt-2">
          <div className="rounded-xl border bg-card p-3">
            <QrImage url={url} className="size-56" />
          </div>
          <div className="flex w-full items-center gap-1 rounded-lg border bg-muted/40 p-1 pl-3">
            <span className="flex-1 truncate font-mono text-xs text-muted-foreground">{shortUrl(bt.publicKey)}</span>
            <button
              onClick={() => copy("m", url)}
              className="inline-flex items-center gap-1 rounded-md bg-background px-2.5 py-1.5 text-xs font-medium shadow-sm hover:bg-muted"
              data-testid="pg-booking-types-a-qr-copy"
            >
              {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
              {copied ? "복사됨" : "복사"}
            </button>
          </div>
          <button
            onClick={() => downloadQr(data, bt.title)}
            disabled={!data}
            className="inline-flex w-full items-center justify-center gap-1.5 rounded-md bg-primary py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            data-testid="pg-booking-types-a-qr-download"
          >
            <Download className="size-4" /> PNG 다운로드
          </button>
        </div>
      </div>
    </div>
  )
}
