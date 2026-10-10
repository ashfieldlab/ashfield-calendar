"use client"

// 안 B: 좌우 분할 티켓. 왼쪽 브랜드 색 면에 큰 날짜, 오른쪽에 내용과 라디오 카드형 응답. 응답은 고른 자리에 그대로 남는다.

import { Ban, Check, CircleHelp, Link2Off, Mail, MapPin, X } from "lucide-react"

import { cn } from "@/lib/utils"

import { formatTime } from "../_mock"
import { PublicCanvas } from "../public-booking/shared"
import { BOOKED, INVITE, RESPONSE_LABEL, RESPONSES, isCancelPage, type RsvpDemo, type RsvpResponse } from "./shared"

const T = "pg-rsvp-page-b"
const WD = ["일", "월", "화", "수", "목", "금", "토"]
const ICON = { accepted: Check, tentative: CircleHelp, declined: X }
const TONE: Record<RsvpResponse, string> = {
  accepted: "bg-emerald-600 text-white dark:bg-emerald-500 dark:text-emerald-950",
  tentative: "bg-amber-500 text-white dark:bg-amber-400 dark:text-amber-950",
  declined: "bg-muted-foreground text-background",
}

export function VariantB({ d }: { d: RsvpDemo }) {
  const cancelPage = isCancelPage(d.state)
  const ev = cancelPage ? BOOKED : INVITE
  const invalid = d.state === "invalid"
  const struck = d.state === "cancelled"

  return (
    <PublicCanvas className="grid place-items-center bg-muted/40 px-4 py-10">
      <div className="grid w-full max-w-3xl overflow-hidden rounded-3xl border bg-card shadow-sm md:grid-cols-[240px_minmax(0,1fr)]">
        <aside
          className={cn(
            "flex flex-col justify-between gap-6 p-7",
            invalid ? "bg-muted text-muted-foreground" : "bg-primary text-primary-foreground",
          )}
        >
          <p className="text-xs font-medium opacity-75">{ev.organization}</p>
          {invalid ? (
            <Link2Off className="size-12 opacity-60" />
          ) : (
            <div className={cn(struck && "opacity-50")}>
              <p className="text-sm font-medium opacity-80">
                {new Date(ev.start).getMonth() + 1}월 {WD[new Date(ev.start).getDay()]}요일
              </p>
              <p className={cn("text-7xl font-bold leading-none tracking-tight", struck && "line-through")}>{new Date(ev.start).getDate()}</p>
              <p className="mt-2 text-sm font-medium">
                {formatTime(ev.start)} ~ {formatTime(ev.end)}
              </p>
            </div>
          )}
        </aside>

        <div className="p-7">
          {invalid ? (
            <div className="flex h-full flex-col justify-center" data-testid={`${T}-invalid`}>
              <h1 className="text-xl font-bold">링크를 열 수 없습니다</h1>
              <p className="mt-1 text-sm text-muted-foreground">만료되었거나 취소된 일정</p>
            </div>
          ) : cancelPage ? (
            <CancelBody d={d} />
          ) : (
            <InviteBody d={d} />
          )}
        </div>
      </div>
    </PublicCanvas>
  )
}

function InviteBody({ d }: { d: RsvpDemo }) {
  const current = d.state === "pending" ? null : d.response
  return (
    <div data-testid={`${T}-invite`}>
      <div className="flex items-start justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight">{INVITE.title}</h1>
        {current && (
          <span className={cn("shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold", TONE[current])} data-testid={`${T}-saved`}>
            {RESPONSE_LABEL[current]}
          </span>
        )}
      </div>
      <p className="mt-2 flex items-start gap-1.5 text-sm text-foreground/80">
        <MapPin className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
        {INVITE.location}
      </p>
      <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
        <Mail className="size-4 shrink-0" />
        {INVITE.inviteeEmail}
      </p>

      <div className="mt-6 space-y-2" role="radiogroup" aria-label="참석 여부">
        {RESPONSES.map((r) => {
          const Icon = ICON[r]
          const on = current === r
          return (
            <button
              key={r}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => d.respond(r)}
              disabled={!!d.busy}
              data-testid={`${T}-respond-${r}-button`}
              className={cn(
                "flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left text-sm font-medium transition disabled:cursor-wait",
                on ? "border-primary bg-primary/5 ring-1 ring-primary" : "hover:bg-muted/60",
              )}
            >
              <span className={cn("grid size-8 place-items-center rounded-full", on ? TONE[r] : "bg-muted text-muted-foreground")}>
                <Icon className="size-4" />
              </span>
              <span className="flex-1">{RESPONSE_LABEL[r]}</span>
              {d.busy === r ? (
                <span className="text-xs text-muted-foreground">저장 중…</span>
              ) : (
                on && <Check className="size-4 text-primary" />
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function CancelBody({ d }: { d: RsvpDemo }) {
  const done = d.state === "cancelled"
  return (
    <div className="flex h-full flex-col" data-testid={`${T}-cancel`}>
      <p className={cn("text-xs font-semibold", done ? "text-muted-foreground" : "text-rose-600 dark:text-rose-400")}>{done ? "취소됨" : "예약 취소"}</p>
      <h1 className={cn("mt-1 text-2xl font-bold tracking-tight", done && "text-muted-foreground line-through")}>{BOOKED.title}</h1>
      <div className="mt-auto pt-8">
        {done ? (
          <div className="space-y-1" data-testid={`${T}-cancelled`}>
            <p className="flex items-center gap-2 font-semibold">
              <Ban className="size-4 text-muted-foreground" />
              예약이 취소되었습니다
            </p>
            <p className="text-sm text-muted-foreground">취소 확인 메일 발송: {BOOKED.customerEmail}</p>
          </div>
        ) : (
          <button
            type="button"
            onClick={d.confirmCancel}
            disabled={!!d.busy}
            data-testid={`${T}-cancel-confirm-button`}
            className="w-full rounded-xl border-2 border-rose-600 py-3 text-sm font-semibold text-rose-700 transition hover:bg-rose-600 hover:text-white disabled:opacity-50 dark:border-rose-500 dark:text-rose-300 dark:hover:bg-rose-600 dark:hover:text-white"
          >
            {d.busy ? "처리 중…" : "취소 확정"}
          </button>
        )}
      </div>
    </div>
  )
}
