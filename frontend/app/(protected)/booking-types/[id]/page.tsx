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

  async function save(body: BookingTypeCreate) {
    setBusy(true)
    try {
      // owner_type 은 PATCH 에서 보내지 않음 (생성 시 결정)
      const { owner_type: _ot, ...patch } = body
      void _ot
      await api(url, { method: "PATCH", body: patch })
      toast.success("저장했습니다")
      invalidateApi(url)
    } catch (e) {
      toast.error(`저장 실패: ${(e as Error).message}`)
    } finally {
      setBusy(false)
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
      <div className="rounded-lg border border-rose-200 dark:border-rose-900/60 bg-rose-50 dark:bg-rose-950/40 p-4 text-sm text-rose-700 dark:text-rose-300">
        불러오지 못했습니다. 잠시 후 다시 시도해주세요.
      </div>
    )
  }
  if (isLoading || !bt) {
    return <p className="text-sm text-muted-foreground">불러오는 중…</p>
  }

  return (
    <div className="h-full overflow-y-auto px-4 py-8 sm:px-6 lg:px-8 space-y-4">
      <Link
        href="/booking-types"
        data-testid="booking-type-detail-back"
        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft size={12} /> 예약 양식 목록
      </Link>
      <header className="flex items-center justify-between gap-3">
        <h1 className="min-w-0 truncate text-2xl font-bold text-foreground" title={bt.title}>
          {bt.title}
        </h1>
        <div className="flex shrink-0 items-center gap-1">
          <button
            onClick={copyLink}
            title="공개 URL 복사"
            data-testid="booking-type-detail-copy"
            className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <Copy size={16} />
          </button>
          <a
            href={publicUrl(bt.public_key)}
            target="_blank"
            rel="noopener noreferrer"
            title="공개 페이지 열기"
            data-testid="booking-type-detail-open"
            className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <ExternalLink size={16} />
          </a>
          <button
            onClick={() => setShowQr(true)}
            title="QR 코드"
            data-testid="booking-type-detail-qr"
            className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <QrCode size={16} />
          </button>
          <button
            onClick={rotateKey}
            title="공개 URL 재발급"
            data-testid="booking-type-detail-rotate"
            className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <RotateCw size={16} />
          </button>
          <button
            onClick={deleteBT}
            title="삭제"
            data-testid="booking-type-detail-delete"
            className="rounded p-1.5 text-muted-foreground hover:bg-rose-50 dark:hover:bg-rose-950/40 hover:text-rose-600 dark:hover:text-rose-400"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </header>
      <p className="text-xs text-muted-foreground">
        공개 URL: <code className="rounded bg-muted px-1.5 py-0.5">{publicUrl(bt.public_key)}</code>
      </p>

      <BookingTypeForm initial={bt} onSubmit={save} busy={busy} />

      {/* Booking 목록 */}
      <section className="space-y-2 pt-4">
        <h2 className="text-base font-semibold text-foreground">들어온 예약</h2>
        <div className="overflow-x-auto rounded-lg border border-border bg-card">
          <table className="w-full text-sm" data-testid="bookings-list">
            <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-4 py-2 font-medium">일시</th>
                <th className="px-4 py-2 font-medium">고객</th>
                <th className="px-4 py-2 font-medium">메시지</th>
                <th className="w-20 px-4 py-2 font-medium">상태</th>
                <th className="w-24 px-4 py-2 text-right" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {(bookings?.items ?? []).map((b) => (
                <tr
                  key={b.id}
                  data-testid={`booking-row-${b.id}`}
                  className="hover:bg-muted/50"
                >
                  <td className="px-4 py-2 text-foreground/80">
                    {formatDateTime(b.slot_start_at)}
                  </td>
                  <td className="px-4 py-2">
                    <div className="flex flex-col">
                      <span className="text-foreground">
                        {b.customer_name ?? "-"}
                      </span>
                      <span className="text-[11px] text-muted-foreground">
                        {b.customer_email ?? "-"}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-2 text-muted-foreground truncate max-w-md">
                    {b.customer_message || "-"}
                  </td>
                  <td className="px-4 py-2">
                    {b.status === "active" ? (
                      <span className="rounded bg-emerald-100 dark:bg-emerald-900/40 px-1.5 py-0.5 text-xs text-emerald-800 dark:text-emerald-300">
                        예약
                      </span>
                    ) : (
                      <span className="rounded bg-muted px-1.5 py-0.5 text-xs text-foreground/80">
                        취소
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-right">
                    {b.status === "active" && (
                      <div className="flex justify-end gap-1">
                        <button
                          onClick={() => setRescheduling(b)}
                          title="시간 변경"
                          data-testid={`booking-row-${b.id}-reschedule`}
                          className="rounded p-1 text-muted-foreground hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:text-blue-600 dark:hover:text-blue-400"
                        >
                          <CalendarClock size={14} />
                        </button>
                        <button
                          onClick={() => cancelBooking(b.id)}
                          title="취소"
                          data-testid={`booking-row-${b.id}-cancel`}
                          className="rounded p-1 text-muted-foreground hover:bg-rose-50 dark:hover:bg-rose-950/40 hover:text-rose-600 dark:hover:text-rose-400"
                        >
                          <XCircle size={14} />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
              {(bookings?.items ?? []).length === 0 && (
                <tr>
                  <td
                    colSpan={5}
                    className="px-4 py-8 text-center text-sm text-muted-foreground"
                  >
                    아직 예약이 없습니다.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {showQr && (
        <QrModal
          url={publicUrl(bt.public_key)}
          title={bt.title}
          onClose={() => setShowQr(false)}
        />
      )}

      {rescheduling && (
        <RescheduleModal
          bookingTypeId={id}
          booking={rescheduling}
          onClose={() => setRescheduling(null)}
          onDone={() => {
            setRescheduling(null)
            mutateBookings()
            invalidateApi("/api/v1/booking-types")
          }}
        />
      )}
    </div>
  )
}
