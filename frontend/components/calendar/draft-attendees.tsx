"use client"

import { useEffect, useState } from "react"
import { AlertTriangle, Mail, X } from "lucide-react"

import { api } from "@/lib/api-client"

import { AttendeeInputs } from "./attendee-inputs"
import type { AttendeeConflictsResponse, WorkspaceMember } from "@/lib/types/api"

/** 저장 전 일정의 참석자. 일정이 만들어진 뒤 초대 API 로 보낸다. */
export type DraftAttendee =
  | { kind: "member"; sub: string; label: string }
  | { kind: "email"; email: string; label: string }

interface Props {
  value: DraftAttendee[]
  onChange: (next: DraftAttendee[]) => void
  startAt: Date
  endAt: Date
}

export function DraftAttendees({ value, onChange, startAt, endAt }: Props) {
  const conflicts = useDraftConflicts(value, startAt, endAt)

  function addMember(sub: string, member: WorkspaceMember | null) {
    if (!sub || value.some((a) => a.kind === "member" && a.sub === sub)) return
    onChange([...value, { kind: "member", sub, label: member?.name || member?.email || sub }])
  }

  function addEmail(raw: string) {
    const e = raw.trim().toLowerCase()
    if (!e.includes("@") || value.some((a) => a.kind === "email" && a.email === e)) return
    onChange([...value, { kind: "email", email: e, label: e }])
  }

  return (
    <div className="space-y-2" data-testid="event-form-attendees">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">참석자</span>
        {value.length > 0 && <span className="text-xs text-muted-foreground">{value.length}명</span>}
      </div>

      <AttendeeInputs testid="event-form-attendee" onAddMember={addMember} onAddEmail={addEmail} />

      {conflicts.length > 0 && (
        <div
          className="flex items-start gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-xs text-amber-800"
          data-testid="event-form-attendee-conflicts"
        >
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
          <span>이 시간에 다른 일정이 있는 참석자: {conflicts.join(", ")}</span>
        </div>
      )}

      {value.length > 0 && (
        <ul className="flex flex-wrap gap-1.5" data-testid="event-form-attendee-list">
          {value.map((a) => {
            const key = a.kind === "member" ? a.sub : a.email
            return (
              <li
                key={key}
                className="inline-flex max-w-full items-center gap-1 rounded-full bg-muted py-1 pr-1 pl-2.5 text-xs font-medium"
              >
                {a.kind === "email" && <Mail className="size-3 shrink-0 text-muted-foreground" />}
                <span className="truncate">{a.label}</span>
                <button
                  type="button"
                  onClick={() => onChange(value.filter((x) => x !== a))}
                  aria-label={`${a.label} 빼기`}
                  data-testid={`event-form-attendee-remove-${key}`}
                  className="rounded-full p-0.5 text-muted-foreground hover:bg-background hover:text-foreground"
                >
                  <X className="size-3" />
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

/** 일정이 만들어진 뒤 참석자 초대를 보낸다. 실패한 사람 수를 돌려준다. */
export async function sendDraftInvitations(eventId: string, attendees: DraftAttendee[]): Promise<number> {
  const results = await Promise.allSettled(
    attendees.map((a) =>
      api(`/api/v1/events/${eventId}/invitations`, {
        method: "POST",
        body: a.kind === "member" ? { invitee_sub: a.sub } : { invitee_email: a.email },
      }),
    ),
  )
  return results.filter((r) => r.status === "rejected").length
}

function useDraftConflicts(attendees: DraftAttendee[], startAt: Date, endAt: Date): string[] {
  const [names, setNames] = useState<string[]>([])
  const subs = attendees
    .flatMap((a) => (a.kind === "member" ? [a.sub] : []))
    .sort()
    .join(",")
  const start = startAt.toISOString()
  const end = endAt.toISOString()

  useEffect(() => {
    let cancelled = false
    if (!subs) {
      void Promise.resolve().then(() => !cancelled && setNames([]))
      return () => {
        cancelled = true
      }
    }
    api<AttendeeConflictsResponse>("/api/v1/events/conflicts", {
      method: "POST",
      body: { start_at: start, end_at: end, attendee_subs: subs.split(",") },
    })
      .then((r) => !cancelled && setNames(r.conflicts.map((c) => c.name ?? c.sub)))
      .catch(() => !cancelled && setNames([]))
    return () => {
      cancelled = true
    }
  }, [subs, start, end])

  return names
}
