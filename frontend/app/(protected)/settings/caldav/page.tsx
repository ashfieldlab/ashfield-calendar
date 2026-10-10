"use client"

import { useState } from "react"
import { KeyRound, Plus, Trash2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { useToast } from "@/components/ui-custom/use-toast"
import { useConfirm } from "@/components/ui-custom/use-confirm"
import { useAppContext } from "@/components/providers/app-context"
import { CopyField, SettingsSection } from "@/components/settings/settings-parts"
import { api } from "@/lib/api-client"
import { friendlyError } from "@/lib/errors"
import { useApiGet } from "@/lib/hooks/use-api"

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

const URL_ = "/api/v1/me/caldav-tokens"

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("ko-KR", { year: "numeric", month: "short", day: "numeric" })
}

function lastUsedLabel(iso: string | null, now: number) {
  if (!iso) return "사용 기록 없음"
  const s = Math.round((now - new Date(iso).getTime()) / 1000)
  if (s < 3600) return "방금 사용"
  if (s < 86400) return `${Math.floor(s / 3600)}시간 전 사용`
  return `${Math.floor(s / 86400)}일 전 사용`
}

/** 설정 > 외부 캘린더 앱: CalDAV 앱 비밀번호 발급과 폐기 */
export default function CalDavTokensPage() {
  const { activeWorkspaceId, workspaceNames } = useAppContext()
  const { toast } = useToast()
  const confirm = useConfirm()
  const { data, mutate } = useApiGet<{ items: CalDavTokenItem[] }>(URL_)
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState("")
  const [created, setCreated] = useState<CalDavTokenCreated | null>(null)
  const [busy, setBusy] = useState(false)
  const [now] = useState(() => Date.now())

  async function create() {
    if (!name.trim()) return
    setBusy(true)
    try {
      const res = await api<CalDavTokenCreated>(URL_, { method: "POST", body: { name: name.trim() } })
      setCreated(res)
      setName("")
      setAdding(false)
      void mutate()
    } catch (e) {
      toast.error(friendlyError(e))
    } finally {
      setBusy(false)
    }
  }

  async function revoke(t: CalDavTokenItem) {
    const ok = await confirm({
      title: "앱 비밀번호 폐기",
      description: `'${t.name}' 연결이 즉시 끊깁니다.`,
      confirmText: "폐기",
      variant: "destructive",
    })
    if (!ok) return
    try {
      await api(`${URL_}/${encodeURIComponent(t.id)}`, { method: "DELETE" })
      void mutate()
      toast.success("비밀번호를 폐기했습니다")
    } catch (e) {
      toast.error(friendlyError(e))
    }
  }

  const items = data?.items ?? []
  const wsName = activeWorkspaceId ? (workspaceNames[activeWorkspaceId] ?? activeWorkspaceId) : ""

  return (
    <SettingsSection
      title="외부 캘린더 앱"
      testid="caldav-tokens-page"
      action={
        !adding &&
        !created && (
          <Button size="sm" onClick={() => setAdding(true)} data-testid="caldav-token-new-button">
            <Plus /> 앱 비밀번호
          </Button>
        )
      }
    >
      {wsName && <p className="mt-1 text-sm text-muted-foreground">{wsName} 일정만 연결</p>}

      {adding && (
        <form
          className="mt-6 flex gap-2 rounded-xl border bg-muted/30 p-3"
          data-testid="caldav-token-create-form"
          onSubmit={(e) => {
            e.preventDefault()
            void create()
          }}
        >
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Escape" && setAdding(false)}
            placeholder="기기 이름"
            aria-label="기기 이름"
            data-testid="caldav-token-name-input"
            className="h-8 min-w-0 flex-1 rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus:border-ring focus:ring-3 focus:ring-ring/20"
          />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setAdding(false)}
            data-testid="caldav-token-create-cancel"
          >
            취소
          </Button>
          <Button type="submit" size="sm" disabled={busy || !name.trim()} data-testid="caldav-token-create-confirm">
            발급
          </Button>
        </form>
      )}

      {created && (
        <div
          className="mt-6 overflow-hidden rounded-xl border border-emerald-300 dark:border-emerald-800"
          data-testid="caldav-token-secret"
        >
          <div className="flex items-center gap-2 bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200">
            <KeyRound size={14} />
            <span className="flex-1 font-medium">{created.name}: 지금만 표시</span>
          </div>
          <div className="divide-y">
            <CopyField label="서버" value={created.server_url} testid="caldav-token-show-url" />
            <CopyField label="사용자명" value={created.username} testid="caldav-token-show-username" />
            <CopyField label="비밀번호" value={created.secret} mono testid="caldav-token-show-secret" />
          </div>
          <div className="flex justify-end border-t px-3 py-2">
            <Button size="sm" onClick={() => setCreated(null)} data-testid="caldav-token-show-close">
              완료
            </Button>
          </div>
        </div>
      )}

      <ul className="mt-6 divide-y rounded-xl border" data-testid="caldav-token-list">
        {data && items.length === 0 && (
          <li className="px-4 py-8 text-center text-sm text-muted-foreground">발급된 비밀번호 없음</li>
        )}
        {items.map((t) => (
          <li key={t.id} className="group flex items-center gap-3 px-4 py-3" data-testid={`caldav-token-row-${t.id}`}>
            <KeyRound size={16} className="text-muted-foreground" />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium">{t.name}</div>
              <div className="text-xs text-muted-foreground">
                {formatDate(t.created_at)} 발급, {lastUsedLabel(t.last_used_at, now)}
              </div>
            </div>
            <button
              type="button"
              onClick={() => revoke(t)}
              data-testid={`caldav-token-revoke-${t.id}`}
              aria-label="폐기"
              className="grid size-8 place-items-center rounded-md text-muted-foreground opacity-0 transition hover:bg-rose-50 hover:text-rose-600 focus-visible:opacity-100 group-hover:opacity-100 max-md:opacity-100 dark:hover:bg-rose-950/40 dark:hover:text-rose-400"
            >
              <Trash2 size={15} />
            </button>
          </li>
        ))}
      </ul>
    </SettingsSection>
  )
}
