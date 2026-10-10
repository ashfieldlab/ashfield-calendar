"use client"

import Link from "next/link"
import { ArrowRight, ArrowUpRight, CalendarDays, Mail, MailOpen, MapPin, User } from "lucide-react"

import { Sentence } from "@/components/shared/sentence"
import { cn } from "@/lib/utils"
import { relativeTime } from "@/lib/utils/audit-format"
import { rangeText, seedColor, whenText } from "@/lib/utils/day-format"
import { formatDateTime } from "@/lib/utils/format"
import {
  RSVP_LABEL,
  isBookingType,
  isCancelled,
  notifHref,
  notifSentence,
  type NotifView,
} from "@/lib/utils/notification-format"

import { RsvpButtons } from "./rsvp-buttons"
import { TypeIcon } from "./type-icon"
import type { useNotificationActions } from "./use-notification-actions"

type Actions = ReturnType<typeof useNotificationActions>

/** 알림 상세: 일정 카드, 할 일(초대 응답, 바뀐 내용, 예약자 정보), 읽음 토글, 일정 열기 */
export function NotificationDetail({ v, actions }: { v: NotifView; actions: Actions }) {
  const past = isCancelled(v)
  const canRespond = v.type === "event_invited" && !!v.eventId && !!v.invitationId

  return (
    <div className="space-y-6 p-6" data-testid="notifications-detail">
      <div className="flex items-start gap-3">
        <TypeIcon type={v.type} className="size-10 [&_svg]:size-5" />
        <div className="min-w-0 flex-1">
          <p className="text-base font-semibold break-keep">
            <Sentence parts={notifSentence(v)} />
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground" title={formatDateTime(v.at)}>
            {relativeTime(v.at)}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void actions.setRead(v.id, !v.read)}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs text-muted-foreground hover:text-foreground"
          data-testid="notifications-detail-toggle-read"
        >
          {v.read ? <Mail className="size-3.5" /> : <MailOpen className="size-3.5" />}
          {v.read ? "안 읽음으로" : "읽음으로"}
        </button>
      </div>

      <div className="flex gap-4 rounded-xl border p-4" data-testid="notifications-detail-card">
        <span className="w-1 shrink-0 rounded-full" style={{ background: v.calendarColor ?? "var(--muted-foreground)" }} />
        <div className="min-w-0 space-y-2 text-sm">
          <p className={cn("text-lg font-semibold", past && "text-muted-foreground line-through")}>{v.title}</p>
          {v.start && (
            <p className="flex items-center gap-2 text-muted-foreground">
              <CalendarDays className="size-4 shrink-0" />
              <span className={cn(past && "line-through")}>{rangeText(v.start, v.end, v.allDay)}</span>
            </p>
          )}
          {v.location && (
            <p className="flex items-center gap-2 text-muted-foreground">
              <MapPin className="size-4 shrink-0" />
              {v.location}
            </p>
          )}
          {v.calendarName && (
            <p className="flex items-center gap-2 text-muted-foreground">
              <span className="ml-1 size-2 shrink-0 rounded-full" style={{ background: v.calendarColor ?? undefined }} />
              <span className="ml-1">{v.calendarName}</span>
            </p>
          )}
          {v.customer && (
            <p className="flex items-center gap-2 text-muted-foreground">
              <User className="size-4 shrink-0" />
              {[v.customer, v.customerEmail].filter(Boolean).join(", ")}
            </p>
          )}
          {v.actorName && (
            <p className="flex items-center gap-2 text-muted-foreground">
              <span
                className="inline-flex size-4 shrink-0 items-center justify-center rounded-full text-[9px] font-medium text-white"
                style={{ background: seedColor(v.actorSub ?? v.actorName) }}
              >
                {v.actorName.slice(0, 1)}
              </span>
              {v.actorName}
            </p>
          )}
        </div>
      </div>

      {canRespond && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">내 응답: {RSVP_LABEL[v.myRsvp ?? "pending"]}</p>
          <RsvpButtons
            value={v.myRsvp}
            onRespond={(r) => void actions.respond(v, r)}
            testid="notifications-detail-rsvp"
          />
        </div>
      )}

      {v.changes.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">바뀐 내용</p>
          <ul className="divide-y rounded-lg border text-sm" data-testid="notifications-detail-changes">
            {v.changes.map((c) => (
              <li key={c.label} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2">
                <span className="w-14 shrink-0 text-xs text-muted-foreground">{c.label}</span>
                {c.from && <span className="text-muted-foreground line-through">{c.from}</span>}
                {c.from && <ArrowRight className="size-3.5 text-muted-foreground" />}
                <span className="font-medium">{c.to}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {v.type === "booking_rescheduled" && v.oldStart && v.start && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border px-3 py-2 text-sm">
          <span className="text-muted-foreground line-through">{whenText(v.oldStart)}</span>
          <ArrowRight className="size-3.5 text-muted-foreground" />
          <span className="font-medium">{whenText(v.start)}</span>
        </div>
      )}

      {!past && (v.eventId || isBookingType(v)) && (
        <Link
          href={notifHref(v)}
          className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          data-testid="notifications-detail-open"
        >
          {isBookingType(v) ? "예약 양식 보기" : "일정 열기"}
          <ArrowUpRight className="size-3.5" />
        </Link>
      )}
    </div>
  )
}
