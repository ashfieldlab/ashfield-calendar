"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { Bell } from "lucide-react"

import { TypeIcon } from "@/components/notifications/type-icon"
import { useNotificationActions } from "@/components/notifications/use-notification-actions"
import { useAppContext } from "@/components/providers/app-context"
import { Sentence } from "@/components/shared/sentence"
import { cn } from "@/lib/utils"
import { useApiGet } from "@/lib/hooks/use-api"
import type { NotificationItemList } from "@/lib/types/notification"
import { DAY_BUCKETS, dayBucket } from "@/lib/utils/day-format"
import { notifDetail, notifHref, notifSentence, toView } from "@/lib/utils/notification-format"

export function NotificationBell() {
  const { activeWorkspaceId } = useAppContext()
  const actions = useNotificationActions()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  // 활성 워크스페이스(쿠키) 준비 후에만 호출: 첫 로그인 레이스로 X-Active-Workspace-Id 누락 →
  // 422 ("입력 정보를 다시 확인해주세요") 토스트 뜨는 것 방지.
  const { data } = useApiGet<NotificationItemList>(
    activeWorkspaceId ? "/api/v1/notifications?limit=20" : null,
    { refreshInterval: 30_000 },
  )
  const items = useMemo(() => (data?.notifications ?? []).map(toView), [data])
  const unread = data?.unread_count ?? items.filter((n) => !n.read).length
  const groups = useMemo(() => {
    const now = new Date()
    return DAY_BUCKETS.map((b) => ({ label: b, items: items.filter((n) => dayBucket(n.at, now) === b) })).filter(
      (g) => g.items.length > 0,
    )
  }, [items])

  useEffect(() => {
    if (!open) return
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    window.addEventListener("mousedown", onClick)
    return () => window.removeEventListener("mousedown", onClick)
  }, [open])

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        data-testid="notification-bell"
        aria-label="알림"
        aria-expanded={open}
        className={cn(
          "relative rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground",
          open && "bg-muted text-foreground",
        )}
      >
        <Bell size={18} />
        {unread > 0 && (
          <span
            data-testid="notification-unread-badge"
            className="absolute -top-0.5 -right-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-semibold text-white"
          >
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div
          data-testid="notification-panel"
          className="absolute right-0 z-50 mt-2 w-80 overflow-hidden rounded-xl border border-border bg-card shadow-lg"
        >
          <div className="flex items-center justify-between border-b border-border/60 px-3 py-2">
            <h3 className="text-sm font-semibold text-foreground">알림</h3>
            {unread > 0 && (
              <button
                onClick={() => void actions.markAll()}
                data-testid="notification-mark-all-read"
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                모두 읽음
              </button>
            )}
          </div>
          <div className="max-h-96 overflow-y-auto">
            {groups.length === 0 ? (
              <div className="flex flex-col items-center gap-2 p-8 text-sm text-muted-foreground">
                <Bell className="size-5" />
                알림 없음
              </div>
            ) : (
              groups.map((g) => (
                <div key={g.label}>
                  <p className="bg-muted/40 px-3 py-1 text-[11px] font-medium text-muted-foreground">{g.label}</p>
                  <ul className="divide-y divide-border/60">
                    {g.items.map((n) => (
                      <li key={n.id} data-testid={`notification-row-${n.id}`}>
                        <Link
                          href={notifHref(n)}
                          onClick={() => {
                            if (!n.read) void actions.setRead(n.id, true)
                            setOpen(false)
                          }}
                          data-testid={`notification-row-${n.id}-link`}
                          className="flex w-full items-start gap-2.5 px-3 py-2 text-left hover:bg-muted/50"
                        >
                          <TypeIcon type={n.type} className="size-6 [&_svg]:size-3" />
                          <div className="min-w-0 flex-1">
                            <p
                              className={cn(
                                "truncate text-sm",
                                n.read ? "text-muted-foreground" : "font-medium text-foreground",
                              )}
                            >
                              <Sentence parts={notifSentence(n)} />
                            </p>
                            <p className="truncate text-xs text-muted-foreground">{notifDetail(n)}</p>
                          </div>
                          {!n.read && (
                            <span className="mt-1.5 size-2 shrink-0 rounded-full bg-blue-500" aria-label="안 읽음" />
                          )}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ))
            )}
          </div>
          <Link
            href="/notifications"
            onClick={() => setOpen(false)}
            data-testid="notification-see-all"
            className="block border-t border-border/60 px-3 py-2 text-center text-xs font-medium text-muted-foreground hover:bg-muted/50 hover:text-foreground"
          >
            전체 보기
          </Link>
        </div>
      )}
    </div>
  )
}
