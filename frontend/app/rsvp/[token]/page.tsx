"use client"

import { use, useEffect, useState } from "react"
import { CalendarClock, CheckCircle2, MapPin, XCircle } from "lucide-react"

import { friendlyError } from "@/lib/errors"
import { formatDateTime } from "@/lib/utils/format"

type RsvpResponse = "accepted" | "tentative" | "declined"

interface RsvpView {
  title: string
  start_at: string
  end_at: string
  location: string | null
  organization_name: string
  invitee_email: string
  response: string
}

const RESPONSE_LABELS: Record<RsvpResponse, string> = {
  accepted: "참석",
  tentative: "미정",
  declined: "불참",
}

export default function RsvpPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = use(params)
  const [view, setView] = useState<RsvpView | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [saved, setSaved] = useState(false)

  const base = `/api/public/v1/events/rsvp/${encodeURIComponent(token)}`

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const res = await fetch(base)
        if (!res.ok) {
          const body = await res.json().catch(() => ({}))
          if (!cancelled) setLoadError(friendlyError(body, res.status))
          return
        }
        const data = (await res.json()) as RsvpView
        if (!cancelled) setView(data)
      } catch (e) {
        if (!cancelled) setLoadError((e as Error).message)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [base])

  async function respond(response: RsvpResponse) {
    setBusy(true)
    setActionError(null)
    try {
      const res = await fetch(base, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ response }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        setActionError(friendlyError(body, res.status))
        return
      }
      const data = (await res.json()) as RsvpView
      setView(data)
      setSaved(true)
    } catch (e) {
      setActionError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  if (loadError) {
    return (
      <div
        className="space-y-2 rounded-lg border border-rose-200 bg-rose-50 p-6"
        data-testid="rsvp-page-error"
      >
        <div className="flex items-center gap-2 text-rose-800">
          <XCircle size={20} />
          <h1 className="text-base font-semibold">초대를 찾을 수 없습니다</h1>
        </div>
        <p className="text-sm text-gray-700">
          링크가 만료되었거나 일정이 취소되었을 수 있습니다.
        </p>
      </div>
    )
  }

  if (!view) {
    return <p className="text-sm text-gray-500">불러오는 중…</p>
  }

  const current = view.response as RsvpResponse | "pending"

  return (
    <div
      className="space-y-4 rounded-lg border border-gray-200 bg-white p-6"
      data-testid="rsvp-page"
    >
      <div>
        <p className="text-xs font-medium text-gray-500">
          {view.organization_name}
        </p>
        <h1 className="mt-0.5 text-lg font-semibold text-gray-900">
          {view.title}
        </h1>
      </div>

      <div className="space-y-1.5 text-sm text-gray-700">
        <div className="flex items-center gap-2">
          <CalendarClock size={15} className="shrink-0 text-gray-400" />
          <span>
            {formatDateTime(view.start_at)} ~ {formatDateTime(view.end_at)}
          </span>
        </div>
        {view.location && (
          <div className="flex items-center gap-2">
            <MapPin size={15} className="shrink-0 text-gray-400" />
            <span>{view.location}</span>
          </div>
        )}
      </div>

      <div className="border-t border-gray-100 pt-4">
        <p className="mb-2 text-sm text-gray-600">
          {view.invitee_email} 님, 참석 여부를 알려주세요.
        </p>
        <div className="grid grid-cols-3 gap-2">
          {(["accepted", "tentative", "declined"] as RsvpResponse[]).map((r) => (
            <button
              key={r}
              onClick={() => respond(r)}
              disabled={busy}
              data-testid={`rsvp-respond-${r}`}
              className={`rounded-md px-3 py-2.5 text-sm font-medium disabled:opacity-50 ${
                current === r
                  ? "bg-gray-900 text-white"
                  : "border border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
              }`}
            >
              {RESPONSE_LABELS[r]}
            </button>
          ))}
        </div>
      </div>

      {saved && (
        <div
          className="flex items-center gap-2 rounded border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800"
          data-testid="rsvp-page-saved"
        >
          <CheckCircle2 size={16} className="shrink-0" />
          <span>응답이 저장되었습니다.</span>
        </div>
      )}
      {actionError && (
        <div
          className="flex items-start gap-2 rounded border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700"
          data-testid="rsvp-page-action-error"
        >
          <XCircle size={14} className="mt-0.5 shrink-0" />
          <span>{actionError}</span>
        </div>
      )}
    </div>
  )
}
