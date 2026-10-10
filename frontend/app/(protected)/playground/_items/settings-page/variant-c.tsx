"use client"

// 안 C: 위쪽 탭. 연결된 기기를 카드로 보여 주고, 새 기기는 2단계(이름, 접속 정보)로 추가.

import { useState } from "react"
import { ArrowLeft, Check, ChevronRight, Laptop, Monitor, Plus, Smartphone, Trash2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { useConfirm } from "@/components/ui-custom/use-confirm"
import { cn } from "@/lib/utils"

import { NOW } from "../_mock"
import {
  CopyField,
  EMAIL_CATEGORIES,
  SYSTEM_LINKS,
  Switch,
  WORKSPACE,
  WORKSPACE_LINKS,
  lastUsedLabel,
  useFakeNav,
  useSettings,
  type AdminLink,
  type CreatedToken,
  type Settings,
} from "./shared"

type Tab = "notify" | "devices" | "admin"

const TABS: { key: Tab; label: string }[] = [
  { key: "notify", label: "알림" },
  { key: "devices", label: "캘린더 앱" },
  { key: "admin", label: "관리" },
]

export function VariantC() {
  const s = useSettings()
  const [tab, setTab] = useState<Tab>("notify")

  return (
    <div className="mx-auto min-h-[600px] max-w-3xl">
      <h1 className="text-2xl font-semibold">설정</h1>
      <div role="tablist" className="mt-4 flex gap-6 border-b">
        {TABS.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={tab === key}
            onClick={() => setTab(key)}
            data-testid={`pg-settings-page-c-tab-${key}`}
            className={cn(
              "-mb-px border-b-2 pb-2.5 text-sm transition-colors",
              tab === key
                ? "border-primary font-medium text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {label}
            {key === "devices" && (
              <span className="ml-1.5 rounded-full bg-muted px-1.5 text-[11px] text-muted-foreground">{s.tokens.length}</span>
            )}
          </button>
        ))}
      </div>

      <div className="pt-6">
        {tab === "notify" && <Notify s={s} />}
        {tab === "devices" && <Devices s={s} />}
        {tab === "admin" && <Admin />}
      </div>
    </div>
  )
}

function Notify({ s }: { s: Settings }) {
  return (
    <div className="overflow-hidden rounded-xl border">
      <div className="flex items-center gap-3 bg-muted/40 px-4 py-3">
        <span className="flex-1 text-sm font-medium">이메일로 받기</span>
        <Switch checked={s.emailOn} onChange={s.toggleEmail} testId="pg-settings-page-c-email-toggle" label="이메일 알림" />
      </div>
      {EMAIL_CATEGORIES.map((c) => {
        const on = s.emailOn && s.cats[c.key] !== false
        return (
          <button
            key={c.key}
            type="button"
            disabled={!s.emailOn}
            onClick={() => s.toggleCat(c.key)}
            aria-pressed={on}
            data-testid={`pg-settings-page-c-email-${c.key}-toggle`}
            className="flex w-full items-center gap-3 border-t px-4 py-3 text-left text-sm transition hover:bg-muted/40 disabled:pointer-events-none disabled:opacity-40"
          >
            <span
              className={cn(
                "grid size-5 place-items-center rounded-md border transition",
                on ? "border-primary bg-primary text-primary-foreground" : "border-input",
              )}
            >
              {on && <Check size={13} />}
            </span>
            {c.label}
          </button>
        )
      })}
    </div>
  )
}

function deviceIcon(name: string) {
  if (/폰|iphone|android|모바일/i.test(name)) return Smartphone
  if (/노트북|laptop|macbook/i.test(name)) return Laptop
  return Monitor
}

function Devices({ s }: { s: Settings }) {
  const confirm = useConfirm()
  const [step, setStep] = useState<0 | 1 | 2>(0)
  const [name, setName] = useState("")
  const [created, setCreated] = useState<CreatedToken | null>(null)

  if (step > 0) {
    return (
      <div className="mx-auto max-w-md rounded-2xl border p-6">
        <div className="flex items-center gap-2">
          {step === 1 && (
            <button
              type="button"
              onClick={() => setStep(0)}
              data-testid="pg-settings-page-c-add-back"
              aria-label="뒤로"
              className="-ml-2 grid size-8 place-items-center rounded-md text-muted-foreground hover:bg-muted"
            >
              <ArrowLeft size={16} />
            </button>
          )}
          <h2 className="flex-1 font-semibold">{step === 1 ? "새 기기" : created?.name}</h2>
          <span className="text-xs text-muted-foreground">{step}/2</span>
        </div>
        <div className="mt-2 flex gap-1">
          <span className="h-1 flex-1 rounded-full bg-primary" />
          <span className={cn("h-1 flex-1 rounded-full", step === 2 ? "bg-primary" : "bg-muted")} />
        </div>

        {step === 1 ? (
          <form
            className="mt-6 space-y-4"
            onSubmit={(e) => {
              e.preventDefault()
              if (!name.trim()) return
              setCreated(s.createToken(name.trim()))
              setName("")
              setStep(2)
            }}
          >
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="예: 아이폰 캘린더"
              data-testid="pg-settings-page-c-add-name"
              className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:border-ring focus:ring-3 focus:ring-ring/20"
            />
            <Button type="submit" className="h-10 w-full" disabled={!name.trim()} data-testid="pg-settings-page-c-add-next">
              비밀번호 발급
            </Button>
          </form>
        ) : (
          created && (
            <div className="mt-6 space-y-4">
              <div className="divide-y rounded-lg border">
                <CopyField label="서버" value={created.serverUrl} testid="pg-settings-page-c-show-url" />
                <CopyField label="사용자명" value={created.username} testid="pg-settings-page-c-show-user" />
                <CopyField label="비밀번호" value={created.secret} mono testid="pg-settings-page-c-show-secret" />
              </div>
              <p className="text-xs text-amber-700 dark:text-amber-300">비밀번호는 지금만 표시, {WORKSPACE.name} 일정만 연결</p>
              <Button
                className="h-10 w-full"
                onClick={() => {
                  setCreated(null)
                  setStep(0)
                }}
                data-testid="pg-settings-page-c-add-done"
              >
                완료
              </Button>
            </div>
          )
        )}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3" data-testid="pg-settings-page-c-devices">
      {s.tokens.map((t) => {
        const Icon = deviceIcon(t.name)
        const recent = !!t.lastUsedAt && NOW.getTime() - new Date(t.lastUsedAt).getTime() < 86400000
        return (
          <div key={t.id} className="group relative flex flex-col rounded-xl border bg-card p-4">
            <div className="flex items-start justify-between">
              <span className="grid size-10 place-items-center rounded-xl bg-muted text-muted-foreground">
                <Icon size={20} />
              </span>
              <button
                type="button"
                onClick={async () => {
                  const ok = await confirm({
                    title: "연결 해제",
                    description: `'${t.name}' 비밀번호를 폐기합니다.`,
                    confirmText: "폐기",
                    variant: "destructive",
                  })
                  if (ok) s.revokeToken(t.id)
                }}
                data-testid={`pg-settings-page-c-device-${t.id}-revoke`}
                aria-label="폐기"
                className="grid size-7 place-items-center rounded-md text-muted-foreground opacity-0 transition hover:bg-rose-50 hover:text-rose-600 group-hover:opacity-100 focus-visible:opacity-100 dark:hover:bg-rose-950/40 dark:hover:text-rose-400"
              >
                <Trash2 size={14} />
              </button>
            </div>
            <div className="mt-4 truncate text-sm font-medium">{t.name}</div>
            <div className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
              <span
                className={cn(
                  "size-1.5 rounded-full",
                  recent ? "bg-emerald-500 dark:bg-emerald-400" : "bg-muted-foreground/40",
                )}
              />
              {lastUsedLabel(t.lastUsedAt)}
            </div>
          </div>
        )
      })}
      <button
        type="button"
        onClick={() => setStep(1)}
        data-testid="pg-settings-page-c-add"
        className="flex min-h-[132px] flex-col items-center justify-center gap-2 rounded-xl border border-dashed text-sm text-muted-foreground transition hover:border-primary/50 hover:bg-muted/40 hover:text-foreground"
      >
        <Plus size={20} />
        기기 추가
      </button>
    </div>
  )
}

function Admin() {
  const go = useFakeNav()
  return (
    <div className="grid gap-6 md:grid-cols-2">
      <LinkList title={WORKSPACE.name} links={WORKSPACE_LINKS} prefix="ws" onGo={go} />
      <LinkList title="시스템" links={SYSTEM_LINKS} prefix="sys" onGo={go} />
    </div>
  )
}

function LinkList({
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
      <h2 className="pb-2 text-xs font-medium text-muted-foreground">{title}</h2>
      <div className="divide-y overflow-hidden rounded-xl border">
        {links.map(({ key, href, title: t, icon: Icon }) => (
          <a
            key={key}
            href={href}
            onClick={(e) => {
              e.preventDefault()
              onGo(href)
            }}
            data-testid={`pg-settings-page-c-${prefix}-${key}`}
            className="flex items-center gap-3 px-4 py-3 text-sm hover:bg-muted/50"
          >
            <Icon size={16} className="text-muted-foreground" />
            <span className="flex-1">{t}</span>
            <ChevronRight size={15} className="text-muted-foreground/70" />
          </a>
        ))}
      </div>
    </section>
  )
}
