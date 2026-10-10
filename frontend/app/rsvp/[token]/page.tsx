"use client"

import { use, useEffect, useState } from "react"
import { CalendarClock, Check, CircleHelp, MapPin, X } from "lucide-react"

import { DateTile, ErrorLine, InvalidLinkCard, TicketCard, TicketHead } from "@/components/public/ticket-card"
import { friendlyError } from "@/lib/errors"
import { cn } from "@/lib/utils"
import { rangeText } from "@/lib/utils/day-format"
import { josaRo } from "@/lib/utils/josa"

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

const RESPONSES: RsvpResponse[] = ["accepted", "tentative", "declined"]
const RESPONSE_LABEL: Record<RsvpResponse, string> = {
  accepted: "참석",
  tentative: "미정",
  declined: "불참",
}
const ICON = { accepted: Check, tentative: CircleHelp, declined: X }
const BANNER: Record<RsvpResponse, string> = {
  accepted: "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300",
  tentative: "bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300",
  declined: "bg-muted text-foreground/80",
}

const T = "rsvp-page"

export default function RsvpPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params)
  const [view, setView] = useState<RsvpView | null>(null)
  const [invalid, setInvalid] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [busy, setBusy] = useState<RsvpResponse | null>(null)

  // 공개 라우트 (비인증, ADR-0011): BFF 를 거치지 않고 백엔드 공개 API 를 직접 부른다
  const base = `/api/public/v1/events/rsvp/${encodeURIComponent(token)}`

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const res = await fetch(base)
        if (!res.ok) {
          if (!cancelled) setInvalid(true)
          return
        }
        const data = (await res.json()) as RsvpView
        if (!cancelled) setView(data)
      } catch {
        if (!cancelled) setInvalid(true)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [base])

  async function respond(response: RsvpResponse) {
    if (busy) return
    setBusy(response)
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
      setView((await res.json()) as RsvpView)
    } catch (e) {
      setActionError((e as Error).message)
    } finally {
      setBusy(null)
    }
  }

  if (invalid) return <InvalidLinkCard testid={`${T}-error`} />
  if (!view) return <p className="text-sm text-muted-foreground">불러오는 중…</p>

  const answered = view.response !== "pending" ? (view.response as RsvpResponse) : null
  const AnsweredIcon = answered ? ICON[answered] : null

  return (
    <TicketCard testid={T}>
      <TicketHead org={view.organization_name} title={view.title} />
      <div className="-mt-6 flex gap-4 px-6">
        <DateTile iso={view.start_at} />
        <div className="space-y-1.5 pt-7 text-sm text-foreground/80">
          <p className="flex items-start gap-2">
            <CalendarClock className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            {rangeText(view.start_at, view.end_at)}
          </p>
          {view.location && (
            <p className="flex items-start gap-2">
              <MapPin className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
              {view.location}
            </p>
          )}
        </div>
      </div>

      <div className="mt-6 border-t px-6 py-5">
        {answered ? (
          <div className="space-y-3" data-testid={`${T}-saved`}>
            <div className={cn("flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold", BANNER[answered])}>
              {AnsweredIcon && <AnsweredIcon className="size-4" />}
              {RESPONSE_LABEL[answered]}
              {josaRo(RESPONSE_LABEL[answered])} 응답함
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs text-muted-foreground">{view.invitee_email}</span>
              <div className="inline-flex rounded-lg border p-0.5">
                {RESPONSES.map((x) => (
                  <button
                    key={x}
                    type="button"
                    onClick={() => void respond(x)}
                    disabled={!!busy || x === answered}
                    aria-pressed={x === answered}
                    data-testid={`${T}-change-${x}`}
                    className={cn(
                      "rounded-md px-2.5 py-1 text-xs font-medium transition",
                      x === answered
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground",
                      busy === x && "animate-pulse",
                    )}
                  >
                    {RESPONSE_LABEL[x]}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <>
            <p className="mb-3 text-sm text-muted-foreground">{view.invitee_email}</p>
            <div className="grid grid-cols-3 gap-2">
              {RESPONSES.map((r) => {
                const Icon = ICON[r]
                return (
                  <button
                    key={r}
                    type="button"
                    onClick={() => void respond(r)}
                    disabled={!!busy}
                    data-testid={`rsvp-respond-${r}`}
                    className={cn(
                      "flex flex-col items-center gap-1.5 rounded-xl border py-4 text-sm font-semibold transition hover:bg-muted/60 disabled:opacity-50",
                      r === "accepted" && "border-primary/50 text-primary hover:bg-primary/5 dark:text-foreground",
                      busy === r && "animate-pulse",
                    )}
                  >
                    <Icon className="size-5" />
                    {RESPONSE_LABEL[r]}
                  </button>
                )
              })}
            </div>
          </>
        )}
        {actionError && <ErrorLine message={actionError} testid={`${T}-action-error`} />}
      </div>
    </TicketCard>
  )
}
