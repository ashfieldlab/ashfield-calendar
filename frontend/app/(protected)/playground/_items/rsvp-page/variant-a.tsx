"use client"

// 안 A: 초대장 카드. 브랜드 색 머리, 달력 타일, 아이콘 세 개짜리 큰 응답 버튼. 응답 뒤엔 결과 띠와 작은 변경 버튼.

import { CalendarClock, Check, CircleCheck, CircleHelp, Link2Off, Mail, MapPin, X } from "lucide-react"

import { cn } from "@/lib/utils"

import { PublicCanvas } from "../public-booking/shared"
import { BOOKED, INVITE, RESPONSE_LABEL, RESPONSES, isCancelPage, rangeLabel, type RsvpDemo, type RsvpResponse } from "./shared"

const T = "pg-rsvp-page-a"
const ICON = { accepted: Check, tentative: CircleHelp, declined: X }

export function VariantA({ d }: { d: RsvpDemo }) {
  return (
    <PublicCanvas className="grid place-items-center bg-muted/40 px-4 py-10">
      {d.state === "invalid" ? <Invalid /> : isCancelPage(d.state) ? <CancelCard d={d} /> : <InviteCard d={d} />}
    </PublicCanvas>
  )
}

function DateTile({ iso, muted }: { iso: string; muted?: boolean }) {
  const t = new Date(iso)
  return (
    <div className={cn("w-16 shrink-0 overflow-hidden rounded-xl border bg-card text-center shadow-sm", muted && "opacity-60")}>
      <p className="bg-primary/10 py-0.5 text-[11px] font-semibold text-primary">{t.getMonth() + 1}월</p>
      <p className="py-1.5 text-2xl font-bold leading-none">{t.getDate()}</p>
    </div>
  )
}

function Head({ org, title, struck }: { org: string; title: string; struck?: boolean }) {
  return (
    <div className="bg-primary px-6 pt-6 pb-10 text-primary-foreground">
      <p className="text-xs opacity-75">{org}</p>
      <h1 className={cn("mt-1 text-xl font-bold", struck && "line-through opacity-70")}>{title}</h1>
    </div>
  )
}

function InviteCard({ d }: { d: RsvpDemo }) {
  const answered = d.state !== "pending" && d.response
  return (
    <div className="w-full max-w-md overflow-hidden rounded-2xl border bg-card shadow-sm" data-testid={`${T}-invite`}>
      <Head org={INVITE.organization} title={INVITE.title} />
      <div className="-mt-6 flex gap-4 px-6">
        <DateTile iso={INVITE.start} />
        <div className="space-y-1.5 pt-7 text-sm text-foreground/80">
          <p className="flex items-start gap-2">
            <CalendarClock className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            {rangeLabel(INVITE.start, INVITE.end)}
          </p>
          <p className="flex items-start gap-2">
            <MapPin className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            {INVITE.location}
          </p>
        </div>
      </div>

      <div className="mt-6 border-t px-6 py-5">
        {answered ? (
          <Answered r={d.response as RsvpResponse} d={d} />
        ) : (
          <>
            <p className="mb-3 text-sm text-muted-foreground">{INVITE.inviteeEmail}</p>
            <div className="grid grid-cols-3 gap-2">
              {RESPONSES.map((r) => {
                const Icon = ICON[r]
                return (
                  <button
                    key={r}
                    type="button"
                    onClick={() => d.respond(r)}
                    disabled={!!d.busy}
                    data-testid={`${T}-respond-${r}-button`}
                    className={cn(
                      "flex flex-col items-center gap-1.5 rounded-xl border py-4 text-sm font-semibold transition hover:bg-muted/60 disabled:opacity-50",
                      r === "accepted" && "border-primary/50 text-primary hover:bg-primary/5",
                      d.busy === r && "animate-pulse",
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
      </div>
    </div>
  )
}

const BANNER: Record<RsvpResponse, string> = {
  accepted: "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300",
  tentative: "bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300",
  declined: "bg-muted text-foreground/80",
}

function Answered({ r, d }: { r: RsvpResponse; d: RsvpDemo }) {
  const Icon = ICON[r]
  return (
    <div className="space-y-3" data-testid={`${T}-saved`}>
      <div className={cn("flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold", BANNER[r])}>
        <Icon className="size-4" />
        {RESPONSE_LABEL[r]}으로 응답함
      </div>
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-muted-foreground">{INVITE.inviteeEmail}</span>
        <div className="inline-flex rounded-lg border p-0.5">
          {RESPONSES.map((x) => (
            <button
              key={x}
              type="button"
              onClick={() => d.respond(x)}
              disabled={!!d.busy || x === r}
              data-testid={`${T}-change-${x}-button`}
              className={cn(
                "rounded-md px-2.5 py-1 text-xs font-medium transition",
                x === r ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              {RESPONSE_LABEL[x]}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

function CancelCard({ d }: { d: RsvpDemo }) {
  const done = d.state === "cancelled"
  return (
    <div className="w-full max-w-md overflow-hidden rounded-2xl border bg-card shadow-sm" data-testid={`${T}-cancel`}>
      <Head org={BOOKED.organization} title={BOOKED.title} struck={done} />
      <div className="-mt-6 flex gap-4 px-6">
        <DateTile iso={BOOKED.start} muted={done} />
        <p className={cn("flex items-start gap-2 pt-7 text-sm text-foreground/80", done && "text-muted-foreground line-through")}>
          <CalendarClock className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
          {rangeLabel(BOOKED.start, BOOKED.end)}
        </p>
      </div>
      <div className="mt-6 border-t px-6 py-5">
        {done ? (
          <div className="space-y-2" data-testid={`${T}-cancelled`}>
            <p className="flex items-center gap-2 rounded-xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
              <CircleCheck className="size-4" />
              예약이 취소되었습니다
            </p>
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Mail className="size-3.5" />
              취소 확인 메일 발송: {BOOKED.customerEmail}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm font-semibold">예약을 취소할까요?</p>
            <button
              type="button"
              onClick={d.confirmCancel}
              disabled={!!d.busy}
              data-testid={`${T}-cancel-confirm-button`}
              className="w-full rounded-xl bg-rose-600 py-3 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-50 dark:bg-rose-700 dark:hover:bg-rose-600"
            >
              {d.busy ? "처리 중…" : "예약 취소"}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

function Invalid() {
  return (
    <div className="w-full max-w-sm rounded-2xl border bg-card p-8 text-center shadow-sm" data-testid={`${T}-invalid`}>
      <div className="mx-auto mb-4 grid size-12 place-items-center rounded-full bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400">
        <Link2Off className="size-5" />
      </div>
      <h1 className="font-semibold">링크를 열 수 없습니다</h1>
      <p className="mt-1 text-sm text-muted-foreground">만료되었거나 취소된 일정</p>
    </div>
  )
}
