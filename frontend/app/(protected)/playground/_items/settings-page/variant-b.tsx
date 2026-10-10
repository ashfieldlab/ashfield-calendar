"use client"

// 안 B: 한 페이지 카드. 위에서 아래로 훑으면 끝나는 구성, 관리 메뉴는 타일 격자.

import { useState } from "react"
import { CalendarSync, KeyRound, Plus, ShieldCheck, Trash2, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

import { ME } from "../_mock"
import {
  CALDAV_SERVER,
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
} from "./shared"

export function VariantB() {
  const s = useSettings()
  const go = useFakeNav()
  const [name, setName] = useState("")
  const [created, setCreated] = useState<CreatedToken | null>(null)
  const [revoking, setRevoking] = useState<string | null>(null)

  function submit() {
    if (!name.trim()) return
    setCreated(s.createToken(name.trim()))
    setName("")
  }

  return (
    <div className="relative mx-auto max-w-2xl space-y-5 pb-10">
      <header className="flex items-center gap-4 pt-2">
        <span
          className="grid size-12 place-items-center rounded-full text-lg font-semibold text-white"
          style={{ backgroundColor: ME.color }}
        >
          {ME.name[0]}
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-semibold">설정</h1>
          <p className="truncate text-sm text-muted-foreground">
            {ME.email}, {WORKSPACE.name}
          </p>
        </div>
      </header>

      <Card title="이메일 알림" action={<Switch checked={s.emailOn} onChange={s.toggleEmail} testId="pg-settings-page-b-email-toggle" label="이메일 알림" />}>
        <div className="flex flex-wrap gap-2 px-5 pb-5">
          {EMAIL_CATEGORIES.map((c) => {
            const on = s.emailOn && s.cats[c.key] !== false
            return (
              <button
                key={c.key}
                type="button"
                disabled={!s.emailOn}
                aria-pressed={on}
                onClick={() => s.toggleCat(c.key)}
                data-testid={`pg-settings-page-b-email-${c.key}-toggle`}
                className={cn(
                  "inline-flex h-9 items-center gap-2 rounded-full border px-3.5 text-sm transition disabled:opacity-40",
                  on ? "border-primary bg-primary/10 text-foreground" : "border-input text-muted-foreground hover:bg-muted",
                )}
              >
                <span className={cn("size-2 rounded-full", on ? "bg-primary" : "bg-muted-foreground/40")} />
                {c.label}
              </button>
            )
          })}
        </div>
      </Card>

      <Card title="외부 캘린더 앱" icon={CalendarSync}>
        <div className="mx-5 divide-y rounded-lg border bg-muted/30">
          <CopyField label="서버" value={CALDAV_SERVER} testid="pg-settings-page-b-server" />
          <CopyField label="사용자명" value={ME.email} testid="pg-settings-page-b-user" />
        </div>

        <ul className="mt-4 divide-y border-t" data-testid="pg-settings-page-b-token-list">
          {s.tokens.map((t) => (
            <li key={t.id} className="flex items-center gap-3 px-5 py-3">
              <KeyRound size={15} className="shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm">{t.name}</div>
                <div className="text-xs text-muted-foreground">
                  {formatDate(t.createdAt)}, {lastUsedLabel(t.lastUsedAt)}
                </div>
              </div>
              {revoking === t.id ? (
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="sm" onClick={() => setRevoking(null)} data-testid={`pg-settings-page-b-token-${t.id}-keep`}>
                    취소
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => {
                      s.revokeToken(t.id)
                      setRevoking(null)
                    }}
                    data-testid={`pg-settings-page-b-token-${t.id}-confirm`}
                  >
                    폐기
                  </Button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setRevoking(t.id)}
                  data-testid={`pg-settings-page-b-token-${t.id}-revoke`}
                  aria-label="폐기"
                  className="grid size-8 place-items-center rounded-md text-muted-foreground hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/40 dark:hover:text-rose-400"
                >
                  <Trash2 size={15} />
                </button>
              )}
            </li>
          ))}
          <li className="px-5 py-3">
            <form
              className="flex items-center gap-2"
              onSubmit={(e) => {
                e.preventDefault()
                submit()
              }}
            >
              <Plus size={15} className="shrink-0 text-muted-foreground" />
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="새 기기 이름"
                data-testid="pg-settings-page-b-token-name"
                className="h-8 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/70"
              />
              <Button type="submit" size="sm" variant="outline" disabled={!name.trim()} data-testid="pg-settings-page-b-token-create">
                발급
              </Button>
            </form>
          </li>
        </ul>
      </Card>

      <Tiles title={`${WORKSPACE.name} 관리`} links={WORKSPACE_LINKS} prefix="ws" onGo={go} />
      <Tiles title="시스템 관리" links={SYSTEM_LINKS} prefix="sys" onGo={go} />

      {created && (
        <div className="fixed inset-0 z-40 grid place-items-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl border bg-background shadow-2xl" data-testid="pg-settings-page-b-secret-modal">
            <div className="flex items-center gap-3 px-5 pt-5">
              <span className="grid size-9 place-items-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
                <ShieldCheck size={18} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate font-semibold">{created.name}</div>
                <div className="text-xs text-rose-600 dark:text-rose-400">비밀번호는 이 창에서만 표시</div>
              </div>
              <button
                type="button"
                onClick={() => setCreated(null)}
                data-testid="pg-settings-page-b-secret-close"
                aria-label="닫기"
                className="grid size-8 place-items-center rounded-md text-muted-foreground hover:bg-muted"
              >
                <X size={16} />
              </button>
            </div>
            <div className="m-5 divide-y rounded-lg border">
              <CopyField label="서버" value={created.serverUrl} testid="pg-settings-page-b-show-url" />
              <CopyField label="사용자명" value={created.username} testid="pg-settings-page-b-show-user" />
              <CopyField label="비밀번호" value={created.secret} mono testid="pg-settings-page-b-show-secret" />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function Card({
  title,
  icon: Icon,
  action,
  children,
}: {
  title: string
  icon?: typeof CalendarSync
  action?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <section className="overflow-hidden rounded-2xl border bg-card">
      <header className="flex items-center gap-2 px-5 py-4">
        {Icon && <Icon size={16} className="text-muted-foreground" />}
        <h2 className="flex-1 text-[15px] font-semibold">{title}</h2>
        {action}
      </header>
      {children}
    </section>
  )
}

function Tiles({
  title,
  links,
  prefix,
  onGo,
}: {
  title: string
  links: AdminLink[]
  prefix: string
  onGo: (href: string) => void
}) {
  return (
    <section>
      <h2 className="px-1 pb-2 text-sm font-medium text-muted-foreground">{title}</h2>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {links.map(({ key, href, title: t, icon: Icon }) => (
          <a
            key={key}
            href={href}
            onClick={(e) => {
              e.preventDefault()
              onGo(href)
            }}
            data-testid={`pg-settings-page-b-${prefix}-${key}`}
            className="flex items-center gap-3 rounded-xl border bg-card px-3.5 py-3 text-sm transition hover:border-primary/40 hover:bg-muted/40"
          >
            <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground">
              <Icon size={16} />
            </span>
            <span className="truncate font-medium">{t}</span>
          </a>
        ))}
      </div>
    </section>
  )
}
