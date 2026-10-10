"use client"

import { api } from "@/lib/api-client"
import { invalidateApi } from "@/lib/hooks/use-api"
import { useToast } from "@/components/ui-custom/use-toast"
import type { RsvpResponse } from "@/lib/types/notification"
import { logger } from "@/lib/utils/logger"
import { josaRo } from "@/lib/utils/josa"
import { RSVP_LABEL, type NotifView } from "@/lib/utils/notification-format"

const KEY = "/api/v1/notifications"

/** 알림 읽음, 안 읽음, 모두 읽음, 초대 응답. 끝나면 종 팝오버와 페이지 목록을 함께 다시 받는다 */
export function useNotificationActions() {
  const { toast } = useToast()

  async function run(label: string, fn: () => Promise<unknown>) {
    try {
      await fn()
    } catch (e) {
      logger.warn("notification_action_failed", { category: "api", label, error: (e as Error).message })
      toast.error(`실패: ${(e as Error).message}`)
      return false
    } finally {
      invalidateApi(KEY)
    }
    return true
  }

  return {
    setRead: (id: string, read: boolean) =>
      run("set_read", () => api(`${KEY}/${id}`, { method: "PATCH", body: { read } })),
    markAll: () => run("mark_all", () => api(`${KEY}/mark-all-read`, { method: "POST" })),
    respond: async (v: NotifView, r: RsvpResponse) => {
      if (!v.eventId || !v.invitationId) return
      const ok = await run("respond", async () => {
        await api(`/api/v1/events/${v.eventId}/invitations/${v.invitationId}`, {
          method: "PATCH",
          body: { response: r },
        })
        if (!v.read) await api(`${KEY}/${v.id}`, { method: "PATCH", body: { read: true } })
      })
      if (ok) {
        invalidateApi("/api/v1/events")
        toast.success(`${RSVP_LABEL[r]}${josaRo(RSVP_LABEL[r])} 응답`)
      }
    },
  }
}
