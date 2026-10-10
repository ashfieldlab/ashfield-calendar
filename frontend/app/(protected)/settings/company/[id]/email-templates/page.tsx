"use client"

import { use, useEffect, useState } from "react"
import Link from "next/link"
import { ArrowLeft, Eye, RotateCcw } from "lucide-react"
import { useToast } from "@/components/ui-custom/use-toast"

import { useAppContext } from "@/components/providers/app-context"
import { api } from "@/lib/api-client"
import { useConfirm } from "@/components/ui-custom/use-confirm"
import { invalidateApi, useApiGet } from "@/lib/hooks/use-api"
import { friendlyError } from "@/lib/errors"

interface EmailTemplateItem {
  event_type: string
  label: string
  overridden: boolean
  variables: string[]
}

interface EmailTemplateDetail extends EmailTemplateItem {
  subject: string
  body: string
  is_html: boolean
  text_fallback: string | null
  default_subject: string
  default_body: string
  default_is_html: boolean
}

interface PreviewResponse {
  subject: string
  body: string
  is_html: boolean
  text_fallback: string | null
}

export default function EmailTemplatesPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id: companyIdRaw } = use(params)
  const companyId = decodeURIComponent(companyIdRaw)
  const { isCompanyAdmin } = useAppContext()
  const { toast } = useToast()
  const confirm = useConfirm()

  const LIST_URL = `/api/v1/companies/${encodeURIComponent(companyId)}/email-templates`
  const { data: list, error, isLoading } = useApiGet<{
    items: EmailTemplateItem[]
  }>(isCompanyAdmin ? LIST_URL : null)

  const [selected, setSelected] = useState<string | null>(null)
  useEffect(() => {
    if (list && !selected) setSelected(list.items[0]?.event_type ?? null)
  }, [list, selected])

  const DETAIL_URL = selected
    ? `${LIST_URL}/${encodeURIComponent(selected)}`
    : null
  const { data: detail, mutate: mutateDetail } =
    useApiGet<EmailTemplateDetail>(DETAIL_URL)

  const [subject, setSubject] = useState("")
  const [body, setBody] = useState("")
  const [isHtml, setIsHtml] = useState(false)
  const [textFallback, setTextFallback] = useState("")
  const [busy, setBusy] = useState(false)
  const [preview, setPreview] = useState<PreviewResponse | null>(null)

  useEffect(() => {
    if (!detail) return
    setSubject(detail.subject)
    setBody(detail.body)
    setIsHtml(detail.is_html)
    setTextFallback(detail.text_fallback ?? "")
    setPreview(null)
  }, [detail])

  if (!isCompanyAdmin) {
    return (
      <div
        className="rounded-lg border border-amber-200 bg-amber-50 p-6 text-sm text-amber-800"
        data-testid="email-templates-no-permission"
      >
        회사 관리자만 접근할 수 있습니다.
      </div>
    )
  }

  if (isLoading || !list)
    return <div className="p-6 text-sm text-gray-500">불러오는 중…</div>
  if (error)
    return (
      <div className="m-6 rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
        불러오지 못했습니다. 잠시 후 다시 시도해주세요.
      </div>
    )

  async function save() {
    if (!selected) return
    setBusy(true)
    try {
      await api(`${LIST_URL}/${encodeURIComponent(selected)}`, {
        method: "PUT",
        body: {
          subject,
          body,
          is_html: isHtml,
          text_fallback: isHtml && textFallback ? textFallback : null,
        },
      })
      toast.success("저장했습니다")
      invalidateApi(LIST_URL)
      mutateDetail()
    } catch (e) {
      toast.error(friendlyError(e))
    } finally {
      setBusy(false)
    }
  }

  async function resetToDefault() {
    if (!selected || !detail?.overridden) return
    if (!(await confirm({ title: "기본값으로 되돌리기", description: "이 템플릿을 시스템 기본값으로 되돌릴까요?", confirmText: "되돌리기" }))) return
    setBusy(true)
    try {
      await api(`${LIST_URL}/${encodeURIComponent(selected)}`, {
        method: "DELETE",
      })
      toast.success("기본값으로 되돌렸습니다")
      invalidateApi(LIST_URL)
      mutateDetail()
    } catch (e) {
      toast.error(friendlyError(e))
    } finally {
      setBusy(false)
    }
  }

  async function runPreview() {
    if (!selected) return
    setBusy(true)
    try {
      const res = await api<PreviewResponse>(
        `${LIST_URL}/${encodeURIComponent(selected)}/preview`,
        {
          method: "POST",
          body: {
            subject,
            body,
            is_html: isHtml,
            text_fallback: isHtml && textFallback ? textFallback : null,
          },
        },
      )
      setPreview(res)
    } catch (e) {
      toast.error(friendlyError(e))
    } finally {
      setBusy(false)
    }
  }

  function insertVar(name: string) {
    // HTML 모드에서 URL 변수는 의도가 분명함: img/anchor 태그로 자동 감쌈.
    // plain text 모드거나 HTML 이어도 일반 변수는 그냥 placeholder.
    let snippet = `{${name}}`
    if (isHtml) {
      if (name === "organization_logo_url") {
        snippet = `<img src="{organization_logo_url}" alt="{organization_name}" style="height:40px; display:block;"/>`
      } else if (name === "cancel_url" || name === "book_url") {
        const label = name === "cancel_url" ? "예약 관리" : "다시 예약하기"
        snippet = `<a href="{${name}}">${label}</a>`
      }
    }
    setBody((cur) => cur + snippet)
  }

  return (
    <div
      className="h-full space-y-4 overflow-y-auto px-4 py-6 sm:px-6 lg:px-8"
      data-testid="email-templates-page"
    >
      <div className="flex items-center gap-2 text-sm text-gray-600">
        <Link
          href={`/settings/company/${companyId}/smtp`}
          data-testid="email-templates-back-link"
          className="inline-flex items-center gap-1 rounded p-1 hover:bg-gray-100"
        >
          <ArrowLeft size={14} /> 회사 설정
        </Link>
        <span className="text-gray-300">/</span>
        <h1 className="text-2xl font-bold text-gray-900">이메일 템플릿</h1>
      </div>

      <p className="text-xs text-gray-500">
        예약 기능이 외부 고객에게 보내는 이메일의 제목·본문을 회사별로 커스텀.
        저장하지 않으면 시스템 기본 템플릿이 사용됩니다.
      </p>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[260px_1fr]">
        {/* 좌측: 이벤트 종류 리스트 */}
        <nav
          className="space-y-1 rounded-lg border border-gray-200 bg-white p-2"
          data-testid="email-templates-list"
        >
          {list.items.map((item) => {
            const active = item.event_type === selected
            return (
              <button
                key={item.event_type}
                onClick={() => setSelected(item.event_type)}
                data-testid={`email-templates-row-${item.event_type}`}
                className={`flex w-full items-center justify-between rounded px-3 py-2 text-left text-sm ${
                  active
                    ? "bg-gray-900 text-white"
                    : "text-gray-700 hover:bg-gray-50"
                }`}
              >
                <span>{item.label}</span>
                {item.overridden ? (
                  <span
                    className={`rounded px-1.5 py-0.5 text-[10px] ${
                      active
                        ? "bg-white/20 text-white"
                        : "bg-blue-50 text-blue-700"
                    }`}
                  >
                    커스텀
                  </span>
                ) : (
                  <span
                    className={`rounded px-1.5 py-0.5 text-[10px] ${
                      active
                        ? "bg-white/20 text-white"
                        : "bg-gray-100 text-gray-500"
                    }`}
                  >
                    기본
                  </span>
                )}
              </button>
            )
          })}
        </nav>

        {/* 우측: 편집기 */}
        {detail && (
          <div className="space-y-3 rounded-lg border border-gray-200 bg-white p-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-900">
                {detail.label}
              </h2>
              {detail.overridden && (
                <button
                  onClick={resetToDefault}
                  disabled={busy}
                  data-testid="email-templates-reset-button"
                  className="inline-flex items-center gap-1 rounded border border-gray-200 px-2 py-1 text-xs text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                >
                  <RotateCcw size={12} /> 기본값으로
                </button>
              )}
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">
                제목
              </label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                data-testid="email-templates-subject-input"
                className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
              />
            </div>

            <div>
              <div className="mb-1 flex items-center justify-between">
                <label className="block text-xs font-medium text-gray-600">
                  본문 {isHtml ? "(HTML)" : "(텍스트)"}
                </label>
                <label className="flex items-center gap-1 text-xs text-gray-600">
                  <input
                    type="checkbox"
                    checked={isHtml}
                    onChange={(e) => setIsHtml(e.target.checked)}
                    data-testid="email-templates-html-toggle"
                  />
                  HTML 사용
                </label>
              </div>
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={10}
                data-testid="email-templates-body-input"
                className="w-full rounded border border-gray-300 px-3 py-2 font-mono text-sm"
                placeholder={
                  isHtml
                    ? "<p>안녕하세요 {customer_name}님...</p>"
                    : "안녕하세요 {customer_name}님..."
                }
              />
            </div>

            {isHtml && (
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">
                  대체 본문 (텍스트){" "}
                  <span className="text-gray-400">
                    비우면 HTML 태그 자동 strip
                  </span>
                </label>
                <textarea
                  value={textFallback}
                  onChange={(e) => setTextFallback(e.target.value)}
                  rows={4}
                  data-testid="email-templates-text-fallback-input"
                  className="w-full rounded border border-gray-300 px-3 py-2 font-mono text-sm"
                  placeholder="HTML 미지원 메일 클라이언트용 대체 본문"
                />
              </div>
            )}

            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">
                사용 가능한 변수 (클릭해서 본문에 삽입)
              </label>
              <div className="flex flex-wrap gap-1">
                {detail.variables.map((v) => (
                  <button
                    key={v}
                    onClick={() => insertVar(v)}
                    data-testid={`email-templates-var-${v}`}
                    className="rounded border border-gray-200 bg-gray-50 px-2 py-0.5 font-mono text-xs text-gray-700 hover:bg-gray-100"
                  >
                    {`{${v}}`}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-2 border-t border-gray-100 pt-3">
              <button
                onClick={runPreview}
                disabled={busy}
                data-testid="email-templates-preview-button"
                className="inline-flex items-center gap-1 rounded border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                <Eye size={14} /> 미리보기
              </button>
              <button
                onClick={save}
                disabled={busy}
                data-testid="email-templates-save-button"
                className="rounded bg-gray-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
              >
                저장
              </button>
            </div>

            {preview && (
              <div
                className="rounded border border-blue-100 bg-blue-50/40 p-3 text-sm"
                data-testid="email-templates-preview"
              >
                <div className="mb-1 text-xs font-medium text-gray-500">
                  미리보기 (샘플 변수로 렌더링)
                </div>
                <div className="mb-2 font-semibold text-gray-900">
                  {preview.subject}
                </div>
                {preview.is_html ? (
                  <iframe
                    srcDoc={preview.body}
                    sandbox=""
                    data-testid="email-templates-preview-iframe"
                    className="h-72 w-full rounded border border-gray-200 bg-white"
                    title="이메일 미리보기"
                  />
                ) : (
                  <pre className="whitespace-pre-wrap font-sans text-sm text-gray-800">
                    {preview.body}
                  </pre>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
