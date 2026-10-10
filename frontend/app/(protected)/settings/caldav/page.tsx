"use client"

import { useState } from "react"
import Link from "next/link"
import { ArrowLeft, CalendarSync, Copy, Plus, Trash2 } from "lucide-react"
import { useToast } from "@/components/ui-custom/use-toast"

import { useAppContext } from "@/components/providers/app-context"
import { api } from "@/lib/api-client"
import { useConfirm } from "@/components/ui-custom/use-confirm"
import { friendlyError } from "@/lib/errors"
import { invalidateApi, useApiGet } from "@/lib/hooks/use-api"

interface CalDavTokenItem {
  id: string
  name: string
  workspace_id: string
  created_at: string
  last_used_at: string | null
}

interface CalDavTokenCreated {
  id: string
  name: string
  workspace_id: string
  username: string
  secret: string
  server_url: string
}

export default function CalDavTokensPage() {
  const { activeWorkspaceId } = useAppContext()
  const { toast } = useToast()
  const confirm = useConfirm()
  const URL_ = "/api/v1/me/caldav-tokens"
  const { data, mutate } = useApiGet<{ items: CalDavTokenItem[] }>(URL_)
  const [showCreate, setShowCreate] = useState(false)
  const [newName, setNewName] = useState("")
  const [created, setCreated] = useState<CalDavTokenCreated | null>(null)
  const [busy, setBusy] = useState(false)

  async function create() {
    if (!newName.trim()) return
    setBusy(true)
    try {
      const res = await api<CalDavTokenCreated>(URL_, {
        method: "POST",
        body: { name: newName.trim() },
      })
      setCreated(res)
      setNewName("")
      setShowCreate(false)
      invalidateApi(URL_)
      mutate()
    } catch (e) {
      toast.error(friendlyError(e))
    } finally {
      setBusy(false)
    }
  }

  async function revoke(token: CalDavTokenItem) {
    const ok = await confirm({
      title: "앱 비밀번호 폐기",
      description: `'${token.name}' 비밀번호를 폐기할까요? 이 비밀번호로 연결된 캘린더 앱은 즉시 일정을 받지 못합니다.`,
      confirmText: "폐기",
      variant: "destructive",
    })
    if (!ok) return
    try {
      await api(`${URL_}/${encodeURIComponent(token.id)}`, { method: "DELETE" })
      invalidateApi(URL_)
      mutate()
      toast.success("비밀번호를 폐기했습니다")
    } catch (e) {
      toast.error(friendlyError(e))
    }
  }

  async function copy(text: string) {
    await navigator.clipboard.writeText(text)
    toast.success("복사했습니다")
  }

  return (
    <div
      className="h-full space-y-4 overflow-y-auto px-4 py-6 sm:px-6 lg:px-8"
      data-testid="caldav-tokens-page"
    >
      <Link
        href="/settings"
        data-testid="caldav-tokens-back"
        className="inline-flex items-center gap-1 text-xs text-gray-600 hover:text-gray-900"
      >
        <ArrowLeft size={12} /> 설정으로
      </Link>

      <header className="flex items-center gap-2">
        <CalendarSync size={20} className="text-gray-600" />
        <h1 className="text-2xl font-bold text-gray-900">
          외부 캘린더 앱 연결
        </h1>
      </header>

      <div className="rounded border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
        <p className="font-medium">⚠ 사용 전 확인</p>
        <ul className="mt-1 list-disc space-y-0.5 pl-4">
          <li>비밀번호는 발급 시 한 번만 보입니다.</li>
          <li>현재 워크스페이스({activeWorkspaceId})의 일정만 연결됩니다.</li>
          <li>노출됐다면 바로 폐기하세요.</li>
        </ul>
      </div>

      <section className="rounded-lg border border-gray-200 bg-white p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-900">발급된 비밀번호</h2>
          <button
            onClick={() => setShowCreate(true)}
            data-testid="caldav-token-new-button"
            className="inline-flex items-center gap-1 rounded bg-gray-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-gray-800"
          >
            <Plus size={12} /> 새로 발급
          </button>
        </div>

        {!data || data.items.length === 0 ? (
          <p className="text-sm text-gray-500">
            아직 발급된 비밀번호가 없습니다.
          </p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {data.items.map((t) => (
              <li
                key={t.id}
                data-testid={`caldav-token-row-${t.id}`}
                className="flex items-center justify-between py-2.5"
              >
                <div>
                  <div className="text-sm font-medium text-gray-900">
                    {t.name}
                  </div>
                  <div className="text-xs text-gray-500">
                    만든 날: {new Date(t.created_at).toLocaleDateString("ko-KR")} ·
                    마지막 사용:{" "}
                    {t.last_used_at
                      ? new Date(t.last_used_at).toLocaleString("ko-KR")
                      : "-"}
                  </div>
                </div>
                <button
                  onClick={() => revoke(t)}
                  data-testid={`caldav-token-revoke-${t.id}`}
                  title="폐기"
                  className="rounded p-1 text-gray-400 hover:bg-rose-50 hover:text-rose-600"
                >
                  <Trash2 size={14} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* 새 비밀번호 발급 입력 모달 */}
      {showCreate && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setShowCreate(false)}
          data-testid="caldav-token-create-modal"
        >
          <div
            className="w-full max-w-sm rounded-lg bg-white p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="mb-3 text-sm font-semibold text-gray-900">
              새 비밀번호 발급
            </h3>
            <label className="mb-1 block text-xs font-medium text-gray-600">
              이름
            </label>
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="예: 아이폰 캘린더, 업무용 노트북 Thunderbird"
              data-testid="caldav-token-name-input"
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
              autoFocus
            />
            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => setShowCreate(false)}
                disabled={busy}
                className="rounded px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100"
              >
                취소
              </button>
              <button
                onClick={create}
                disabled={busy || !newName.trim()}
                data-testid="caldav-token-create-confirm"
                className="rounded bg-gray-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
              >
                만들기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 발급된 secret 노출 모달: 한 번만 */}
      {created && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          data-testid="caldav-token-secret-modal"
        >
          <div className="w-full max-w-lg rounded-lg bg-white p-5 shadow-xl">
            <h3 className="mb-2 text-sm font-semibold text-gray-900">
              비밀번호가 만들어졌습니다
            </h3>
            <p className="mb-4 text-xs text-rose-700">
              ⚠ 이 비밀번호는 이 화면에서만 보입니다.
            </p>
            <div className="space-y-3">
              <Field
                label="서버 URL"
                value={created.server_url}
                onCopy={() => copy(created.server_url)}
                testid="caldav-token-show-url"
              />
              <Field
                label="사용자명"
                value={created.username}
                onCopy={() => copy(created.username)}
                testid="caldav-token-show-username"
              />
              <Field
                label="비밀번호"
                value={created.secret}
                onCopy={() => copy(created.secret)}
                mono
                testid="caldav-token-show-secret"
              />
            </div>
            <div className="mt-5 flex justify-end">
              <button
                onClick={() => setCreated(null)}
                data-testid="caldav-token-show-close"
                className="rounded bg-gray-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-gray-800"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function Field({
  label,
  value,
  onCopy,
  mono,
  testid,
}: {
  label: string
  value: string
  onCopy: () => void
  mono?: boolean
  testid: string
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-gray-600">
        {label}
      </label>
      <div className="flex gap-2">
        <input
          type="text"
          value={value}
          readOnly
          data-testid={testid}
          onClick={(e) => (e.target as HTMLInputElement).select()}
          className={`w-full rounded border border-gray-300 bg-gray-50 px-3 py-2 text-xs ${
            mono ? "font-mono" : ""
          }`}
        />
        <button
          onClick={onCopy}
          data-testid={`${testid}-copy`}
          aria-label="복사"
          className="shrink-0 rounded border border-gray-300 px-3 py-2 text-gray-600 hover:bg-gray-50"
        >
          <Copy size={14} />
        </button>
      </div>
    </div>
  )
}
