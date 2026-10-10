"use client"

import { use, useState } from "react"
import { CheckCircle2, XCircle } from "lucide-react"

import { friendlyError } from "@/lib/errors"

export default function CancelPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = use(params)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function confirm() {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(
        `/api/public/v1/booking/cancel/${encodeURIComponent(token)}`,
        { method: "POST" },
      )
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        setError(friendlyError(body, res.status))
        return
      }
      setDone(true)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  if (done) {
    return (
      <div
        className="space-y-3 rounded-lg border border-emerald-200 bg-emerald-50 p-6"
        data-testid="cancel-page-success"
      >
        <div className="flex items-center gap-2 text-emerald-800">
          <CheckCircle2 size={20} />
          <h1 className="text-base font-semibold">예약이 취소되었습니다</h1>
        </div>
        <p className="text-sm text-gray-700">
          이메일로 취소 확인 안내를 발송했습니다.
        </p>
      </div>
    )
  }

  return (
    <div
      className="space-y-4 rounded-lg border border-gray-200 bg-white p-6"
      data-testid="cancel-page"
    >
      <h1 className="text-base font-semibold text-gray-900">
        예약을 취소하시겠습니까?
      </h1>
      <p className="text-sm text-gray-600">
        취소를 진행하면 동일한 슬롯이 다시 가용 상태로 돌아갑니다.
      </p>
      {error && (
        <div
          className="flex items-start gap-2 rounded border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700"
          data-testid="cancel-page-error"
        >
          <XCircle size={14} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}
      <button
        onClick={confirm}
        disabled={busy}
        data-testid="cancel-page-confirm"
        className="w-full rounded-md bg-rose-600 px-4 py-3 text-base font-medium text-white hover:bg-rose-700 active:bg-rose-800 disabled:opacity-50"
      >
        {busy ? "처리 중…" : "취소 확정"}
      </button>
    </div>
  )
}
