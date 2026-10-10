"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import {
  AlertTriangle,
  AlignLeft,
  Bell,
  Check,
  CircleHelp,
  Clock,
  Copy,
  DoorOpen,
  Download,
  Lock,
  MapPin,
  Pencil,
  Ticket,
  Trash2,
  X,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { useToast } from "@/components/ui-custom/use-toast"
import { useAppContext } from "@/components/providers/app-context"
import { api, apiDownload } from "@/lib/api-client"
import { invalidateApi, useApiGet } from "@/lib/hooks/use-api"
import type { CalendarResponse, EventResponse, InvitationResponse } from "@/lib/types/api"
import { cn } from "@/lib/utils"
import {
  allDayLastDay,
  avatarColor,
  dayLabel,
  describeRrule,
  durationLabel,
  hostOf,
  reminderLabel,
  timeOfDay,
} from "@/lib/utils/event-format"

import { RESPONSE_LABELS, useInvitations } from "./invitations-panel"

const T = "event-detail"

export type EditScope = "occurrence" | "series"

/** 시트가 보여 줄 일정: 반복이면 누른 회차의 시각. */
export interface DetailTarget {
  eventId: string
  start: string
  end: string
}

type Kind = "organizer" | "invitee" | "member" | "readonly" | "booking"

const RSVP_ORDER: InvitationResponse[] = ["accepted", "tentative", "pending", "declined"]
const RSVP_CHOICES: InvitationResponse[] = ["accepted", "tentative", "declined"]

const RSVP_ICON: Record<InvitationResponse, typeof Check> = {
  accepted: Check,
  tentative: CircleHelp,
  declined: X,
  pending: Clock,
}

const RSVP_DOT: Record<InvitationResponse, string> = {
  accepted: "bg-emerald-500 dark:bg-emerald-400",
  tentative: "bg-amber-500 dark:bg-amber-400",
  declined: "bg-rose-500 dark:bg-rose-400",
  pending: "bg-muted-foreground/40",
}

const RSVP_TEXT: Record<InvitationResponse, string> = {
  accepted: "text-emerald-700 dark:text-emerald-300",
  tentative: "text-amber-700 dark:text-amber-300",
  declined: "text-rose-700 dark:text-rose-300",
  pending: "text-muted-foreground",
}

const RSVP_ACTIVE: Record<InvitationResponse, string> = {
  accepted:
    "border-emerald-600 bg-emerald-600 text-white dark:border-emerald-500 dark:bg-emerald-500 dark:text-emerald-950",
  tentative:
    "border-amber-500 bg-amber-500 text-white dark:border-amber-400 dark:bg-amber-400 dark:text-amber-950",
  declined: "border-rose-600 bg-rose-600 text-white dark:border-rose-500 dark:bg-rose-500 dark:text-rose-950",
  pending: "border-input bg-muted text-foreground",
}

const SCOPE_LABEL: Record<EditScope, string> = {
  occurrence: "이 일정만",
  series: "전체 반복 일정",
}

interface Attendee {
  key: string
  name: string
  sub: string
  response: InvitationResponse
  organizer: boolean
  me: boolean
  external: boolean
  email: string
}

interface Props {
  target: DetailTarget
  calendars: CalendarResponse[]
  onClose: () => void
  /** 편집 모달 열기 (반복이면 고른 범위) */
  onEdit: (event: EventResponse, start: Date, scope?: EditScope) => void
  /** 새 일정 모달을 이 일정 값으로 채워 열기 */
  onDuplicate: (event: EventResponse, start: Date) => void
}

