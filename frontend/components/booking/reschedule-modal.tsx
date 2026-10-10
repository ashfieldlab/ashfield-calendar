"use client"

import { useState } from "react"
import { X } from "lucide-react"
import { useToast } from "@/components/ui-custom/use-toast"

import { api } from "@/lib/api-client"
import type { BookingRow } from "@/lib/types/booking"

interface Props {
  bookingTypeId: string
  booking: BookingRow
  onClose: () => void
  onDone: () => void
}

/** 운영자가 booking 의 시간과 메모를 변경. force=true 면 양식 외 시간도 가능. */
export function RescheduleModal({
  bookingTypeId,
  booking,
  onClose,
  onDone,
}: Props) {
  const { toast } = useToast()

  // 기본값: 기존 슬롯 + 1시간 후로 제안
  const initial = new Date(new Date(booking.slot_start_at).getTime() + 60 * 60 * 1000)
  const initialIso = isoForInput(initial)

  const [newSlot, setNewSlot] = useState(initialIso)
  const [newDescription, setNewDescription] = useState(
    booking.customer_message ?? "",
  )
  const [force, setForce] = useState(false)
  const [notifyCustomer, setNotifyCustomer] = useState(true)
  const [busy, setBusy] = useState(false)

  async function submit() {
    setBusy(true)
    try {
      await api(
        `/api/v1/booking-types/${encodeURIComponent(bookingTypeId)}/bookings/${encodeURIComponent(booking.id)}/reschedule`,
        {
          method: "POST",
          body: {
            new_slot_start_at: new Date(newSlot).toISOString(),
            new_description:
              newDescription === (booking.customer_message ?? "")
                ? null
                : newDescription,
            force,
            notify_customer: notifyCustomer,
          },
        },
      )
      toast.success("예약 시간 변경 완료")
      onDone()
    } catch (e) {
      toast.error(`변경 실패: ${(e as Error).message}`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
      data-testid="reschedule-modal"
    >
      <div
        className="w-full max-w-md rounded-lg bg-card p-5 shadow-xl dark:ring-1 dark:ring-foreground/10"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground">예약 시간 변경</h3>
          <button
            onClick={onClose}
            data-testid="reschedule-modal-close"
            className="rounded p-1 text-muted-foreground hover:bg-muted"
          >
            <X size={16} />
          </button>
        </div>

        <div className="space-y-3">
          <div className="rounded bg-muted/50 p-2 text-xs text-foreground/80">
            <p>
              <span className="text-muted-foreground">현재:</span>{" "}
              {new Date(booking.slot_start_at).toLocaleString("ko-KR")}
            </p>
            <p>
              <span className="text-muted-foreground">고객:</span>{" "}
              {booking.customer_name ?? "-"}, {booking.customer_email ?? "-"}
            </p>
          </div>

          <Row label="새 시각">
            <input
              type="datetime-local"
              value={newSlot}
              onChange={(e) => setNewSlot(e.target.value)}
              data-testid="reschedule-modal-new-slot"
              className="w-full rounded border border-input px-3 py-2 text-sm"
            />
          </Row>

          <Row label="메모 수정" hint="고객에게 보내는 안내문에 포함될 수 있음">
            <textarea
              rows={2}
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
              data-testid="reschedule-modal-description"
              className="w-full rounded border border-input px-3 py-2 text-sm"
            />
          </Row>

          <label className="flex items-start gap-2 text-xs text-foreground/80">
            <input
              type="checkbox"
              checked={force}
              onChange={(e) => setForce(e.target.checked)}
              data-testid="reschedule-modal-force"
              className="mt-0.5"
            />
            <span>
              <strong>가용 시간 외 강제</strong>: 요일, 시간, 정원 검증 생략
            </span>
          </label>

          <label className="flex items-start gap-2 text-xs text-foreground/80">
            <input
              type="checkbox"
              checked={notifyCustomer}
              onChange={(e) => setNotifyCustomer(e.target.checked)}
              data-testid="reschedule-modal-notify"
              className="mt-0.5"
            />
            <span>고객에게 변경 안내 이메일 발송</span>
          </label>
        </div>

        <div className="mt-4 flex justify-end gap-2 border-t border-border/60 pt-3">
          <button
            onClick={onClose}
            disabled={busy}
            data-testid="reschedule-modal-cancel"
            className="rounded px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted disabled:opacity-50"
          >
            취소
          </button>
          <button
            onClick={submit}
            disabled={busy || !newSlot}
            data-testid="reschedule-modal-submit"
            className="rounded bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            변경 적용
          </button>
        </div>
      </div>
    </div>
  )
}

function Row({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-muted-foreground">
        {label}
        {hint && <span className="ml-2 text-muted-foreground/70">{hint}</span>}
      </label>
      {children}
    </div>
  )
}

/** Date → "YYYY-MM-DDTHH:MM" (datetime-local input 형식, 로컬 TZ). */
function isoForInput(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}
