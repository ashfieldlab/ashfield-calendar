"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  ArrowUpRight,
  Bell,
  Building2,
  CalendarSync,
  DoorOpen,
  Mail,
  MailOpen,
  ScrollText,
  Users,
  Webhook,
  type LucideIcon,
} from "lucide-react"

import { useAppContext } from "@/components/providers/app-context"
import { cn } from "@/lib/utils"

interface NavLink {
  key: string
  href: string
  title: string
  icon: LucideIcon
}

const PERSONAL: NavLink[] = [
  { key: "notify", href: "/settings", title: "알림", icon: Bell },
  { key: "caldav", href: "/settings/caldav", title: "외부 캘린더 앱", icon: CalendarSync },
]

const SYSTEM: NavLink[] = [
  { key: "admin-workspaces", href: "/admin/workspaces", title: "워크스페이스 관리", icon: Building2 },
  { key: "admin-smtp", href: "/admin/smtp", title: "SMTP 설정", icon: Mail },
  { key: "audit", href: "/audit", title: "감사 로그", icon: ScrollText },
  { key: "webhooks", href: "/webhooks", title: "웹훅", icon: Webhook },
]

function workspaceLinks(id: string): NavLink[] {
  const base = `/settings/workspace/${encodeURIComponent(id)}`
  return [
    { key: "profile", href: `${base}/profile`, title: "워크스페이스 정보", icon: Building2 },
    { key: "members", href: `${base}/members`, title: "멤버", icon: Users },
    { key: "rooms", href: `${base}/rooms`, title: "회의실", icon: DoorOpen },
    { key: "workspace-audit", href: "/audit", title: "감사 로그", icon: ScrollText },
    { key: "smtp", href: `${base}/smtp`, title: "SMTP 설정", icon: Mail },
    { key: "email-templates", href: `${base}/email-templates`, title: "이메일 템플릿", icon: MailOpen },
  ]
}

/** 설정 메뉴 칸: 개인 설정, 워크스페이스 관리(관리자), 시스템(시스템 관리자). */
export function SettingsNav() {
  const pathname = usePathname() ?? ""
  const { activeWorkspaceId, workspaceNames, isWorkspaceAdmin, isSystemAdmin } = useAppContext()

  const groups: { title: string; links: NavLink[] }[] = [
    ...(isWorkspaceAdmin && activeWorkspaceId
      ? [{ title: workspaceNames[activeWorkspaceId] ?? activeWorkspaceId, links: workspaceLinks(activeWorkspaceId) }]
      : []),
    ...(isSystemAdmin ? [{ title: "시스템", links: SYSTEM }] : []),
  ]

  const isActive = (href: string) =>
    href === "/settings" ? pathname === "/settings" : pathname === href || pathname.startsWith(`${href}/`)

  return (
    <aside
      className="shrink-0 border-b bg-muted/30 md:flex md:w-60 md:flex-col md:gap-6 md:overflow-y-auto md:border-b-0 md:border-r md:p-3"
      data-testid="settings-nav"
    >
      <h1 className="hidden px-2 pt-2 text-lg font-semibold md:block">설정</h1>

      {/* 좁은 화면: 한 줄 가로 스크롤 */}
      <nav className="flex gap-1 overflow-x-auto px-3 py-2 md:hidden">
        {[...PERSONAL, ...groups.flatMap((g) => g.links.filter((l) => l.href.startsWith("/settings")))].map((l) => (
          <Link
            key={l.key}
            href={l.href}
            data-testid={`settings-nav-mobile-${l.key}`}
            className={cn(
              "shrink-0 rounded-full px-3 py-1 text-sm",
              isActive(l.href) ? "bg-foreground text-background" : "text-muted-foreground hover:bg-muted",
            )}
          >
            {l.title}
          </Link>
        ))}
      </nav>

      <nav className="hidden space-y-0.5 md:block">
        {PERSONAL.map(({ key, href, title, icon: Icon }) => (
          <Link
            key={key}
            href={href}
            data-testid={`settings-nav-${key}`}
            aria-current={isActive(href) ? "page" : undefined}
            className={cn(
              "flex h-9 w-full items-center gap-2.5 rounded-lg px-2.5 text-sm transition-colors",
              isActive(href)
                ? "bg-background font-medium text-foreground shadow-sm ring-1 ring-border"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            <Icon size={16} />
            {title}
          </Link>
        ))}
      </nav>

      {groups.map((g) => (
        <div key={g.title} className="hidden md:block">
          <p className="truncate px-2.5 pb-1 text-[11px] font-medium text-muted-foreground">{g.title}</p>
          <div className="space-y-0.5">
            {g.links.map(({ key, href, title, icon: Icon }) => {
              const inside = href.startsWith("/settings/")
              const on = inside && isActive(href)
              return (
                <Link
                  key={key}
                  href={href}
                  data-testid={`settings-link-${key}`}
                  aria-current={on ? "page" : undefined}
                  className={cn(
                    "group flex h-8 items-center gap-2.5 rounded-lg px-2.5 text-sm transition-colors",
                    on
                      ? "bg-background font-medium text-foreground shadow-sm ring-1 ring-border"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                >
                  <Icon size={15} />
                  <span className="flex-1 truncate">{title}</span>
                  {!inside && (
                    <ArrowUpRight size={13} className="opacity-0 transition-opacity group-hover:opacity-100" />
                  )}
                </Link>
              )
            })}
          </div>
        </div>
      ))}
    </aside>
  )
}
