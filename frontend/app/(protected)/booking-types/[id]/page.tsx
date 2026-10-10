"use client"

import { use, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  ArrowLeft,
  CalendarClock,
  Copy,
  ExternalLink,
  QrCode,
  RotateCw,
  Trash2,
  XCircle,
} from "lucide-react"
import { useToast } from "@/components/ui-custom/use-toast"

import { BookingSwitch } from "@/components/booking/booking-controls"
import { BookingTypeForm } from "@/components/booking/booking-type-form"
import { QrModal } from "@/components/booking/qr-modal"
import { RescheduleModal } from "@/components/booking/reschedule-modal"
import { api } from "@/lib/api-client"
import { useConfirm } from "@/components/ui-custom/use-confirm"
import { invalidateApi, useApiGet } from "@/lib/hooks/use-api"
import type {
  BookingListResponse,
  BookingRow,
  BookingTypeCreate,
  BookingTypeResponse,
} from "@/lib/types/booking"
import { cn } from "@/lib/utils"
import { formatDateTime } from "@/lib/utils/format"

function publicUrl(publicKey: string): string {
  if (typeof window === "undefined") return `/book/${publicKey}`
  return `${window.location.origin}/book/${publicKey}`
}

export default function BookingTypeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const router = useRouter()
  const { toast } = useToast()
  const confirm = useConfirm()
  const [busy, setBusy] = useState(false)
  const [showQr, setShowQr] = useState(false)
  const [rescheduling, setRescheduling] = useState<BookingRow | null>(null)

  const url = `/api/v1/booking-types/${id}`
  const { data: bt, error, isLoading } = useApiGet<BookingTypeResponse>(url)
  const { data: bookings, mutate: mutateBookings } =
    useApiGet<BookingListResponse>(`/api/v1/booking-types/${id}/bookings`)

  async function save(body: BookingTypeCreate): Promise<boolean> {
    setBusy(true)
    try {
      // owner_type 은 PATCH 에서 보내지 않음 (생성 시 결정)
      const { owner_type: _ot, ...patch } = body
      void _ot
      await api(url, { method: "PATCH", body: patch })
      toast.success("저장했습니다")
      invalidateApi(url)
      invalidateApi("/api/v1/booking-types")
      return true
    } catch (e) {
      toast.error(`저장 실패: ${(e as Error).message}`)
      return false
    } finally {
      setBusy(false)
    }
  }

  async function toggleEnabled(next: boolean) {
    try {
      await api(url, { method: "PATCH", body: { enabled: next } })
      toast.success(next ? "켰습니다" : "껐습니다")
      invalidateApi(url)
      invalidateApi("/api/v1/booking-types")
    } catch (e) {
      toast.error(`실패: ${(e as Error).message}`)
    }
  }

  async function copyLink() {
    if (!bt) return
    try {
      await navigator.clipboard.writeText(publicUrl(bt.public_key))
      toast.success("공개 URL을 복사했습니다")
    } catch {
      toast.error("복사 실패")
    }
  }

  async function rotateKey() {
    if (!bt) return
    if (
      !(await confirm({
        title: "공개 URL 재발급",
        description: "기존 공개 URL 은 즉시 무효화됩니다.",
        confirmText: "재발급",
        variant: "destructive",
      }))
    )
      return
    setBusy(true)
    try {
      await api(`${url}/rotate-key`, { method: "POST" })
      toast.success("공개 URL을 재발급했습니다")
      invalidateApi(url)
    } catch (e) {
      toast.error(`실패: ${(e as Error).message}`)
    } finally {
      setBusy(false)
    }
  }

  async function deleteBT() {
    if (!(await confirm({ title: "예약 양식 삭제", description: "이 예약 양식을 삭제하시겠습니까? 공개 URL 이 무효화됩니다.", confirmText: "삭제", variant: "destructive" }))) return
    setBusy(true)
    try {
      await api(url, { method: "DELETE" })
      toast.success("삭제했습니다")
      invalidateApi("/api/v1/booking-types")
      router.push("/booking-types")
    } catch (e) {
      toast.error(`삭제 실패: ${(e as Error).message}`)
    } finally {
      setBusy(false)
    }
  }

  async function cancelBooking(bookingId: string) {
    if (!(await confirm({ title: "예약 취소", description: "이 예약을 취소하시겠습니까? 고객에게 알림 메일이 발송됩니다.", confirmText: "예약 취소", variant: "destructive" }))) return
    try {
      await api(`${url}/bookings/${bookingId}/cancel`, { method: "POST" })
      toast.success("예약을 취소했습니다")
      void mutateBookings()
    } catch (e) {
      toast.error(`취소 실패: ${(e as Error).message}`)
    }
  }

  if (error) {
    return (
      <div className="m-4 rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300">
        불러오지 못했습니다. 잠시 후 다시 시도해주세요.
      </div>
    )
  }
  if (isLoading || !bt) {
    return <p className="p-8 text-sm text-muted-foreground">불러오는 중…</p>
  }

  const items = bookings?.items ?? []
  const iconBtn =
    "inline-flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"

  return (
    <div className="h-full overflow-y-auto px-4 pt-8 pb-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl">
        <Link
          href="/booking-types"
          data-testid="booking-type-detail-back"
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-3" /> 예약 양식
        </Link>
        <header className="mt-2 flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="truncate text-2xl font-bold text-foreground" title={bt.title}>
              {bt.title}
            </h1>
            <p className="mt-1 truncate font-mono text-xs text-muted-foreground" data-testid="booking-type-detail-url">
              {publicUrl(bt.public_key).replace(/^https?:\/\//, "")}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <label className="mr-2 inline-flex items-center gap-2 text-xs text-muted-foreground">
              {bt.enabled ? "켜짐" : "꺼짐"}
              <BookingSwitch
                on={bt.enabled}
                onChange={toggleEnabled}
                tone="success"
                label="공개"
                testId="booking-type-detail-toggle"
              />
            </label>
            <button onClick={copyLink} title="링크 복사" data-testid="booking-type-detail-copy" className={iconBtn}>
              <Copy className="size-4" />
            </button>
            <a
              href={publicUrl(bt.public_key)}
              target="_blank"
              rel="noopener noreferrer"
              title="공개 페이지"
              data-testid="booking-type-detail-open"
              className={iconBtn}
            >
              <ExternalLink className="size-4" />
            </a>
            <button onClick={() => setShowQr(true)} title="QR" data-testid="booking-type-detail-qr" className={iconBtn}>
              <QrCode className="size-4" />
            </button>
            <button onClick={rotateKey} title="링크 재발급" data-testid="booking-type-detail-rotate" className={iconBtn}>
              <RotateCw className="size-4" />
            </button>
            <button
              onClick={deleteBT}
              title="삭제"
              data-testid="booking-type-detail-delete"
              className={cn(iconBtn, "hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/40 dark:hover:text-rose-400")}
            >
              <Trash2 className="size-4" />
            </button>
          </div>
        </header>

        <div className="mt-4">
          <BookingTypeForm initial={bt} onSubmit={save} busy={busy} />
        </div>

        <section className="mt-4 space-y-2">
          <h2 className="px-1 text-xs font-semibold tracking-wide text-muted-foreground">
            들어온 예약 {items.filter((b) => b.status === "active").length}건
          </h2>
          <div
            className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card"
            data-testid="bookings-list"
          >
            {items.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-muted-foreground">아직 예약이 없습니다</p>
            ) : (
              items.map((b) => {
                const active = b.status === "active"
                return (
                  <div
                    key={b.id}
                    data-testid={`booking-row-${b.id}`}
                    className={cn("flex items-center gap-3 px-4 py-3", !active && "opacity-60")}
                  >
                    <div className="w-36 shrink-0 text-sm tabular-nums">
                      <div className={cn("font-medium", !active && "line-through")}>{formatDateTime(b.slot_start_at)}</div>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm text-foreground">{b.customer_name ?? "-"}</div>
                      <div className="truncate text-xs text-muted-foreground">
                        {b.customer_email ?? "-"}
                        {b.customer_message && `, ${b.customer_message}`}
                      </div>
                    </div>
                    {active ? (
                      <div className="flex shrink-0 gap-1">
                        <button
                          onClick={() => setRescheduling(b)}
                          title="시간 변경"
                          data-testid={`booking-row-${b.id}-reschedule`}
                          className={iconBtn}
                        >
                          <CalendarClock className="size-4" />
                        </button>
                        <button
                          onClick={() => cancelBooking(b.id)}
                          title="취소"
                          data-testid={`booking-row-${b.id}-cancel`}
                          className={cn(iconBtn, "hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/40 dark:hover:text-rose-400")}
                        >
                          <XCircle className="size-4" />
                        </button>
                      </div>
                    ) : (
                      <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                        취소됨
                      </span>
                    )}
                  </div>
                )
              })
            )}
          </div>
        </section>

      </div>

      {showQr && (
        <QrModal
          url={publicUrl(bt.public_key)}
          title={bt.title}
          onClose={() => setShowQr(false)}
        />
      )}

      {rescheduling && (
        <RescheduleModal
          bookingType={bt}
          booking={rescheduling}
          onClose={() => setRescheduling(null)}
          onDone={() => {
            setRescheduling(null)
            void mutateBookings()
            invalidateApi("/api/v1/booking-types")
          }}
        />
      )}
    </div>
  )
}
