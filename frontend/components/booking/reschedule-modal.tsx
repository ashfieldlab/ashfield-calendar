"use client"

// 담당자 일정 변경: 공개 예약 페이지와 같은 주간 격자 + 오른쪽 패널.
// 현재 칸은 점선 "현재". 가용 시간 외 허용을 켜면 마감 칸도 주황으로 고를 수 있고 시각을 직접 넣을 수 있다.

import { useEffect, useMemo, useState } from "react"
import { X } from "lucide-react"

import { BookingSwitch, bookingInputCls as inputCls } from "@/components/booking/booking-controls"
import {
  EmptyCell,
  WeekNav,
  WeekSlotGrid,
  addDays,
  gridShape,
  hmLocal,
  indexSlots,
  mondayOf,
  slotLabel,
  weekDays,
  ymdLocal,
} from "@/components/booking/week-slot-grid"
import { useToast } from "@/components/ui-custom/use-toast"
import { api, ApiError } from "@/lib/api-client"
import { friendlyError } from "@/lib/errors"
import { useApiGet } from "@/lib/hooks/use-api"
import { cn } from "@/lib/utils"
import type { BookingRow, BookingTypeResponse, OperatorSlotListResponse } from "@/lib/types/booking"

interface Props {
  bookingType: BookingTypeResponse
  booking: BookingRow
  onClose: () => void
  onDone: () => void
}

interface Target {
  iso: string
  /** 가용 칸이면 true. 마감 칸이나 직접 입력이면 false (force 로 보낸다) */
  open: boolean
}

const T = "reschedule-modal"

/** Date → "YYYY-MM-DDTHH:MM" (datetime-local, 로컬) */
function inputValue(iso: string): string {
  const d = new Date(iso)
  return `${ymdLocal(d)}T${hmLocal(d)}`
}

