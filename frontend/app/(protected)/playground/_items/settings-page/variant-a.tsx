"use client"

// 안 A: 왼쪽 내비 + 오른쪽 섹션. 개인 설정은 오른쪽에 펼치고, 관리 메뉴는 내비에서 바로 이동.

import { useState } from "react"
import { ArrowUpRight, Bell, CalendarSync, KeyRound, Plus, Trash2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { useConfirm } from "@/components/ui-custom/use-confirm"
import { cn } from "@/lib/utils"

import {
  CopyField,
  EMAIL_CATEGORIES,
  SYSTEM_LINKS,
  Switch,
  WORKSPACE,
  WORKSPACE_LINKS,
  formatDate,
  lastUsedLabel,
  useFakeNav,
  useSettings,
  type AdminLink,
  type CreatedToken,
  type Settings,
} from "./shared"

type Section = "notify" | "caldav"

const SECTIONS: { key: Section; label: string; icon: typeof Bell }[] = [
  { key: "notify", label: "알림", icon: Bell },
  { key: "caldav", label: "외부 캘린더 앱", icon: CalendarSync },
]

export function VariantA() {
  const s = useSettings()
  const [section, setSection] = useState<Section>("notify")
  const go = useFakeNav()

  return (
    <div className="flex h-full min-h-[600px] overflow-hidden rounded-xl border bg-background">
      <aside className="flex w-60 shrink-0 flex-col gap-6 overflow-y-auto border-r bg-muted/30 p-3">
        <h1 className="px-2 pt-2 text-lg font-semibold">설정</h1>

        <nav className="space-y-0.5">
          {SECTIONS.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              type="button"
              onClick={() => setSection(key)}
              data-testid={`pg-settings-page-a-nav-${key}`}
              className={cn(
                "flex h-9 w-full items-center gap-2.5 rounded-lg px-2.5 text-sm transition-colors",
                section === key
                  ? "bg-background font-medium text-foreground shadow-sm ring-1 ring-border"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              <Icon size={16} />
              {label}
            </button>
          ))}
        </nav>

        <NavGroup title={WORKSPACE.name} links={WORKSPACE_LINKS} onGo={go} />
        <NavGroup title="시스템" links={SYSTEM_LINKS} onGo={go} />
      </aside>

      <main className="min-w-0 flex-1 overflow-y-auto px-10 py-8">
        <div className="mx-auto max-w-xl">
          {section === "notify" ? <NotifySection s={s} /> : <CaldavSection s={s} />}
        </div>
      </main>
    </div>
  )
}

function NavGroup({ title, links, onGo }: { title: string; links: AdminLink[]; onGo: (href: string) => void }) {
  return (
    <div>
      <p className="truncate px-2.5 pb-1 text-[11px] font-medium text-muted-foreground">{title}</p>
      <div className="space-y-0.5">
        {links.map(({ key, href, title: t, icon: Icon }) => (
          <a
            key={key}
            href={href}
            onClick={(e) => {
              e.preventDefault()
              onGo(href)
            }}
            data-testid={`pg-settings-page-a-link-${key}`}
            className="group flex h-8 items-center gap-2.5 rounded-lg px-2.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <Icon size={15} />
            <span className="flex-1 truncate">{t}</span>
            <ArrowUpRight size={13} className="opacity-0 transition-opacity group-hover:opacity-100" />
          </a>
        ))}
      </div>
    </div>
  )
}

function NotifySection({ s }: { s: Settings }) {
  return (
    <section>
      <h2 className="text-xl font-semibold">알림</h2>
      <div className="mt-6 divide-y rounded-xl border">
        <div className="flex items-center gap-3 px-4 py-3.5">
          <span className="flex-1 text-sm font-medium">이메일 알림</span>
          <Switch checked={s.emailOn} onChange={s.toggleEmail} testId="pg-settings-page-a-email-toggle" label="이메일 알림" />
        </div>
        {EMAIL_CATEGORIES.map((c) => (
          <div key={c.key} className={cn("flex items-center gap-3 py-3 pr-4 pl-8", !s.emailOn && "opacity-50")}>
            <span className="flex-1 text-sm">{c.label}</span>
            <Switch
              checked={s.emailOn && s.cats[c.key] !== false}
              disabled={!s.emailOn}
              onChange={() => s.toggleCat(c.key)}
              testId={`pg-settings-page-a-email-${c.key}-toggle`}
              label={c.label}
            />
          </div>
        ))}
      </div>
    </section>
  )
}

function CaldavSection({ s }: { s: Settings }) {
  const confirm = useConfirm()
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState("")
  const [created, setCreated] = useState<CreatedToken | null>(null)

  function submit() {
    if (!name.trim()) return
    setCreated(s.createToken(name.trim()))
    setName("")
    setAdding(false)
  }

  return (
    <section>
      <div className="flex items-center gap-3">
        <h2 className="flex-1 text-xl font-semibold">외부 캘린더 앱</h2>
        {!adding && !created && (
          <Button size="sm" onClick={() => setAdding(true)} data-testid="pg-settings-page-a-token-new">
            <Plus /> 앱 비밀번호
          </Button>
        )}
      </div>
      <p className="mt-1 text-sm text-muted-foreground">{WORKSPACE.name} 일정만 연결</p>

      {adding && (
        <form
          className="mt-6 flex gap-2 rounded-xl border bg-muted/30 p-3"
          onSubmit={(e) => {
            e.preventDefault()
            submit()
          }}
        >
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Escape" && setAdding(false)}
            placeholder="기기 이름"
            data-testid="pg-settings-page-a-token-name"
            className="h-8 min-w-0 flex-1 rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus:border-ring focus:ring-3 focus:ring-ring/20"
          />
          <Button type="button" variant="ghost" size="sm" onClick={() => setAdding(false)} data-testid="pg-settings-page-a-token-cancel">
            취소
          </Button>
          <Button type="submit" size="sm" disabled={!name.trim()} data-testid="pg-settings-page-a-token-create">
            발급
          </Button>
        </form>
      )}

      {created && (
        <div className="mt-6 overflow-hidden rounded-xl border border-emerald-300 dark:border-emerald-800">
          <div className="flex items-center gap-2 bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200">
            <KeyRound size={14} />
            <span className="flex-1 font-medium">{created.name}: 지금만 표시</span>
          </div>
          <div className="divide-y">
            <CopyField label="서버" value={created.serverUrl} testid="pg-settings-page-a-show-url" />
            <CopyField label="사용자명" value={created.username} testid="pg-settings-page-a-show-user" />
            <CopyField label="비밀번호" value={created.secret} mono testid="pg-settings-page-a-show-secret" />
          </div>
          <div className="flex justify-end border-t px-3 py-2">
            <Button size="sm" onClick={() => setCreated(null)} data-testid="pg-settings-page-a-show-done">
              완료
            </Button>
          </div>
        </div>
      )}

      <ul className="mt-6 divide-y rounded-xl border" data-testid="pg-settings-page-a-token-list">
        {s.tokens.length === 0 && <li className="px-4 py-8 text-center text-sm text-muted-foreground">발급된 비밀번호 없음</li>}
        {s.tokens.map((t) => (
          <li key={t.id} className="group flex items-center gap-3 px-4 py-3">
            <KeyRound size={16} className="text-muted-foreground" />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium">{t.name}</div>
              <div className="text-xs text-muted-foreground">
                {formatDate(t.createdAt)} 발급, {lastUsedLabel(t.lastUsedAt)}
              </div>
            </div>
            <button
              type="button"
              onClick={async () => {
                const ok = await confirm({
                  title: "앱 비밀번호 폐기",
                  description: `'${t.name}' 연결이 즉시 끊깁니다.`,
                  confirmText: "폐기",
                  variant: "destructive",
                })
                if (ok) s.revokeToken(t.id)
              }}
              data-testid={`pg-settings-page-a-token-${t.id}-revoke`}
              aria-label="폐기"
              className="grid size-8 place-items-center rounded-md text-muted-foreground opacity-0 transition hover:bg-rose-50 hover:text-rose-600 group-hover:opacity-100 focus-visible:opacity-100 dark:hover:bg-rose-950/40 dark:hover:text-rose-400"
            >
              <Trash2 size={15} />
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}
