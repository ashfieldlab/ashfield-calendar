"use client"

import { use, useEffect, useState } from "react"
import { CalendarClock, CircleCheck, Mail } from "lucide-react"

import { DateTile, ErrorLine, InvalidLinkCard, TicketCard, TicketHead } from "@/components/public/ticket-card"
import { friendlyError } from "@/lib/errors"
import { cn } from "@/lib/utils"
import { rangeText } from "@/lib/utils/day-format"

interface CancelView {
  title: string
  organization_name: string
  slot_start_at: string
  slot_end_at: string
  customer_email: string
  status: "active" | "cancelled" | string
}

const T = "cancel-page"

export default function CancelPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params)
  const [view, setView] = useState<CancelView | null>(null)
  const [invalid, setInvalid] = useState(false)
  const [justCancelled, setJustCancelled] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  // 공개 라우트 (비인증, ADR-0011): BFF 를 거치지 않고 백엔드 공개 API 를 직접 부른다
  const base = `/api/public/v1/booking/cancel/${encodeURIComponent(token)}`

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const res = await fetch(base)
        if (!res.ok) {
          if (!cancelled) setInvalid(true)
          return
        }
        const data = (await res.json()) as CancelView
        if (!cancelled) setView(data)
      } catch {
        if (!cancelled) setInvalid(true)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [base])

  async function confirm() {
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(base, { method: "POST" })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        setError(friendlyError(body, res.status))
        return
      }
      setView((v) => (v ? { ...v, status: "cancelled" } : v))
      setJustCancelled(true)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  if (invalid) return <InvalidLinkCard testid={`${T}-invalid`} />
  if (!view) return <p className="text-sm text-muted-foreground">불러오는 중…</p>

  const done = view.status === "cancelled"

  return (
    <TicketCard testid={T}>
      <TicketHead org={view.organization_name} title={view.title} struck={done} />
      <div className="-mt-6 flex gap-4 px-6">
        <DateTile iso={view.slot_start_at} muted={done} />
        <p
          className={cn(
            "flex items-start gap-2 pt-7 text-sm text-foreground/80",
            done && "text-muted-foreground line-through",
          )}
        >
          <CalendarClock className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
          {rangeText(view.slot_start_at, view.slot_end_at)}
        </p>
      </div>
      <div className="mt-6 border-t px-6 py-5">
        {done ? (
          <div className="space-y-2" data-testid={`${T}-success`}>
            <p className="flex items-center gap-2 rounded-xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
              <CircleCheck className="size-4" />
              예약이 취소되었습니다
            </p>
            {justCancelled && view.customer_email && (
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Mail className="size-3.5" />
                취소 확인 메일 발송: {view.customer_email}
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm font-semibold">예약을 취소할까요?</p>
            <button
              type="button"
              onClick={() => void confirm()}
              disabled={busy}
              data-testid={`${T}-confirm`}
              className="w-full rounded-xl bg-rose-600 py-3 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-50 dark:bg-rose-700 dark:hover:bg-rose-600"
            >
              {busy ? "처리 중…" : "예약 취소"}
            </button>
          </div>
        )}
        {error && <ErrorLine message={error} testid={`${T}-error`} />}
      </div>
    </TicketCard>
  )
}
