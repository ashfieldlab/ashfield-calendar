"use client"

import Link from "next/link"
import { Building2, CalendarSync, ChevronRight, DoorOpen, Mail, MailOpen, ScrollText, Users, Webhook } from "lucide-react"
import { useToast } from "@/components/ui-custom/use-toast"

import { useAppContext } from "@/components/providers/app-context"
import { api } from "@/lib/api-client"
import { useApiGet } from "@/lib/hooks/use-api"
import type { EmailPreferenceResponse } from "@/lib/types/api"

// 백엔드 _TYPE_CATEGORY(email.py)와 키 일치. event_reminder 등은 게이팅 없음.
const EMAIL_CATEGORIES = [
  { key: "event", label: "일정 초대·응답" },
  { key: "booking", label: "예약" },
] as const

export default function SettingsPage() {
  const { toast } = useToast()
  const { activeWorkspaceId, isWorkspaceAdmin, isSystemAdmin } = useAppContext()
  const { data, mutate, isLoading } = useApiGet<EmailPreferenceResponse>(
    "/api/v1/notifications/preferences",
  )

  async function patchPref(body: {
    email_enabled?: boolean
    email_categories?: Record<string, boolean>
  }) {
    try {
      await api<EmailPreferenceResponse>(
        "/api/v1/notifications/preferences",
        { method: "PATCH", body },
      )
      void mutate()
    } catch (e) {
      toast.error(`실패: ${(e as Error).message}`)
    }
  }

  async function toggleEmail() {
    if (!data) return
    await patchPref({ email_enabled: !data.email_enabled })
    toast.success(
      data.email_enabled ? "이메일 알림을 껐습니다" : "이메일 알림을 켰습니다",
    )
  }

  function toggleCategory(key: string) {
    if (!data) return
    // 키 없으면 on 이 기본: 없으면 현재값 true 로 간주.
    const current = data.email_categories[key] !== false
    void patchPref({ email_categories: { [key]: !current } })
  }

  const workspaceBase = activeWorkspaceId
    ? `/settings/workspace/${encodeURIComponent(activeWorkspaceId)}`
    : null

  return (
    <div
      className="h-full space-y-6 overflow-y-auto px-4 py-8 sm:px-6 lg:px-8"
      data-testid="settings-page"
    >
      <h1 className="text-2xl font-bold text-gray-900">설정</h1>

      <section className="rounded-lg border border-gray-200 bg-white p-5">
        <h2 className="mb-3 text-sm font-semibold text-gray-900">알림</h2>
        {isLoading || !data ? (
          <p className="text-sm text-gray-500">불러오는 중…</p>
        ) : (
          <div className="space-y-4">
            <label className="flex items-start gap-3 text-sm">
              <input
                type="checkbox"
                checked={data.email_enabled}
                onChange={toggleEmail}
                data-testid="settings-email-toggle"
                className="mt-0.5 rounded border-gray-300"
              />
              <span className="font-medium text-gray-900">이메일 알림</span>
            </label>

            <div className="ml-7 space-y-2 border-l border-gray-100 pl-4">
              <p className="text-xs font-medium text-gray-500">
                받을 이메일 종류
              </p>
              {EMAIL_CATEGORIES.map((c) => (
                <label
                  key={c.key}
                  className="flex items-start gap-3 text-sm"
                  data-testid={`settings-email-category-${c.key}`}
                >
                  <input
                    type="checkbox"
                    checked={data.email_enabled && data.email_categories[c.key] !== false}
                    disabled={!data.email_enabled}
                    onChange={() => toggleCategory(c.key)}
                    data-testid={`settings-email-category-${c.key}-toggle`}
                    className="mt-0.5 rounded border-gray-300 disabled:opacity-40"
                  />
                  <span className={data.email_enabled ? "" : "opacity-40"}>
                    <span className="block text-gray-900">{c.label}</span>
                  </span>
                </label>
              ))}
            </div>
          </div>
        )}
      </section>

      <section className="rounded-lg border border-gray-200 bg-white">
        <header className="border-b border-gray-100 px-5 py-3">
          <h2 className="text-sm font-semibold text-gray-900">외부 연동</h2>
        </header>
        <ul className="divide-y divide-gray-100">
          <SettingsRow
            href="/settings/caldav"
            icon={<CalendarSync size={16} />}
            title="외부 캘린더 앱 연결"
            testid="settings-link-caldav"
          />
        </ul>
      </section>

      {isSystemAdmin && (
        <section className="rounded-lg border border-gray-200 bg-white">
          <header className="border-b border-gray-100 px-5 py-3">
            <h2 className="text-sm font-semibold text-gray-900">시스템 관리</h2>
          </header>
          <ul className="divide-y divide-gray-100">
            <SettingsRow
              href="/admin/workspaces"
              icon={<Building2 size={16} />}
              title="워크스페이스 관리"
              testid="settings-link-admin-workspaces"
            />
            <SettingsRow
              href="/admin/smtp"
              icon={<Mail size={16} />}
              title="SMTP 설정"
              testid="settings-link-admin-smtp"
            />
            <SettingsRow
              href="/audit"
              icon={<ScrollText size={16} />}
              title="감사 로그"
              testid="settings-link-audit"
            />
            <SettingsRow
              href="/webhooks"
              icon={<Webhook size={16} />}
              title="웹훅"
              testid="settings-link-webhooks"
            />
          </ul>
        </section>
      )}

      {isWorkspaceAdmin && workspaceBase && (
        <section className="rounded-lg border border-gray-200 bg-white">
          <header className="border-b border-gray-100 px-5 py-3">
            <h2 className="text-sm font-semibold text-gray-900">
              워크스페이스 관리 ({activeWorkspaceId})
            </h2>
          </header>
          <ul className="divide-y divide-gray-100">
            <SettingsRow
              href={`${workspaceBase}/profile`}
              icon={<Building2 size={16} />}
              title="워크스페이스 정보"
              testid="settings-link-profile"
            />
            <SettingsRow
              href={`${workspaceBase}/members`}
              icon={<Users size={16} />}
              title="멤버"
              testid="settings-link-members"
            />
            <SettingsRow
              href={`${workspaceBase}/rooms`}
              icon={<DoorOpen size={16} />}
              title="회의실"
              testid="settings-link-rooms"
            />
            <SettingsRow
              href="/audit"
              icon={<ScrollText size={16} />}
              title="감사 로그"
              testid="settings-link-workspace-audit"
            />
            <SettingsRow
              href={`${workspaceBase}/smtp`}
              icon={<Mail size={16} />}
              title="SMTP 설정"
              testid="settings-link-smtp"
            />
            <SettingsRow
              href={`${workspaceBase}/email-templates`}
              icon={<MailOpen size={16} />}
              title="이메일 템플릿"
              testid="settings-link-email-templates"
            />
          </ul>
        </section>
      )}
    </div>
  )
}

function SettingsRow({
  href,
  icon,
  title,
  testid,
}: {
  href: string
  icon: React.ReactNode
  title: string
  testid: string
}) {
  return (
    <li>
      <Link
        href={href}
        data-testid={testid}
        className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-gray-50"
      >
        <div className="flex items-center gap-3">
          <span className="text-gray-500">{icon}</span>
          <div className="text-sm font-medium text-gray-900">{title}</div>
        </div>
        <ChevronRight size={16} className="shrink-0 text-gray-400" />
      </Link>
    </li>
  )
}
