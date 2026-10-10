"use client"

import Link from "next/link"
import { ArrowLeft, ExternalLink, ShieldCheck, User } from "lucide-react"

import { useAppContext } from "@/components/providers/app-context"
import { useApiGet } from "@/lib/hooks/use-api"

type CompanyRole = "admin" | "member"

interface MemberItem {
  user_sub: string
  email: string | null
  name: string | null
  role: CompanyRole
}

interface MemberListResponse {
  /** 계정 서버 워크스페이스 ID. null = 계정 서버 도입 전의 로컬 회사. */
  account_workspace_id: string | null
  members: MemberItem[]
}

/**
 * 워크스페이스 멤버 조회 (읽기 전용). 추가·제거·역할 변경은 Ashfield 계정 서버에서 하고,
 * 바뀐 소속은 다음 토큰 갱신(최대 15분) 또는 재로그인 때 이 앱에 반영된다.
 */
export default function CompanyMembersView({
  companyId,
  accountURL,
}: {
  companyId: string
  accountURL: string
}) {
  const { isCompanyAdmin, companyNames } = useAppContext()

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
        워크스페이스 관리자만 접근할 수 있습니다.
      </div>
    )
  }

  const workspaceId = data?.account_workspace_id ?? null
  const manageUrl = workspaceId
    ? `${accountURL}/workspaces/${encodeURIComponent(workspaceId)}`
    : null

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
      <header className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-2xl font-bold text-gray-900">
          {companyNames[companyId] ?? companyId} 멤버
        </h1>
        {manageUrl && (
          <a
            href={manageUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-gray-900 px-3 text-sm font-medium text-white hover:bg-gray-800"
            data-testid="company-members-manage-link"
          >
            Ashfield 계정에서 관리
            <ExternalLink size={14} aria-hidden />
          </a>
        )}
      </header>

      {data && !manageUrl && (
        <div
          className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-600"
          data-testid="company-members-settings-account-notice"
        >
          이 워크스페이스는 멤버를 변경할 수 없습니다.
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