/** 일정 상세: 달력 오른쪽에 붙는 시트. 다른 일정을 누르면 내용만 바뀐다. */
export function EventDetailSheet({ target, calendars, onClose, onEdit, onDuplicate }: Props) {
  const { data: ev, error } = useApiGet<EventResponse>(`/api/v1/events/${target.eventId}`)

  useEffect(() => {
    // 지워졌거나 볼 권한이 없으면 닫는다.
    if (error) onClose()
  }, [error, onClose])

  return (
    <aside
      className="fixed inset-0 z-40 flex flex-col bg-card md:static md:z-auto md:w-[400px] md:shrink-0 md:border-l"
      data-testid={`${T}-sheet`}
      aria-label="일정 상세"
    >
      {ev && ev.id === target.eventId ? (
        <SheetBody
          key={`${target.eventId}-${target.start}`}
          ev={ev}
          target={target}
          calendars={calendars}
          onClose={onClose}
          onEdit={onEdit}
          onDuplicate={onDuplicate}
        />
      ) : (
        <>
          <div className="flex items-center border-b px-3 py-2">
            <Button variant="ghost" size="icon-sm" onClick={onClose} title="닫기" data-testid={`${T}-close-button`}>
              <X />
            </Button>
          </div>
          <div className="space-y-3 p-5">
            <div className="h-3 w-24 animate-pulse rounded bg-muted" />
            <div className="h-6 w-3/4 animate-pulse rounded bg-muted" />
            <div className="h-4 w-1/2 animate-pulse rounded bg-muted" />
          </div>
        </>
      )}
    </aside>
  )
}

