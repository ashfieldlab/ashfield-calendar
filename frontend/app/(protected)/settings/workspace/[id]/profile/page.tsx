"use client"

import { use, useEffect, useState } from "react"
import Link from "next/link"
import { ArrowLeft, Building2 } from "lucide-react"
import { useToast } from "@/components/ui-custom/use-toast"

import { useAppContext } from "@/components/providers/app-context"
import { api } from "@/lib/api-client"
import { friendlyError } from "@/lib/errors"
import { invalidateApi, useApiGet } from "@/lib/hooks/use-api"

interface WorkspaceProfileResponse {
  workspace_id: string
  name: string
  logo_url: string | null
}

export default function WorkspaceProfilePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id: workspaceIdRaw } = use(params)
  const workspaceId = decodeURIComponent(workspaceIdRaw)
  const { isWorkspaceAdmin } = useAppContext()
  const { toast } = useToast()

  const URL_ = `/api/v1/workspaces/${encodeURIComponent(workspaceId)}/profile`
  const { data, error, isLoading } = useApiGet<WorkspaceProfileResponse>(
    isWorkspaceAdmin ? URL_ : null,
  )

  const [logoUrl, setLogoUrl] = useState("")
  const [busy, setBusy] = useState(false)
  const [imgError, setImgError] = useState(false)

  useEffect(() => {
    if (!data) return
    setLogoUrl(data.logo_url ?? "")
    setImgError(false)
  }, [data])

  if (!isWorkspaceAdmin) {
    return (
      <div
        className="rounded-lg border border-amber-200 dark:border-amber-900/60 bg-amber-50 dark:bg-amber-950/40 p-6 text-sm text-amber-800 dark:text-amber-200"
        data-testid="workspace-profile-no-permission"
      >
        워크스페이스 관리자만 접근할 수 있습니다.
      </div>
    )
  }

  if (isLoading || !data)
    return <div className="p-6 text-sm text-muted-foreground">불러오는 중…</div>
  if (error)
    return (
      <div className="m-6 rounded-lg border border-rose-200 dark:border-rose-900/60 bg-rose-50 dark:bg-rose-950/40 p-4 text-sm text-rose-700 dark:text-rose-300">
        불러오지 못했습니다. 잠시 후 다시 시도해주세요.
      </div>
    )

  async function save() {
    setBusy(true)
    try {
      await api(URL_, {
        method: "PUT",
        body: { logo_url: logoUrl.trim() || null },
      })
      toast.success("저장했습니다")
      invalidateApi(URL_)
    } catch (e) {
      toast.error(friendlyError(e))
    } finally {
      setBusy(false)
    }
  }

  function clear() {
    setLogoUrl("")
    setImgError(false)
  }

  const trimmed = logoUrl.trim()
  const showPreview = trimmed.startsWith("http://") || trimmed.startsWith("https://")

  return (
    <div
      className="h-full space-y-4 overflow-y-auto px-4 py-6 sm:px-6 lg:px-8"
      data-testid="workspace-profile-page"
    >
      <Link
        href="/settings"
        data-testid="workspace-profile-back"
        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft size={12} /> 설정으로
      </Link>

      <header className="flex items-center gap-2">
        <Building2 size={20} className="text-muted-foreground" />
        <h1 className="text-2xl font-bold text-foreground">
          {data.name} 워크스페이스 정보
        </h1>
      </header>

      <p className="text-xs text-muted-foreground">
        템플릿 변수{" "}
        <code className="rounded bg-muted px-1 font-mono text-foreground/80">
          {"{organization_logo_url}"}
        </code>
      </p>

      <section className="space-y-3 rounded-lg border border-border bg-card p-5">
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">
            로고 이미지 URL
          </label>
          <input
            type="url"
            value={logoUrl}
            onChange={(e) => {
              setLogoUrl(e.target.value)
              setImgError(false)
            }}
            placeholder="https://example.com/logo.png"
            data-testid="workspace-profile-logo-input"
            className="w-full rounded border border-input px-3 py-2 text-sm"
          />
        </div>

        <div>
          <div className="mb-1 text-xs font-medium text-muted-foreground">미리보기</div>
          <div
            className="flex h-24 items-center justify-center rounded border border-dashed border-input bg-muted/50 p-3"
            data-testid="workspace-profile-preview"
          >
            {showPreview && !imgError ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={trimmed}
                alt="로고 미리보기"
                onError={() => setImgError(true)}
                className="max-h-full max-w-full object-contain"
              />
            ) : (
              <span className="text-xs text-muted-foreground/70">
                {imgError
                  ? "이미지를 불러올 수 없습니다. URL을 확인하세요."
                  : "미리보기"}
              </span>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-border/60 pt-3">
          <button
            onClick={clear}
            disabled={busy || !logoUrl}
            data-testid="workspace-profile-clear-button"
            className="rounded px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted disabled:opacity-50"
          >
            지우기
          </button>
          <button
            onClick={save}
            disabled={busy}
            data-testid="workspace-profile-save-button"
            className="rounded bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            저장
          </button>
        </div>
      </section>
    </div>
  )
}
