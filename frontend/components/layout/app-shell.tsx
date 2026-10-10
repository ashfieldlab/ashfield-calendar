"use client"

import { useMemo } from "react"
import { useRouter, usePathname } from "next/navigation"
import Link from "next/link"
import { Activity, CalendarClock, Calendar, FlaskConical, Settings } from "lucide-react"

import {
  AppFrame,
  type WorkspaceOption,
  type NavItem,
  type NavLinkRenderProps,
} from "@/components/ui-custom/app-frame"
import { AppIcon } from "@/components/ui-custom/app-icon"
import { UserMenu } from "@/components/ui-custom/user-menu"

import { useAppContext } from "@/components/providers/app-context"
import { GlobalSearch } from "@/components/layout/global-search"
import { NotificationBell } from "@/components/layout/notification-bell"
import { CalendarSidebar } from "@/components/calendar/calendar-sidebar"
import { signOutAction } from "@/lib/actions/auth"
import { APP } from "@/lib/apps"
import { env } from "@/lib/env"

export function AppShell({ children }: { children: React.ReactNode }) {
  const { authUser, workspaces, workspaceNames, activeWorkspaceId, setActiveWorkspace, isSystemAdmin } =
    useAppContext()
  const pathname = usePathname() ?? ""
  const router = useRouter()

  const sidebarItems: NavItem[] = useMemo(
    () => [
      { id: "calendar", label: "일정", href: "/calendar", icon: <Calendar size={16} />, active: pathname.startsWith("/calendar") },
      { id: "booking-types", label: "예약 양식", href: "/booking-types", icon: <CalendarClock size={16} />, active: pathname.startsWith("/booking-types") },
      { id: "activity", label: "활동", href: "/activity", icon: <Activity size={16} />, active: pathname.startsWith("/activity") },
      { id: "settings", label: "설정", href: "/settings", icon: <Settings size={16} />, active: pathname.startsWith("/settings") },
      ...(env.playground
        ? [{ id: "playground", label: "플레이그라운드", href: "/playground", icon: <FlaskConical size={16} />, active: pathname.startsWith("/playground") }]
        : []),
    ],
    [pathname],
  )

  const workspaceOptions: WorkspaceOption[] = useMemo(
    () => workspaces.map((c) => ({ id: c, name: workspaceNames[c] ?? c })),
    [workspaces, workspaceNames],
  )

  const sidebarRenderLink = (
    item: NavItem,
    props: NavLinkRenderProps,
  ) => (
    <Link
      href={item.href ?? "#"}
      className={props.className}
      data-active={props["data-active"]}
      data-testid={`nav-link-${item.id}`}
    >
      {props.children}
    </Link>
  )

  // 우측 클러스터: 검색 + 알림 + 사용자 메뉴(로그아웃). headerTrailing 은
  // 헤더 우측 전체를 대체하므로, 우리 실데이터 위젯을 여기서 직접 조립한다.
  const headerTrailing = authUser ? (
    <div className="flex items-center gap-2">
      <GlobalSearch />
      <NotificationBell />
      <UserMenu
        user={{ name: authUser.name ?? authUser.email ?? undefined }}
        isServiceAdmin={isSystemAdmin}
        onLogout={async () => {
          // Better Auth 세션 종료 후 받은 주소로 하드 이동 (가드·AppContext 를 새로 태움).
          window.location.href = await signOutAction()
        }}
        onBasicSettings={() => router.push("/settings")}
        onServiceSettings={() => router.push("/admin")}
      />
    </div>
  ) : undefined

  return (
    <AppFrame
      workspaceSwitcher={
        workspaces.length > 0
          ? {
              workspaces: workspaceOptions,
              selectedId: activeWorkspaceId ?? undefined,
              onSelect: (c) => setActiveWorkspace(c.id),
            }
          : undefined
      }
      brand={{
        name: APP.title,
        logo: <AppIcon alt={APP.title} className="h-7 w-7 rounded-md" />,
        onClick: () => router.push(APP.home),
      }}
      headerTrailing={headerTrailing}
      navItems={sidebarItems}
      renderNavLink={sidebarRenderLink}
      sidebarExtra={pathname.startsWith("/calendar") ? <CalendarSidebar /> : undefined}
      // 뷰포트 높이로 고정: 페이지가 자체 h-full overflow-y-auto 로 내부 스크롤.
      // (프레임 기본은 min-h-screen 이라 안 잡으면 페이지 대신 창 전체가 스크롤됨)
      className="h-screen"
      // main/container 를 flex 로 확정 높이 전달: 페이지의 h-full(FullCalendar
      // height:100% 등)이 percentage 로 접히지 않고 뷰포트 높이를 꽉 채우도록.
      mainClassName="flex flex-col min-h-0"
      containerClassName="flex-1 min-h-0"
    >
      {children}
    </AppFrame>
  )
}
