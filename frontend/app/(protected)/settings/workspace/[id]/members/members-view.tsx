"use client"

import { ExternalLink, ShieldCheck, User } from "lucide-react"

import { useAppContext } from "@/components/providers/app-context"
import { useApiGet } from "@/lib/hooks/use-api"

type WorkspaceRole = "admin" | "member"

interface MemberItem {
  user_sub: string
  email: string | null
  name: string | null
  role: WorkspaceRole
}

interface MemberListResponse {
  /** 계정 서버 워크스페이스 ID. null = 계정 서버 도입 전의 로컬 워크스페이스. */
  account_workspace_id: string | null
  members: MemberItem[]
}

/**
 * 워크스페이스 멤버 조회 (읽기 전용). 추가, 제거, 역할 변경은 Ashfield 계정 서버에서 하고,
 * 바뀐 소속은 다음 토큰 갱신(최대 15분) 또는 재로그인 때 이 앱에 반영된다.
 */
export default function WorkspaceMembersView({
  workspaceId,
  accountURL,
}: {
  workspaceId: string
  accountURL: string
}) {
  const { isWorkspaceAdmin, workspaceNames } = useAppContext()

  const url = isWorkspaceAdmin
    ? `/api/v1/workspaces/${encodeURIComponent(workspaceId)}/members`
    : null
  const { data, error, isLoading } = useApiGet<MemberListResponse>(url)

  if (!isWorkspaceAdmin) {
    return (
      <div
        className="rounded-lg border border-amber-200 dark:border-amber-900/60 bg-amber-50 dark:bg-amber-950/40 p-6 text-sm text-amber-800 dark:text-amber-200"
        data-testid="workspace-members-settings-no-permission"
      >
        워크스페이스 관리자만 접근할 수 있습니다.
      </div>
    )
  }

  const accountWorkspaceId = data?.account_workspace_id ?? null
  const manageUrl = accountWorkspaceId
    ? `${accountURL}/workspaces/${encodeURIComponent(accountWorkspaceId)}`
    : null

  return (
    <div
      className="h-full overflow-y-auto space-y-4 px-4 py-8 sm:px-6 lg:px-8"
      data-testid="workspace-members-settings-page"
    >
      <header className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-2xl font-bold text-foreground">
          {workspaceNames[workspaceId] ?? workspaceId} 멤버
        </h1>
        {manageUrl && (
          <a
            href={manageUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            data-testid="workspace-members-manage-link"
          >
            Ashfield 계정에서 관리
            <ExternalLink size={14} aria-hidden />
          </a>
        )}
      </header>

      {data && !manageUrl && (
        <div
          className="rounded-lg border border-border bg-muted/50 px-4 py-3 text-sm text-muted-foreground"
          data-testid="workspace-members-settings-account-notice"
        >
          이 워크스페이스는 멤버를 변경할 수 없습니다.
        </div>
      )}

      {error ? (
        <div className="rounded-lg border border-rose-200 dark:border-rose-900/60 bg-rose-50 dark:bg-rose-950/40 p-4 text-sm text-rose-700 dark:text-rose-300">
          불러오지 못했습니다. 잠시 후 다시 시도해주세요.
        </div>
      ) : isLoading ? (
        <div className="text-sm text-muted-foreground">불러오는 중…</div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border bg-card">
          <table
            className="w-full text-sm"
            data-testid="workspace-members-settings-list"
          >
            <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-4 py-2 font-medium">이름</th>
                <th className="px-4 py-2 font-medium">이메일</th>
                <th className="w-32 px-4 py-2 font-medium">역할</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {data?.members.map((m) => {
                const isAdmin = m.role === "admin"
                return (
                  <tr
                    key={m.user_sub}
                    data-testid={`workspace-members-settings-row-${m.user_sub}`}
                    className="hover:bg-muted/50"
                  >
                    <td className="px-4 py-2 text-foreground">
                      {m.name ?? m.user_sub}
                    </td>
                    <td className="px-4 py-2 text-muted-foreground">
                      {m.email ?? "-"}
                    </td>
                    <td className="px-4 py-2">
                      <span
                        className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs ${
                          isAdmin
                            ? "bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-300"
                            : "bg-muted text-foreground/80"
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
