"use client"

import { use, useEffect, useState } from "react"
import Link from "next/link"
import { ArrowLeft, Building2 } from "lucide-react"
import { useToast } from "@/components/ui-custom/use-toast"

import { useAppContext } from "@/components/providers/app-context"
import { api } from "@/lib/api-client"
import { friendlyError } from "@/lib/errors"
import { invalidateApi, useApiGet } from "@/lib/hooks/use-api"

interface CompanyProfileResponse {
  company_id: string
  name: string
  logo_url: string | null
}

export default function CompanyProfilePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id: companyIdRaw } = use(params)
  const companyId = decodeURIComponent(companyIdRaw)
  const { isCompanyAdmin } = useAppContext()
  const { toast } = useToast()

  const URL_ = `/api/v1/companies/${encodeURIComponent(companyId)}/profile`
  const { data, error, isLoading } = useApiGet<CompanyProfileResponse>(
    isCompanyAdmin ? URL_ : null,
  )

  const [logoUrl, setLogoUrl] = useState("")
  const [busy, setBusy] = useState(false)
  const [imgError, setImgError] = useState(false)

  useEffect(() => {
    if (!data) return
    setLogoUrl(data.logo_url ?? "")
    setImgError(false)
  }, [data])

  if (!isCompanyAdmin) {
    return (
      <div
        className="rounded-lg border border-amber-200 bg-amber-50 p-6 text-sm text-amber-800"
        data-testid="company-profile-no-permission"
      >
        회사 관리자만 접근할 수 있습니다.
      </div>
    )
  }

  if (isLoading || !data)
    return <div className="p-6 text-sm text-gray-500">불러오는 중…</div>
  if (error)
    return (
      <div className="m-6 rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
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
      data-testid="company-profile-page"
    >
      <Link
        href="/settings"
        data-testid="company-profile-back"
        className="inline-flex items-center gap-1 text-xs text-gray-600 hover:text-gray-900"
      >
        <ArrowLeft size={12} /> 설정으로
      </Link>

      <header className="flex items-center gap-2">
        <Building2 size={20} className="text-gray-600" />
        <h1 className="text-2xl font-bold text-gray-900">
          {data.name} 회사 정보
        </h1>
      </header>

      <p className="text-xs text-gray-500">
        외부 고객에게 보내는 예약 이메일 등에 표시되는 회사 로고입니다. 회사
        홈페이지·CDN 의 공개 이미지 URL 을 등록하세요. 이메일 템플릿에서{" "}
        <code className="rounded bg-gray-100 px-1 font-mono text-gray-700">
          {"{organization_logo_url}"}
        </code>{" "}
        변수로 사용 가능합니다.
      </p>

      <section className="space-y-3 rounded-lg border border-gray-200 bg-white p-5">
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">
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
            data-testid="company-profile-logo-input"
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
          />
        </div>

        <div>
          <div className="mb-1 text-xs font-medium text-gray-600">미리보기</div>
          <div
            className="flex h-24 items-center justify-center rounded border border-dashed border-gray-300 bg-gray-50 p-3"
            data-testid="company-profile-preview"
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
              <span className="text-xs text-gray-400">
                {imgError
                  ? "이미지를 불러올 수 없습니다. URL을 확인하세요."
                  : "URL 을 입력하면 여기에 표시됩니다."}
              </span>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-gray-100 pt-3">
          <button
            onClick={clear}
            disabled={busy || !logoUrl}
            data-testid="company-profile-clear-button"
            className="rounded px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 disabled:opacity-50"
          >
            지우기
          </button>
          <button
            onClick={save}
            disabled={busy}
            data-testid="company-profile-save-button"
            className="rounded bg-gray-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
          >
            저장
          </button>
        </div>
      </section>
    </div>
  )
}
