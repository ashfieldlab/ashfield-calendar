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
  const { id: workspaceIdRaw } = use(params)
  const workspaceId = decodeURIComponent(workspaceIdRaw)
  const { isWorkspaceAdmin } = useAppContext()
  const { toast } = useToast()
  const confirm = useConfirm()

  const LIST_URL = `/api/v1/workspaces/${encodeURIComponent(workspaceId)}/email-templates`
  const { data: list, error, isLoading } = useApiGet<{
    items: EmailTemplateItem[]
  }>(isWorkspaceAdmin ? LIST_URL : null)

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

  if (!isWorkspaceAdmin) {
    return (
      <div
        className="rounded-lg border border-amber-200 dark:border-amber-900/60 bg-amber-50 dark:bg-amber-950/40 p-6 text-sm text-amber-800 dark:text-amber-200"
        data-testid="email-templates-no-permission"
      >
        워크스페이스 관리자만 접근할 수 있습니다.
      </div>
    )
  }

  if (isLoading || !list)
    return <div className="p-6 text-sm text-muted-foreground">불러오는 중…</div>
  if (error)
    return (
      <div className="m-6 rounded-lg border border-rose-200 dark:border-rose-900/60 bg-rose-50 dark:bg-rose-950/40 p-4 text-sm text-rose-700 dark:text-rose-300">
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
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link
          href={`/settings/workspace/${workspaceId}/smtp`}
          data-testid="email-templates-back-link"
          className="inline-flex items-center gap-1 rounded p-1 hover:bg-muted"
        >
          <ArrowLeft size={14} /> 워크스페이스 설정
        </Link>
        <span className="text-muted-foreground/50">/</span>
        <h1 className="text-2xl font-bold text-foreground">이메일 템플릿</h1>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[260px_1fr]">
        {/* 좌측: 이벤트 종류 리스트 */}
        <nav
          className="space-y-1 rounded-lg border border-border bg-card p-2"
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
                    ? "bg-primary text-primary-foreground"
                    : "text-foreground/80 hover:bg-muted/50"
                }`}
              >
                <span>{item.label}</span>
                {item.overridden ? (
                  <span
                    className={`rounded px-1.5 py-0.5 text-[10px] ${
                      active
                        ? "bg-primary-foreground/20 text-primary-foreground"
                        : "bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300"
                    }`}
                  >
                    커스텀
                  </span>
                ) : (
                  <span
                    className={`rounded px-1.5 py-0.5 text-[10px] ${
                      active
                        ? "bg-primary-foreground/20 text-primary-foreground"
                        : "bg-muted text-muted-foreground"
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
          <div className="space-y-3 rounded-lg border border-border bg-card p-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-foreground">
                {detail.label}
              </h2>
              {detail.overridden && (
                <button
                  onClick={resetToDefault}
                  disabled={busy}
                  data-testid="email-templates-reset-button"
                  className="inline-flex items-center gap-1 rounded border border-border px-2 py-1 text-xs text-muted-foreground hover:bg-muted/50 disabled:opacity-50"
                >
                  <RotateCcw size={12} /> 기본값으로
                </button>
              )}
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">
                제목
              </label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                data-testid="email-templates-subject-input"
                className="w-full rounded border border-input px-3 py-2 text-sm"
              />
            </div>

            <div>
              <div className="mb-1 flex items-center justify-between">
                <label className="block text-xs font-medium text-muted-foreground">
                  본문 {isHtml ? "(HTML)" : "(텍스트)"}
                </label>
                <label className="flex items-center gap-1 text-xs text-muted-foreground">
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
                className="w-full rounded border border-input px-3 py-2 font-mono text-sm"
                placeholder={
                  isHtml
                    ? "<p>안녕하세요 {customer_name}님...</p>"
                    : "안녕하세요 {customer_name}님..."
                }
              />
            </div>

            {isHtml && (
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">
                  대체 본문 (텍스트){" "}
                  <span className="text-muted-foreground/70">
                    비우면 HTML 태그 자동 strip
                  </span>
                </label>
                <textarea
                  value={textFallback}
                  onChange={(e) => setTextFallback(e.target.value)}
                  rows={4}
                  data-testid="email-templates-text-fallback-input"
                  className="w-full rounded border border-input px-3 py-2 font-mono text-sm"
                  placeholder="HTML 미지원 메일 클라이언트용 대체 본문"
                />
              </div>
            )}

            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">
                사용 가능한 변수
              </label>
              <div className="flex flex-wrap gap-1">
                {detail.variables.map((v) => (
                  <button
                    key={v}
                    onClick={() => insertVar(v)}
                    data-testid={`email-templates-var-${v}`}
                    className="rounded border border-border bg-muted/50 px-2 py-0.5 font-mono text-xs text-foreground/80 hover:bg-muted"
                  >
                    {`{${v}}`}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-2 border-t border-border/60 pt-3">
              <button
                onClick={runPreview}
                disabled={busy}
                data-testid="email-templates-preview-button"
                className="inline-flex items-center gap-1 rounded border border-input px-3 py-1.5 text-sm text-foreground/80 hover:bg-muted/50 disabled:opacity-50"
              >
                <Eye size={14} /> 미리보기
              </button>
              <button
                onClick={save}
                disabled={busy}
                data-testid="email-templates-save-button"
                className="rounded bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                저장
              </button>
            </div>

            {preview && (
              <div
                className="rounded border border-blue-100 dark:border-blue-900/40 bg-blue-50/40 dark:bg-blue-950/30 p-3 text-sm"
                data-testid="email-templates-preview"
              >
                <div className="mb-1 text-xs font-medium text-muted-foreground">
                  미리보기
                </div>
                <div className="mb-2 font-semibold text-foreground">
                  {preview.subject}
                </div>
                {preview.is_html ? (
                  <iframe
                    srcDoc={preview.body}
                    sandbox=""
                    data-testid="email-templates-preview-iframe"
                    className="h-72 w-full rounded border border-border bg-card"
                    title="이메일 미리보기"
                  />
                ) : (
                  <pre className="whitespace-pre-wrap font-sans text-sm text-foreground">
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