function SheetBody({
  ev,
  target,
  calendars,
  onClose,
  onEdit,
  onDuplicate,
}: {
  ev: EventResponse
  target: DetailTarget
  calendars: CalendarResponse[]
  onClose: () => void
  onEdit: Props["onEdit"]
  onDuplicate: Props["onDuplicate"]
}) {
  const { toast } = useToast()
  const router = useRouter()
  const { authUser } = useAppContext()
  const [tab, setTab] = useState<"info" | "people">("info")
  const [scope, setScope] = useState<EditScope>("occurrence")
  const [confirm, setConfirm] = useState(false)
  const [busy, setBusy] = useState(false)
  const inv = useInvitations(ev)

  const cal = calendars.find((c) => c.id === ev.calendar_id)
  const calName = cal?.name ?? ev.calendar_name ?? ""
  const calColor = cal?.color_override ?? cal?.color ?? ev.calendar_color ?? "#6b7280"
  const start = new Date(target.start)
  const end = new Date(target.end)
  const recurring = !!ev.rrule
  const isMe = (sub: string | null) => !!sub && sub === authUser?.id

  const kind: Kind =
    cal?.source === "external_ics"
      ? "readonly"
      : ev.booking_id
        ? "booking"
        : isMe(ev.created_by_sub)
          ? "organizer"
          : inv.myInvitation
            ? "invitee"
            : "member"
  // 내 목록에 있는 캘린더면 쓸 수 있다 (개인은 본인 것, 공유는 멤버). 초대만 받은 남의 개인 캘린더는 불가.
  const canEdit = (kind === "organizer" || kind === "invitee" || kind === "member") && !!cal
  const canDelete = canEdit && kind !== "invitee"
  const scopeArg = recurring ? scope : undefined

  const invitations = inv.data?.invitations ?? []
  const attendees: Attendee[] =
    invitations.length === 0
      ? []
      : [
          {
            key: "organizer",
            name: ev.organizer_name || ev.organizer_email || "주최자",
            sub: ev.created_by_sub,
            response: "accepted",
            organizer: true,
            me: isMe(ev.created_by_sub),
            external: false,
            email: ev.organizer_email ?? "",
          },
          ...invitations.map((i) => ({
            key: i.id,
            name: i.invitee_name || i.invitee_email || i.invitee_sub || "",
            sub: i.invitee_sub ?? i.invitee_email ?? i.id,
            response: i.response,
            organizer: false,
            me: isMe(i.invitee_sub),
            external: i.external,
            email: i.invitee_email ?? "",
          })),
        ]
  const counts = { accepted: 0, tentative: 0, declined: 0, pending: 0 } as Record<InvitationResponse, number>
  for (const a of attendees) counts[a.response] += 1
  const hasPeople = attendees.length > 0

  let dayText: string
  let timeText: string
  if (ev.all_day) {
    const last = allDayLastDay(start, end)
    const multi = last.toDateString() !== start.toDateString()
    dayText = multi ? `${dayLabel(start)} ~ ${dayLabel(last)}` : dayLabel(start)
    timeText = "종일"
  } else {
    dayText = dayLabel(start)
    timeText = `${timeOfDay(start)} ~ ${timeOfDay(end)}, ${durationLabel(start, end)}`
  }

  async function downloadIcs() {
    try {
      await apiDownload(`/api/v1/events/${ev.id}/ics`, `${ev.title || "event"}.ics`)
    } catch (e) {
      toast.error(`다운로드 실패: ${(e as Error).message}`)
    }
  }

  async function remove() {
    setBusy(true)
    try {
      const url =
        scopeArg === "occurrence"
          ? `/api/v1/events/${ev.id}?occurrence=${encodeURIComponent(start.toISOString())}`
          : `/api/v1/events/${ev.id}`
      await api(url, { method: "DELETE" })
      toast.success(
        scopeArg === "occurrence"
          ? "이 일정을 삭제했습니다"
          : scopeArg === "series"
            ? "반복 일정을 삭제했습니다"
            : "일정을 삭제했습니다",
      )
      invalidateApi("/api/v1/events")
      onClose()
    } catch (e) {
      toast.error(`삭제 실패: ${(e as Error).message}`)
    } finally {
      setBusy(false)
      setConfirm(false)
    }
  }

  async function respond(r: InvitationResponse) {
    if (await inv.respond(r)) toast.success(`응답: ${RESPONSE_LABELS[r]}`)
  }

  const editLabel = recurring ? `${SCOPE_LABEL[scope]} 편집` : "편집"

  return (
    <>
      <div className="flex items-center gap-1 border-b px-3 py-2">
        <Button variant="ghost" size="icon-sm" onClick={onClose} title="닫기" data-testid={`${T}-close-button`}>
          <X />
        </Button>
        <div className="ml-auto flex gap-0.5">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => onDuplicate(ev, start)}
            title="복제"
            data-testid={`${T}-duplicate-button`}
          >
            <Copy />
          </Button>
          <Button variant="ghost" size="icon-sm" onClick={downloadIcs} title=".ics 다운로드" data-testid={`${T}-ics-button`}>
            <Download />
          </Button>
        </div>
      </div>

      <div className="flex gap-3 px-5 pb-4 pt-5">
        <span className="w-1 shrink-0 rounded-full" style={{ backgroundColor: calColor }} />
        <div className="min-w-0">
          <p className="text-xs font-medium text-muted-foreground" data-testid={`${T}-calendar`}>
            {calName}
          </p>
          <h2 className="mt-0.5 break-words text-xl font-semibold leading-snug" data-testid={`${T}-title`}>
            {ev.title}
          </h2>
          <p className="mt-1 text-sm">{dayText}</p>
          <p className="text-sm text-muted-foreground">{timeText}</p>
        </div>
      </div>

      {recurring && (canEdit || canDelete) && (
        <div className="mx-5 mb-4 flex items-center gap-2 rounded-lg bg-muted/60 p-1 text-sm">
          <span className="truncate pl-2 text-xs text-muted-foreground">{describeRrule(ev.rrule)}</span>
          <div className="ml-auto inline-flex shrink-0" role="radiogroup" aria-label="범위">
            {(["occurrence", "series"] as EditScope[]).map((s) => (
              <button
                key={s}
                type="button"
                role="radio"
                aria-checked={scope === s}
                onClick={() => setScope(s)}
                className={cn(
                  "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                  scope === s ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
                )}
                data-testid={`${T}-scope-${s}`}
              >
                {s === "occurrence" ? "이 일정만" : "전체"}
              </button>
            ))}
          </div>
        </div>
      )}

      {hasPeople && (
        <div className="flex gap-4 border-b px-5 text-sm" role="tablist">
          {(
            [
              ["info", "상세"],
              ["people", `참석자 ${attendees.length}`],
            ] as const
          ).map(([k, label]) => (
            <button
              key={k}
              type="button"
              role="tab"
              aria-selected={tab === k}
              onClick={() => setTab(k)}
              className={cn(
                "-mb-px border-b-2 py-2 font-medium transition-colors",
                tab === k
                  ? "border-foreground text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
              data-testid={`${T}-tab-${k}`}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
        {tab === "info" || !hasPeople ? (
          <Info ev={ev} cal={cal} myResponse={inv.myInvitation?.response ?? null} />
        ) : (
          <People attendees={attendees} counts={counts} conflicts={inv.conflicts} />
        )}
      </div>

      <div className="border-t p-3">
        {confirm ? (
          <div
            className="flex items-center gap-2 rounded-lg bg-rose-50 p-2 dark:bg-rose-950/40"
            data-testid={`${T}-delete-confirm`}
          >
            <span className="mr-auto pl-1 text-sm font-medium text-rose-800 dark:text-rose-200">
              {recurring ? `${SCOPE_LABEL[scope]} 삭제` : "삭제할까요?"}
            </span>
            <Button size="sm" variant="ghost" onClick={() => setConfirm(false)} disabled={busy} data-testid={`${T}-delete-cancel`}>
              취소
            </Button>
            <Button size="sm" variant="destructive" onClick={remove} disabled={busy} data-testid={`${T}-delete-ok`}>
              삭제
            </Button>
          </div>
        ) : kind === "invitee" ? (
          <div className="space-y-2">
            <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="참석 응답">
              {RSVP_CHOICES.map((r) => {
                const Icon = RSVP_ICON[r]
                const on = inv.myInvitation?.response === r
                return (
                  <button
                    key={r}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    onClick={() => respond(r)}
                    className={cn(
                      "flex flex-col items-center gap-1 rounded-lg border py-2 text-xs font-medium transition-colors",
                      on ? RSVP_ACTIVE[r] : "border-input hover:bg-muted",
                    )}
                    data-testid={`${T}-rsvp-${r}`}
                  >
                    <Icon className="size-4" />
                    {RESPONSE_LABELS[r]}
                  </button>
                )
              })}
            </div>
            {canEdit && (
              <Button
                variant="outline"
                className="w-full"
                onClick={() => onEdit(ev, start, scopeArg)}
                data-testid={`${T}-edit-button`}
              >
                <Pencil />
                {editLabel}
              </Button>
            )}
          </div>
        ) : kind === "booking" ? (
          <Button
            variant="outline"
            className="w-full"
            onClick={() => ev.booking && router.push(`/booking-types/${ev.booking.booking_type_id}`)}
            disabled={!ev.booking}
            data-testid={`${T}-booking-button`}
          >
            <Ticket />
            예약 관리
          </Button>
        ) : kind === "readonly" || !canEdit ? (
          <Button
            variant="outline"
            className="w-full"
            onClick={() => onDuplicate(ev, start)}
            data-testid={`${T}-copy-mine-button`}
          >
            <Copy />
            내 캘린더로 복제
          </Button>
        ) : (
          <div className="flex gap-2">
            {canDelete && (
              <Button
                variant="ghost"
                className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                onClick={() => setConfirm(true)}
                data-testid={`${T}-delete-button`}
              >
                <Trash2 />
                삭제
              </Button>
            )}
            <Button className="ml-auto" onClick={() => onEdit(ev, start, scopeArg)} data-testid={`${T}-edit-button`}>
              <Pencil />
              {editLabel}
            </Button>
          </div>
        )}
      </div>
    </>
  )
}

function Info({
  ev,
  cal,
  myResponse,
}: {
  ev: EventResponse
  cal: CalendarResponse | undefined
  myResponse: InvitationResponse | null
}) {
  const reminder = reminderLabel(ev.reminder_minutes_before)
  return (
    <dl className="space-y-4 text-sm" data-testid={`${T}-info`}>
      {ev.booking && (
        <div className="rounded-xl border border-violet-200 bg-violet-50 p-3 dark:border-violet-900/60 dark:bg-violet-950/40">
          <p className="flex items-center gap-1.5 text-xs font-medium text-violet-700 dark:text-violet-300">
            <Ticket className="size-3.5" />
            {ev.booking.booking_type_title}
          </p>
          {ev.booking.customer_name && <p className="mt-1.5 font-medium">{ev.booking.customer_name}</p>}
          {ev.booking.customer_email && (
            <p className="text-xs text-muted-foreground">{ev.booking.customer_email}</p>
          )}
        </div>
      )}
      {ev.location && <Field icon={MapPin} label="장소" value={ev.location} />}
      {ev.room_name && (
        <Field
          icon={DoorOpen}
          label="회의실"
          value={ev.room_capacity != null ? `${ev.room_name}, ${ev.room_capacity}인` : ev.room_name}
        />
      )}
      {reminder && <Field icon={Bell} label="알림" value={reminder} />}
      {ev.description && <Field icon={AlignLeft} label="설명" value={ev.description} />}
      {cal?.source === "external_ics" && (
        <Field icon={Lock} label="구독, 읽기 전용" value={hostOf(cal.external_ics_url) || cal.name} />
      )}
      {myResponse && <Field icon={Check} label="내 응답" value={RESPONSE_LABELS[myResponse]} />}
    </dl>
  )
}

function People({
  attendees,
  counts,
  conflicts,
}: {
  attendees: Attendee[]
  counts: Record<InvitationResponse, number>
  conflicts: string[]
}) {
  return (
    <div className="space-y-3" data-testid={`${T}-people`}>
      {conflicts.length > 0 && (
        <div className="flex items-start gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-2 text-xs text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200">
          <AlertTriangle className="mt-px size-3.5 shrink-0" />
          겹치는 일정: {conflicts.join(", ")}
        </div>
      )}
      <div className="flex flex-wrap gap-1.5">
        {RSVP_ORDER.filter((r) => counts[r] > 0).map((r) => (
          <span
            key={r}
            className={cn("inline-flex items-center gap-1.5 rounded-full bg-muted px-2 py-0.5 text-xs font-medium", RSVP_TEXT[r])}
          >
            <span className={cn("size-1.5 rounded-full", RSVP_DOT[r])} />
            {RESPONSE_LABELS[r]} {counts[r]}
          </span>
        ))}
      </div>
      <ul className="divide-y">
        {[...attendees]
          .sort((a, b) => Number(b.organizer) - Number(a.organizer) || RSVP_ORDER.indexOf(a.response) - RSVP_ORDER.indexOf(b.response))
          .map((a) => {
            const Icon = RSVP_ICON[a.response]
            return (
              <li key={a.key} className="flex items-center gap-3 py-2.5" data-testid={`${T}-attendee-${a.key}`}>
                <span className="relative">
                  <span
                    className="grid size-8 place-items-center rounded-full text-sm font-semibold text-white"
                    style={{ backgroundColor: avatarColor(a.sub) }}
                  >
                    {a.name.slice(0, 1)}
                  </span>
                  <span
                    className={cn(
                      "absolute -bottom-0.5 -right-0.5 grid size-3.5 place-items-center rounded-full ring-2 ring-card",
                      RSVP_DOT[a.response],
                    )}
                  >
                    <Icon className="size-2.5 text-white" strokeWidth={3} />
                  </span>
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {a.name}
                    {a.me && <span className="ml-1 text-xs font-normal text-muted-foreground">(나)</span>}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {a.organizer ? "주최" : a.external ? `외부, ${a.email}` : a.email}
                  </p>
                </div>
                <span className={cn("text-xs", RSVP_TEXT[a.response])}>{RESPONSE_LABELS[a.response]}</span>
              </li>
            )
          })}
      </ul>
    </div>
  )
}

function Field({ icon: Icon, label, value }: { icon: typeof MapPin; label: string; value: string }) {
  return (
    <div className="flex gap-3">
      <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0">
        <dt className="text-xs text-muted-foreground">{label}</dt>
        <dd className="mt-0.5 whitespace-pre-wrap break-words">{value}</dd>
      </div>
    </div>
  )
}
