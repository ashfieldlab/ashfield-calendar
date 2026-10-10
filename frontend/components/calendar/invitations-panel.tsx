"use client"

import { useEffect, useState } from "react"
import { AlertTriangle, Trash2 } from "lucide-react"

import { api } from "@/lib/api-client"
import { useAppContext } from "@/components/providers/app-context"
import { useApiGet, invalidateApi } from "@/lib/hooks/use-api"
import { useToast } from "@/components/ui-custom/use-toast"

import { AttendeeInputs } from "./attendee-inputs"
import type {
  AttendeeConflictsResponse,
  EventInvitationList,
  EventInvitationResponseDto,
  EventResponse,
  InvitationResponse,
} from "@/lib/types/api"

interface Props {
  event: EventResponse
}

export const RESPONSE_LABELS: Record<InvitationResponse, string> = {
  pending: "대기",
  accepted: "수락",
  declined: "거절",
  tentative: "미정",
}

/** 초대 목록, 내 초대, 응답, 참석자 겹침. 편집 폼의 참석자 칸과 상세 시트가 같이 쓴다. */
export function useInvitations(event: EventResponse | null | undefined) {
  const { authUser } = useAppContext()
  const { toast } = useToast()
  const path = event ? `/api/v1/events/${event.id}/invitations` : null
  const { data, mutate } = useApiGet<EventInvitationList>(path)
  const conflicts = useAttendeeConflicts(event ?? null, data)
  const myInvitation = (data?.invitations ?? []).find(
    (i) => i.invitee_sub === authUser?.id,
  )

  async function respond(response: InvitationResponse): Promise<boolean> {
    if (!myInvitation || !path) return false
    try {
      await api(`${path}/${myInvitation.id}`, {
        method: "PATCH",
        body: { response },
      })
      void mutate()
      invalidateApi("/api/v1/events")
      return true
    } catch (e) {
      toast.error(`응답 실패: ${(e as Error).message}`)
      return false
    }
  }

  return { path, data, mutate, conflicts, myInvitation, respond }
}

