"use client"

import { useToast } from "@/components/ui-custom/use-toast"
import { SettingsSection, Switch } from "@/components/settings/settings-parts"
import { api } from "@/lib/api-client"
import { useApiGet } from "@/lib/hooks/use-api"
import type { EmailPreferenceResponse } from "@/lib/types/api"
import { cn } from "@/lib/utils"

// 백엔드 _TYPE_CATEGORY(email.py)와 키 일치. event_reminder 등은 게이팅 없음.
const EMAIL_CATEGORIES = [
  { key: "event", label: "일정 초대와 응답" },
  { key: "booking", label: "예약" },
] as const

const PREF_URL = "/api/v1/notifications/preferences"

/** 설정 > 알림 */
export default function SettingsPage() {
  const { toast } = useToast()
  const { data, mutate } = useApiGet<EmailPreferenceResponse>(PREF_URL)

  async function patchPref(body: { email_enabled?: boolean; email_categories?: Record<string, boolean> }) {
    try {
      await api<EmailPreferenceResponse>(PREF_URL, { method: "PATCH", body })
      await mutate()
      return true
    } catch (e) {
      toast.error(`실패: ${(e as Error).message}`)
      return false
    }
  }

  async function toggleEmail() {
    if (!data) return
    if (await patchPref({ email_enabled: !data.email_enabled })) {
      toast.success(data.email_enabled ? "이메일 알림을 껐습니다" : "이메일 알림을 켰습니다")
    }
  }

  function toggleCategory(key: string) {
    if (!data) return
    // 키 없으면 on 이 기본.
    const current = data.email_categories[key] !== false
    void patchPref({ email_categories: { [key]: !current } })
  }

  const on = data?.email_enabled ?? false

  return (
    <SettingsSection title="알림" testid="settings-page">
      {!data ? (
        <div className="mt-6 h-40 animate-pulse rounded-xl border bg-muted/30" />
      ) : (
        <div className="mt-6 divide-y rounded-xl border">
          <div className="flex items-center gap-3 px-4 py-3.5">
            <span className="flex-1 text-sm font-medium">이메일 알림</span>
            <Switch checked={on} onChange={toggleEmail} testId="settings-email-toggle" label="이메일 알림" />
          </div>
          {EMAIL_CATEGORIES.map((c) => (
            <div
              key={c.key}
              className={cn("flex items-center gap-3 py-3 pl-8 pr-4", !on && "opacity-50")}
              data-testid={`settings-email-category-${c.key}`}
            >
              <span className="flex-1 text-sm">{c.label}</span>
              <Switch
                checked={on && data.email_categories[c.key] !== false}
                disabled={!on}
                onChange={() => toggleCategory(c.key)}
                testId={`settings-email-category-${c.key}-toggle`}
                label={c.label}
              />
            </div>
          ))}
        </div>
      )}
    </SettingsSection>
  )
}
