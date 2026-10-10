"use client"

// 플레이그라운드: 설정 화면 안 비교. 가짜 데이터만 쓰고 저장하지 않는다.

import { useCallback, useEffect, useRef, useState } from "react"
import {
  Building2,
  Check,
  Copy,
  DoorOpen,
  Mail,
  MailOpen,
  ScrollText,
  Users,
  Webhook,
  type LucideIcon,
} from "lucide-react"

import { useToast } from "@/components/ui-custom/use-toast"
import { cn } from "@/lib/utils"

import { ME, NOW } from "../_mock"

export const WORKSPACE = { id: "ws-ashfield", name: "Ashfield Lab" }

export const EMAIL_CATEGORIES = [
  { key: "event", label: "일정 초대와 응답" },
  { key: "booking", label: "예약" },
] as const

export const CALDAV_SERVER = "https://calendar.ashfield.example/dav/"

export interface Token {
  id: string
  name: string
  createdAt: string
  lastUsedAt: string | null
}

export interface CreatedToken {
  id: string
  name: string
  username: string
  secret: string
  serverUrl: string
}

const daysAgo = (d: number, h = 0) => new Date(NOW.getTime() - d * 86400000 - h * 3600000).toISOString()

const INITIAL_TOKENS: Token[] = [
  { id: "t1", name: "아이폰 캘린더", createdAt: daysAgo(42), lastUsedAt: daysAgo(0, 1) },
  { id: "t2", name: "업무용 노트북 Thunderbird", createdAt: daysAgo(15), lastUsedAt: daysAgo(3) },
  { id: "t3", name: "집 데스크톱", createdAt: daysAgo(120), lastUsedAt: null },
]

export interface AdminLink {
  key: string
  href: string
  title: string
  icon: LucideIcon
}

const WS_BASE = `/settings/workspace/${WORKSPACE.id}`

export const WORKSPACE_LINKS: AdminLink[] = [
  { key: "profile", href: `${WS_BASE}/profile`, title: "워크스페이스 정보", icon: Building2 },
  { key: "members", href: `${WS_BASE}/members`, title: "멤버", icon: Users },
  { key: "rooms", href: `${WS_BASE}/rooms`, title: "회의실", icon: DoorOpen },
  { key: "ws-audit", href: "/audit", title: "감사 로그", icon: ScrollText },
  { key: "ws-smtp", href: `${WS_BASE}/smtp`, title: "SMTP 설정", icon: Mail },
  { key: "templates", href: `${WS_BASE}/email-templates`, title: "이메일 템플릿", icon: MailOpen },
]

export const SYSTEM_LINKS: AdminLink[] = [
  { key: "workspaces", href: "/admin/workspaces", title: "워크스페이스 관리", icon: Building2 },
  { key: "smtp", href: "/admin/smtp", title: "SMTP 설정", icon: Mail },
  { key: "audit", href: "/audit", title: "감사 로그", icon: ScrollText },
  { key: "webhooks", href: "/webhooks", title: "웹훅", icon: Webhook },
]

function randomSecret() {
  const abc = "abcdefghijkmnpqrstuvwxyz23456789"
  let s = ""
  for (let i = 0; i < 20; i++) {
    if (i && i % 5 === 0) s += "-"
    s += abc[Math.floor(Math.random() * abc.length)]
  }
  return s
}

/** 알림 설정과 CalDAV 비밀번호를 로컬 state 로 흉내 낸다. */
export function useSettings() {
  const { toast } = useToast()
  const [emailOn, setEmailOn] = useState(true)
  const [cats, setCats] = useState<Record<string, boolean>>({ event: true, booking: false })
  const [tokens, setTokens] = useState<Token[]>(INITIAL_TOKENS)

  function toggleEmail() {
    setEmailOn((v) => !v)
    toast.success(emailOn ? "이메일 알림을 껐습니다" : "이메일 알림을 켰습니다")
  }

  function toggleCat(key: string) {
    setCats((c) => ({ ...c, [key]: c[key] === false }))
  }

  function createToken(name: string): CreatedToken {
    const id = `t${Date.now()}`
    setTokens((t) => [{ id, name, createdAt: NOW.toISOString(), lastUsedAt: null }, ...t])
    return { id, name, username: ME.email, secret: randomSecret(), serverUrl: CALDAV_SERVER }
  }

  function revokeToken(id: string) {
    setTokens((t) => t.filter((x) => x.id !== id))
    toast.success("비밀번호를 폐기했습니다")
  }

  return { emailOn, cats, tokens, toggleEmail, toggleCat, createToken, revokeToken }
}

export type Settings = ReturnType<typeof useSettings>

/** 플레이그라운드라 실제로 이동하지 않고 주소만 알린다. */
export function useFakeNav() {
  const { toast } = useToast()
  return (href: string) => toast.info(`이동: ${href}`)
}

export function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("ko-KR", { year: "numeric", month: "short", day: "numeric" })
}

export function lastUsedLabel(iso: string | null) {
  if (!iso) return "사용 기록 없음"
  const s = Math.round((NOW.getTime() - new Date(iso).getTime()) / 1000)
  if (s < 3600) return "방금 사용"
  if (s < 86400) return `${Math.floor(s / 3600)}시간 전 사용`
  return `${Math.floor(s / 86400)}일 전 사용`
}

export function Switch({
  checked,
  onChange,
  disabled,
  testId,
  label,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  disabled?: boolean
  testId: string
  label?: string
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      data-testid={testId}
      className={cn(
        "relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/30 disabled:opacity-40",
        checked ? "bg-primary" : "bg-input dark:bg-input/80",
      )}
    >
      <span
        className={cn(
          "inline-block size-4 rounded-full bg-background shadow-sm transition-transform",
          checked ? "translate-x-[18px]" : "translate-x-0.5",
        )}
      />
    </button>
  )
}

export function useCopied(ms = 1600) {
  const [copied, setCopied] = useState<string | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current)
    },
    [],
  )
  const copy = useCallback(
    (text: string, key = text) => {
      void navigator.clipboard?.writeText(text).catch(() => {})
      setCopied(key)
      if (timer.current) clearTimeout(timer.current)
      timer.current = setTimeout(() => setCopied(null), ms)
    },
    [ms],
  )
  return { copied, copy }
}

/** 값 한 줄 + 복사 버튼. 복사하면 잠깐 체크 표시. */
export function CopyField({
  label,
  value,
  mono,
  testid,
}: {
  label: string
  value: string
  mono?: boolean
  testid: string
}) {
  const { copied, copy } = useCopied()
  return (
    <div className="flex items-center gap-3 px-3 py-2">
      <span className="w-16 shrink-0 text-xs text-muted-foreground">{label}</span>
      <input
        readOnly
        value={value}
        onFocus={(e) => e.target.select()}
        data-testid={`${testid}-input`}
        className={cn("min-w-0 flex-1 bg-transparent text-sm outline-none", mono && "font-mono text-[13px]")}
      />
      <button
        type="button"
        onClick={() => copy(value)}
        data-testid={`${testid}-copy`}
        aria-label="복사"
        className={cn(
          "grid size-7 shrink-0 place-items-center rounded-md transition-colors",
          copied
            ? "text-emerald-600 dark:text-emerald-400"
            : "text-muted-foreground hover:bg-muted hover:text-foreground",
        )}
      >
        {copied ? <Check size={14} /> : <Copy size={14} />}
      </button>
    </div>
  )
}
