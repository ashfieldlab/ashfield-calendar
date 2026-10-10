"use client"

import { use, useState } from "react"
import Link from "next/link"
import { AlertTriangle, ArrowLeft, ShieldCheck, User } from "lucide-react"
import { useToast } from "@/components/ui-custom/use-toast"

import { useAppContext } from "@/components/providers/app-context"
import { useConfirm } from "@/components/ui-custom/use-confirm"
import { ApiError, api } from "@/lib/api-client"
import { invalidateApi, useApiGet } from "@/lib/hooks/use-api"

type CompanyRole = "admin" | "member"

interface MemberItem {
  user_sub: string
  email: string | null
  name: string | null
  role: CompanyRole
}

interface MemberListResponse {
  members: MemberItem[]
}

export default function CompanyMembersSettingsPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id: companyIdRaw } = use(params)
  const companyId = decodeURIComponent(companyIdRaw)
  const { isCompanyAdmin, companyNames, authUser } = useAppContext()
  const { toast } = useToast()
  const confirm = useConfirm()
  const [busy, setBusy] = useState<string | null>(null)
  const [newEmail, setNewEmail] = useState("")

  const url = isCompanyAdmin
    ? `/api/v1/companies/${encodeURIComponent(companyId)}/members`
    : null
  const { data, error, isLoading } = useApiGet<MemberListResponse>(url)

  if (!isCompanyAdmin) {
    return (
      <div
        className="rounded-lg border border-amber-200 bg-amber-50 p-6 text-sm text-amber-800"
        data-testid="company-members-settings-no-permission"
      >
        회사 관리자만 접근할 수 있습니다.
      </div>
    )
  }

  const adminCount =
    data?.members.filter((m) => m.role === "admin").length ?? 0

  async function setRole(member: MemberItem, role: CompanyRole) {
    setBusy(member.user_sub)
    try {
      await api(
        `/api/v1/companies/${encodeURIComponent(companyId)}/members/${encodeURIComponent(member.user_sub)}`,
        { method: "PATCH", body: { role } },
      )
      toast.success(
        role === "admin"
          ? `${member.name ?? member.user_sub} 님을 관리자로 임명했습니다`
          : `${member.name ?? member.user_sub} 님을 멤버로 변경했습니다`,
      )
      invalidateApi(url!)
    } catch (e) {
      toast.error(`변경 실패: ${(e as Error).message}`)
    } finally {
      setBusy(null)
    }
  }

  async function addMember(e: React.FormEvent) {
    e.preventDefault()
    const email = newEmail.trim()
    if (!email) return
    setBusy("__add__")
    try {
      await api(`/api/v1/companies/${encodeURIComponent(companyId)}/members`, {
        method: "POST",
        body: { email },
      })
      toast.success(`${email} 님을 멤버로 추가했습니다`)
      setNewEmail("")
      invalidateApi(url!)
    } catch (err) {
      toast.error(
        err instanceof ApiError && err.status === 404
          ? "해당 이메일로 로그인한 사용자가 없습니다. 먼저 한 번 로그인해야 합니다."
          : `추가 실패: ${(err as Error).message}`,
      )
    } finally {
      setBusy(null)
    }
  }

  async function removeMember(member: MemberItem) {
    const ok = await confirm({
      title: "멤버 제거",
      description: `${member.name ?? member.email ?? member.user_sub} 님을 이 회사에서 제거할까요?`,
      confirmText: "제거",
      variant: "destructive",
    })
    if (!ok) return
    setBusy(member.user_sub)
    try {
      await api(
        `/api/v1/companies/${encodeURIComponent(companyId)}/members/${encodeURIComponent(member.user_sub)}`,
        { method: "DELETE" },
      )
      toast.success("멤버를 제거했습니다")
      invalidateApi(url!)
    } catch (err) {
      toast.error(`제거 실패: ${(err as Error).message}`)
    } finally {
      setBusy(null)
    }
  }

  return (
    <div
      className="h-full overflow-y-auto space-y-4 px-4 py-8 sm:px-6 lg:px-8"
      data-testid="company-members-settings-page"
    >
      <Link
        href="/settings"
        className="inline-flex items-center gap-1 text-xs text-gray-600 hover:text-gray-900"
        data-testid="company-members-settings-back"
      >
        <ArrowLeft size={12} /> 설정으로
      </Link>
      <header>
        <h1 className="text-2xl font-bold text-gray-900">
          {companyNames[companyId] ?? companyId} 멤버 관리
        </h1>
      </header>

      <form
        onSubmit={addMember}
        className="flex flex-wrap items-center gap-2"
        data-testid="company-members-add-form"
      >
        <input
          type="email"
          required
          placeholder="추가할 멤버 이메일 (한 번 이상 로그인한 사용자)"
          value={newEmail}
          onChange={(e) => setNewEmail(e.target.value)}
          className="h-8 w-80 max-w-full rounded border border-gray-300 px-2 text-sm"
          data-testid="company-members-add-email-input"
        />
        <button
          type="submit"
          disabled={busy === "__add__"}
          className="h-8 rounded bg-gray-900 px-3 text-xs font-medium text-white hover:bg-gray-800 disabled:opacity-50"
          data-testid="company-members-add-button"
        >
          멤버 추가
        </button>
      </form>

      {adminCount === 0 && data && (
        <div
          className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800"
          data-testid="company-members-settings-no-admin-warning"
        >
          <AlertTriangle size={14} />
          이 회사에는 관리자가 없습니다.
        </div>
      )}

      {error ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          불러오지 못했습니다. 잠시 후 다시 시도해주세요.
        </div>
      ) : isLoading ? (
        <div className="text-sm text-gray-500">불러오는 중…</div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
          <table
            className="w-full text-sm"
            data-testid="company-members-settings-list"
          >
            <thead className="bg-gray-50 text-left text-xs text-gray-500">
              <tr>
                <th className="px-4 py-2 font-medium">이름</th>
                <th className="px-4 py-2 font-medium">이메일</th>
                <th className="w-32 px-4 py-2 font-medium">역할</th>
                <th className="w-40 px-4 py-2 text-right font-medium">작업</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {data?.members.map((m) => {
                const isAdmin = m.role === "admin"
                return (
                  <tr
                    key={m.user_sub}
                    data-testid={`company-members-settings-row-${m.user_sub}`}
                    className="hover:bg-gray-50"
                  >
                    <td className="px-4 py-2 text-gray-900">
                      {m.name ?? m.user_sub}
                    </td>
                    <td className="px-4 py-2 text-gray-600">
                      {m.email ?? "-"}
                    </td>
                    <td className="px-4 py-2">
                      <span
                        className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs ${
                          isAdmin
                            ? "bg-blue-100 text-blue-800"
                            : "bg-gray-100 text-gray-700"
                        }`}
                      >
                        {isAdmin ? (
                          <ShieldCheck size={12} />
                        ) : (
                          <User size={12} />
                        )}
                        {isAdmin ? "관리자" : "멤버"}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-right">
                      <div className="flex justify-end gap-1.5">
                        {isAdmin ? (
                          <button
                            onClick={() => setRole(m, "member")}
                            disabled={busy === m.user_sub}
                            data-testid={`company-members-settings-row-${m.user_sub}-demote`}
                            className="rounded border border-gray-300 px-2 py-1 text-xs text-gray-700 hover:bg-gray-100 disabled:opacity-50"
                          >
                            강등
                          </button>
                        ) : (
                          <button
                            onClick={() => setRole(m, "admin")}
                            disabled={busy === m.user_sub}
                            data-testid={`company-members-settings-row-${m.user_sub}-promote`}
                            className="rounded bg-blue-600 px-2 py-1 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                          >
                            관리자 임명
                          </button>
                        )}
                        {m.user_sub !== authUser?.id && (
                          <button
                            onClick={() => void removeMember(m)}
                            disabled={busy === m.user_sub}
                            data-testid={`company-members-settings-row-${m.user_sub}-remove`}
                            className="rounded border border-rose-300 px-2 py-1 text-xs text-rose-700 hover:bg-rose-50 disabled:opacity-50"
                          >
                            제거
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
