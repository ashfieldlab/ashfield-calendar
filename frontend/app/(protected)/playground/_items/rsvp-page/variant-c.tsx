"use client"

// 안 C: 카드 없는 문장형. 가운데 큰 글씨로 날짜와 질문, 알약 버튼 한 줄. 결과는 큰 원 아이콘 하나로. 취소 페이지는 원본처럼 예약 정보 없이.

import { useState } from "react"
import { Check, CircleHelp, Link2Off, X } from "lucide-react"

import { cn } from "@/lib/utils"

import { formatDay, formatTime } from "../_mock"
import { PublicCanvas } from "../public-booking/shared"
import { INVITE, RESPONSE_LABEL, RESPONSES, isCancelPage, type RsvpDemo, type RsvpResponse } from "./shared"

const T = "pg-rsvp-page-c"
const ICON = { accepted: Check, tentative: CircleHelp, declined: X }
const CIRCLE: Record<RsvpResponse, string> = {
  accepted: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300",
  tentative: "bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300",
  declined: "bg-muted text-muted-foreground",
}

export function VariantC({ d }: { d: RsvpDemo }) {
  return (
    <PublicCanvas className="flex flex-col">
      <div className="flex flex-1 items-center justify-center px-6 py-16 text-center">
        <div className="w-full max-w-xl">
          {d.state === "invalid" ? <Invalid /> : isCancelPage(d.state) ? <Cancel d={d} /> : <Invite d={d} />}
        </div>
      </div>
      <div className="h-1.5 bg-primary" />
    </PublicCanvas>
  )
}

function Invite({ d }: { d: RsvpDemo }) {
  const [editing, setEditing] = useState(false)
  const answered = d.state !== "pending" && d.response && !editing
  const r = d.response

  return (
    <div data-testid={`${T}-invite`}>
      <p className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">{INVITE.organization}</p>
      <h1 className="mt-3 text-4xl font-bold tracking-tight">{INVITE.title}</h1>
      <p className="mt-4 text-lg text-foreground/80">
        {formatDay(INVITE.start)}, {formatTime(INVITE.start)} ~ {formatTime(INVITE.end)}
      </p>
      <p className="text-sm text-muted-foreground">{INVITE.location}</p>

      <div className="mx-auto my-10 h-px w-16 bg-border" />

      {answered && r ? (
        <div data-testid={`${T}-saved`}>
          <Circle r={r} />
          <p className="mt-4 text-2xl font-bold">{RESPONSE_LABEL[r]}</p>
          <p className="mt-1 text-sm text-muted-foreground">{INVITE.inviteeEmail}</p>
          <button
            type="button"
            onClick={() => setEditing(true)}
            data-testid={`${T}-edit-button`}
            className="mt-4 text-sm font-medium text-primary underline-offset-4 hover:underline"
          >
            응답 변경
          </button>
        </div>
      ) : (
        <div>
          <p className="text-2xl font-semibold">참석하시나요?</p>
          <p className="mt-1 text-sm text-muted-foreground">{INVITE.inviteeEmail}</p>
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            {RESPONSES.map((x) => (
              <button
                key={x}
                type="button"
                onClick={() => d.respond(x, () => setEditing(false))}
                disabled={!!d.busy}
                data-testid={`${T}-respond-${x}-button`}
                className={cn(
                  "min-w-24 rounded-full px-6 py-3 text-base font-semibold transition disabled:opacity-50",
                  x === "accepted"
                    ? "bg-primary text-primary-foreground hover:bg-primary/90"
                    : "border border-input hover:bg-muted",
                  d.response === x && editing && "ring-2 ring-primary ring-offset-2 ring-offset-background",
                )}
              >
                {d.busy === x ? "…" : RESPONSE_LABEL[x]}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function Circle({ r }: { r: RsvpResponse }) {
  const Icon = ICON[r]
  return (
    <div className={cn("mx-auto grid size-20 place-items-center rounded-full", CIRCLE[r])}>
      <Icon className="size-9" strokeWidth={2.5} />
    </div>
  )
}

function Cancel({ d }: { d: RsvpDemo }) {
  if (d.state === "cancelled") {
    return (
      <div data-testid={`${T}-cancelled`}>
        <div className="mx-auto grid size-20 place-items-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
          <Check className="size-9" strokeWidth={2.5} />
        </div>
        <h1 className="mt-6 text-3xl font-bold tracking-tight">예약이 취소되었습니다</h1>
        <p className="mt-2 text-muted-foreground">취소 확인 메일 발송</p>
      </div>
    )
  }
  return (
    <div data-testid={`${T}-cancel`}>
      <h1 className="text-4xl font-bold tracking-tight">예약을 취소할까요?</h1>
      <button
        type="button"
        onClick={d.confirmCancel}
        disabled={!!d.busy}
        data-testid={`${T}-cancel-confirm-button`}
        className="mt-8 rounded-full bg-rose-600 px-10 py-3.5 text-base font-semibold text-white hover:bg-rose-700 disabled:opacity-50 dark:bg-rose-700 dark:hover:bg-rose-600"
      >
        {d.busy ? "처리 중…" : "취소 확정"}
      </button>
    </div>
  )
}

function Invalid() {
  return (
    <div data-testid={`${T}-invalid`}>
      <div className="mx-auto grid size-20 place-items-center rounded-full bg-muted text-muted-foreground">
        <Link2Off className="size-9" />
      </div>
      <h1 className="mt-6 text-3xl font-bold tracking-tight">링크를 열 수 없습니다</h1>
      <p className="mt-2 text-muted-foreground">만료되었거나 취소된 일정</p>
    </div>
  )
}