export function RescheduleModal({ bookingType: bt, booking, onClose, onDone }: Props) {
  const { toast } = useToast()
  const durationMs = bt.duration_minutes * 60000
  const currentStart = new Date(booking.slot_start_at)
  const currentKey = `${ymdLocal(currentStart)} ${hmLocal(currentStart)}`

  const thisWeek = mondayOf(new Date())
  const [monday, setMonday] = useState(() => {
    const m = mondayOf(currentStart)
    return m < thisWeek ? thisWeek : m
  })
  const [target, setTarget] = useState<Target | null>(null)
  const [memo, setMemo] = useState(booking.customer_message ?? "")
  const [force, setForce] = useState(false)
  const [notify, setNotify] = useState(true)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) onClose()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [busy, onClose])

  const from = monday.toISOString()
  const to = addDays(monday, 7).toISOString()
  const { data, mutate } = useApiGet<OperatorSlotListResponse>(
    `/api/v1/booking-types/${encodeURIComponent(bt.id)}/slots?from=${encodeURIComponent(from)}&to=${encodeURIComponent(
      to,
    )}&exclude_booking_id=${encodeURIComponent(booking.id)}`,
  )
  const slots = useMemo(() => data?.slots ?? [], [data])
  const idx = useMemo(() => indexSlots(slots), [slots])

  const ws = bt.weekly_schedule
  const currentInWeek = currentStart >= monday && currentStart < addDays(monday, 7)
  const shape = useMemo(() => gridShape(slots), [slots])
  const weekend =
    shape.weekend ||
    (ws.sat?.length ?? 0) > 0 ||
    (ws.sun?.length ?? 0) > 0 ||
    (currentInWeek && (currentStart.getDay() === 0 || currentStart.getDay() === 6))
  const days = weekDays(monday, weekend)
  const currentHm = hmLocal(currentStart)
  const rows = useMemo(() => {
    const r = new Set(shape.rows)
    if (currentInWeek) r.add(currentHm)
    return [...r].sort()
  }, [shape.rows, currentInWeek, currentHm])

  function toggleForce(v: boolean) {
    setForce(v)
    if (!v && target && !target.open) setTarget(null)
  }

  async function submit() {
    if (!target || busy) return
    setBusy(true)
    try {
      await api(
        `/api/v1/booking-types/${encodeURIComponent(bt.id)}/bookings/${encodeURIComponent(booking.id)}/reschedule`,
        {
          method: "POST",
          body: {
            new_slot_start_at: target.iso,
            new_description: memo === (booking.customer_message ?? "") ? null : memo,
            force: force && !target.open,
            notify_customer: notify,
          },
        },
      )
      toast.success(notify ? "예약 시간을 바꾸고 안내 메일을 보냈습니다" : "예약 시간을 바꿨습니다")
      onDone()
    } catch (e) {
      toast.error(`변경 실패: ${friendlyError(e)}`)
      if (e instanceof ApiError && (e.status === 409 || e.status === 422)) {
        setTarget(null)
        void mutate()
      }
    } finally {
      setBusy(false)
    }
  }

  const targetEnd = target ? new Date(new Date(target.iso).getTime() + durationMs).toISOString() : null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-2 sm:p-4"
      onClick={() => !busy && onClose()}
      data-testid={T}
    >
      <div
        className="flex max-h-[calc(100dvh-1rem)] w-full max-w-[920px] flex-col overflow-hidden rounded-2xl bg-card shadow-2xl sm:max-h-[calc(100dvh-2rem)] dark:ring-1 dark:ring-foreground/10"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="예약 시간 변경"
      >
        <header className="flex shrink-0 items-start justify-between gap-3 border-b border-border px-5 py-4 sm:px-6">
          <div className="min-w-0">
            <h3 className="text-lg font-semibold text-foreground">예약 시간 변경</h3>
            <p className="mt-0.5 truncate text-sm text-muted-foreground">
              {bt.title}, {booking.customer_name ?? booking.customer_email ?? "-"}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            data-testid={`${T}-close`}
            className="rounded-md p-1.5 text-muted-foreground hover:bg-muted"
          >
            <X className="size-4" />
          </button>
        </header>

        <div className="grid min-h-0 flex-1 overflow-y-auto lg:grid-cols-[minmax(0,1fr)_300px] lg:overflow-hidden">
          <div className="min-w-0 p-4 sm:p-5 lg:overflow-y-auto">
            <WeekNav
              days={days}
              canPrev={monday > thisWeek}
              canNext
              onPrev={() => setMonday((m) => addDays(m, -7))}
              onNext={() => setMonday((m) => addDays(m, 7))}
              testid={T}
            />
            <div className="overflow-x-auto">
              {!data ? (
                <div className="h-40 animate-pulse rounded-lg bg-muted" />
              ) : rows.length === 0 ? (
                <p className="py-10 text-center text-sm text-muted-foreground" data-testid={`${T}-no-slots`}>
                  가능한 시간이 없습니다
                </p>
              ) : (
                <WeekSlotGrid
                  days={days}
                  rows={rows}
                  stickyHead
                  testid={`${T}-grid`}
                  dimDay={(d) => !slots.some((s) => ymdLocal(new Date(s.start_at)) === ymdLocal(d) && (s.open || force))}
                  renderCell={(_d, ymd, row) => {
                    const key = `${ymd} ${row}`
                    const s = idx.get(key)
                    if (key === currentKey) {
                      return (
                        <span
                          className="grid h-9 place-items-center rounded-lg border-2 border-dashed border-primary/50 text-xs font-semibold text-primary"
                          data-testid={`${T}-current`}
                        >
                          현재
                        </span>
                      )
                    }
                    if (!s || (!s.open && !force)) return <EmptyCell />
                    const sel = target?.iso !== undefined && new Date(target.iso).getTime() === new Date(s.start_at).getTime()
                    return (
                      <button
                        type="button"
                        onClick={() => setTarget({ iso: s.start_at, open: s.open })}
                        data-testid={`${T}-slot-${s.start_at}`}
                        className={cn(
                          "h-9 w-full rounded-lg text-xs font-semibold tabular-nums transition",
                          sel
                            ? "bg-primary text-primary-foreground shadow-sm"
                            : s.open
                              ? "bg-primary/10 text-primary hover:bg-primary/20"
                              : "bg-amber-100 text-amber-800 hover:bg-amber-200 dark:bg-amber-900/40 dark:text-amber-200 dark:hover:bg-amber-900/60",
                        )}
                      >
                        {row}
                      </button>
                    )
                  }}
                />
              )}
            </div>
          </div>

          <aside className="space-y-3 border-t border-border bg-muted/30 p-4 sm:p-5 lg:overflow-y-auto lg:border-t-0 lg:border-l">
            <div className="space-y-1.5 rounded-xl border border-border bg-card px-3 py-2.5 text-sm">
              <p className="text-xs text-muted-foreground">현재</p>
              <p className={cn(target && "text-muted-foreground line-through")}>
                {slotLabel(booking.slot_start_at, booking.slot_end_at)}
              </p>
              <p className="pt-1 text-xs text-muted-foreground">변경</p>
              <p
                className={cn("font-semibold", target ? "text-primary" : "text-muted-foreground")}
                data-testid={`${T}-target`}
              >
                {target && targetEnd ? slotLabel(target.iso, targetEnd) : "시간 선택 안 함"}
              </p>
            </div>
            <textarea
              rows={3}
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              placeholder="메모"
              className={cn(inputCls, "resize-none bg-card")}
              data-testid={`${T}-description`}
            />
            <div className="space-y-3 pt-1 text-sm">
              <div className="flex items-center justify-between gap-3">
                <span>가용 시간 외 허용</span>
                <BookingSwitch on={force} onChange={toggleForce} label="가용 시간 외 허용" testId={`${T}-force`} />
              </div>
              {force && (
                <input
                  type="datetime-local"
                  value={target ? inputValue(target.iso) : ""}
                  onChange={(e) => {
                    if (!e.target.value) return
                    const d = new Date(e.target.value)
                    if (!Number.isNaN(d.getTime())) setTarget({ iso: d.toISOString(), open: false })
                  }}
                  className={cn(inputCls, "bg-card py-1.5")}
                  data-testid={`${T}-new-slot`}
                />
              )}
              <div className="flex items-center justify-between gap-3">
                <span>고객에게 안내 메일</span>
                <BookingSwitch on={notify} onChange={setNotify} label="고객에게 안내 메일" testId={`${T}-notify`} />
              </div>
            </div>
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                disabled={busy}
                data-testid={`${T}-cancel`}
                className="flex-1 rounded-lg border border-border bg-card py-2.5 text-sm hover:bg-muted disabled:opacity-50"
              >
                취소
              </button>
              <button
                type="button"
                onClick={submit}
                disabled={!target || busy}
                data-testid={`${T}-submit`}
                className="flex-1 rounded-lg bg-primary py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-40"
              >
                {busy ? "처리 중…" : "변경"}
              </button>
            </div>
          </aside>
        </div>
      </div>
    </div>
  )
}