export function InvitationsPanel({ event }: Props) {
  const { authUser } = useAppContext()
  const { toast } = useToast()
  const { data, mutate, conflicts, myInvitation, respond } = useInvitations(event)
  const path = `/api/v1/events/${event.id}/invitations`
  const [busy, setBusy] = useState(false)

  const isCreator = authUser?.id === event.created_by_sub

  async function invite(sub: string) {
    setBusy(true)
    try {
      await api(path, { method: "POST", body: { invitee_sub: sub } })
      toast.success("초대했습니다")
      void mutate()
    } catch (e) {
      toast.error(`초대 실패: ${(e as Error).message}`)
    } finally {
      setBusy(false)
    }
  }

  async function inviteEmail(email: string) {
    setBusy(true)
    try {
      await api(path, { method: "POST", body: { invitee_email: email } })
      toast.success("초대 메일을 보냈습니다")
      void mutate()
    } catch (e) {
      toast.error(`초대 실패: ${(e as Error).message}`)
    } finally {
      setBusy(false)
    }
  }

  async function remove(inv: EventInvitationResponseDto) {
    try {
      await api(`${path}/${inv.id}`, { method: "DELETE" })
      toast.success("제거했습니다")
      void mutate()
    } catch (e) {
      toast.error(`제거 실패: ${(e as Error).message}`)
    }
  }

  return (
    <div className="space-y-2" data-testid="invitations-panel">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">참석자</span>
        <span className="text-xs text-muted-foreground">
          {data?.invitations.length ?? 0}명
        </span>
      </div>

      {isCreator && (
        <AttendeeInputs
          testid="invitation"
          busy={busy}
          onAddMember={(sub) => invite(sub)}
          onAddEmail={(email) => inviteEmail(email)}
        />
      )}

      {myInvitation && (
        <div
          className="rounded border border-blue-200 dark:border-blue-900/60 bg-blue-50 dark:bg-blue-950/40 p-2"
          data-testid="invitation-response-panel"
        >
          <div className="mb-1.5 text-xs text-blue-700 dark:text-blue-300">
            이 일정에 초대받았습니다. 현재 응답:{" "}
            <strong>{RESPONSE_LABELS[myInvitation.response]}</strong>
          </div>
          <div className="flex gap-1.5">
            {(["accepted", "tentative", "declined"] as InvitationResponse[]).map(
              (r) => (
                <button
                  key={r}
                  onClick={() => respond(r)}
                  data-testid={`invitation-respond-${r}`}
                  className={`rounded px-2 py-1 text-xs font-medium ${
                    myInvitation.response === r
                      ? "bg-primary text-primary-foreground"
                      : "bg-card text-foreground/80 hover:bg-muted border border-input"
                  }`}
                >
                  {RESPONSE_LABELS[r]}
                </button>
              ),
            )}
          </div>
        </div>
      )}

      {conflicts.length > 0 && (
        <div
          className="flex items-start gap-1.5 rounded border border-amber-200 dark:border-amber-900/60 bg-amber-50 dark:bg-amber-950/40 px-2.5 py-1.5 text-xs text-amber-800 dark:text-amber-200"
          data-testid="invitation-conflicts-warning"
        >
          <AlertTriangle size={13} className="mt-0.5 shrink-0" />
          <span>이 시간에 다른 일정이 있는 참석자: {conflicts.join(", ")}</span>
        </div>
      )}

      {(data?.invitations ?? []).length > 0 && (
        <ul className="divide-y rounded-lg border text-sm">
          {data!.invitations.map((inv) => (
            <li
              key={inv.id}
              data-testid={`invitation-row-${inv.id}`}
              className="flex items-center justify-between px-2.5 py-1.5"
            >
              <div className="flex min-w-0 items-baseline gap-2">
                <span
                  className="truncate font-medium"
                  title={inv.invitee_name ?? inv.invitee_email ?? inv.invitee_sub ?? ""}
                >
                  {inv.invitee_name ?? inv.invitee_email ?? inv.invitee_sub}
                </span>
                {inv.external && (
                  <span className="shrink-0 rounded bg-amber-100 dark:bg-amber-900/40 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 dark:text-amber-200">
                    외부
                  </span>
                )}
                <span className="shrink-0 text-xs text-muted-foreground">
                  {RESPONSE_LABELS[inv.response]}
                </span>
              </div>
              {isCreator && (
                <button
                  onClick={() => remove(inv)}
                  data-testid={`invitation-row-${inv.id}-remove`}
                  className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-destructive"
                  title="제거"
                >
                  <Trash2 size={12} />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/**
 * 참석자 일정 겹침 경고용 이름 목록. 업무 일정(초대, 워크스페이스 캘린더, 주최 회의)만 보고,
 * 저장은 막지 않는다. 반복 일정은 저장된 첫 회차 시각 기준.
 */
function useAttendeeConflicts(
  event: EventResponse | null,
  data: EventInvitationList | undefined,
): string[] {
  const [names, setNames] = useState<string[]>([])
  const subs = (data?.invitations ?? [])
    .filter((i) => i.invitee_sub && i.response !== "declined")
    .map((i) => i.invitee_sub as string)
    .sort()
    .join(",")

  const eventId = event?.id
  const startAt = event?.start_at
  const endAt = event?.end_at

  useEffect(() => {
    let cancelled = false
    if (!subs || !eventId || !startAt || !endAt) {
      void Promise.resolve().then(() => !cancelled && setNames([]))
      return () => {
        cancelled = true
      }
    }
    api<AttendeeConflictsResponse>("/api/v1/events/conflicts", {
      method: "POST",
      body: {
        start_at: startAt,
        end_at: endAt,
        attendee_subs: subs.split(","),
        exclude_event_id: eventId,
      },
    })
      .then((r) => !cancelled && setNames(r.conflicts.map((c) => c.name ?? c.sub)))
      .catch(() => !cancelled && setNames([]))
    return () => {
      cancelled = true
    }
  }, [subs, eventId, startAt, endAt])

  return names
}
