"use client"

import { useMemo, useState } from "react"

import { NotificationDetail } from "@/components/notifications/notification-detail"
import { TypeIcon } from "@/components/notifications/type-icon"
import { useNotificationActions } from "@/components/notifications/use-notification-actions"
import { useAppContext } from "@/components/providers/app-context"
import { Segmented } from "@/components/shared/segmented"
import { Sentence } from "@/components/shared/sentence"
import { cn } from "@/lib/utils"
import { useApiGet } from "@/lib/hooks/use-api"
import type { NotificationItemList } from "@/lib/types/notification"
import { relativeTime } from "@/lib/utils/audit-format"
import { formatDateTime } from "@/lib/utils/format"
import { needsResponse, notifDetail, notifSentence, toView, type NotifView } from "@/lib/utils/notification-format"

type Filter = "all" | "unread" | "respond"

const PAGE = 50
const MAX = 200

export default function NotificationsPage() {
  const { activeWorkspaceId } = useAppContext()
  const actions = useNotificationActions()
  const [limit, setLimit] = useState(PAGE)
  const [filter, setFilter] = useState<Filter>("all")
  const [selected, setSelected] = useState<string | null>(null)

  const { data, error, isLoading } = useApiGet<NotificationItemList>(
    activeWorkspaceId ? `/api/v1/notifications?limit=${limit}` : null,
  )
  const items = useMemo(() => (data?.notifications ?? []).map(toView), [data])
  const unread = data?.unread_count ?? 0
  const pending = items.filter(needsResponse).length

  const list = items.filter((n) => (filter === "unread" ? !n.read : filter === "respond" ? needsResponse(n) : true))
  // 고른 게 없으면 응답이 필요한 알림, 없으면 맨 위
  const current =
    items.find((n) => n.id === selected) ?? (selected ? null : (items.find(needsResponse) ?? items[0] ?? null))

  function pick(n: NotifView) {
    setSelected(n.id)
    if (!n.read) void actions.setRead(n.id, true)
  }

  return (
    <div className="h-full space-y-4 overflow-y-auto px-4 py-8 sm:px-6 lg:px-8" data-testid="notifications-page">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-foreground">알림</h1>
        <div className="flex items-center gap-3">
          <Segmented
            value={filter}
            onChange={setFilter}
            testid="notifications-filter"
            options={[
              { key: "all", label: "전체" },
              { key: "unread", label: `안 읽음 ${unread}` },
              { key: "respond", label: `응답 필요 ${pending}` },
            ]}
          />
          <button
            type="button"
            onClick={() => void actions.markAll()}
            disabled={unread === 0}
            className="text-sm text-muted-foreground hover:text-foreground disabled:opacity-40"
            data-testid="notifications-mark-all-read"
          >
            모두 읽음
          </button>
        </div>
      </header>

      {error ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300">
          불러오지 못했습니다
        </div>
      ) : isLoading ? (
        <p className="text-sm text-muted-foreground">불러오는 중…</p>
      ) : (
        <div className="flex min-h-[560px] flex-col overflow-hidden rounded-xl border bg-card md:flex-row">
          <div className="flex shrink-0 flex-col border-b md:w-[360px] md:border-r md:border-b-0">
            <ul className="max-h-[420px] flex-1 overflow-y-auto md:max-h-none" data-testid="notifications-list">
              {list.length === 0 && (
                <li className="p-8 text-center text-sm text-muted-foreground" data-testid="notifications-empty">
                  알림 없음
                </li>
              )}
              {list.map((n) => (
                <li key={n.id} data-testid={`notifications-row-${n.id}`}>
                  <button
                    type="button"
                    onClick={() => pick(n)}
                    data-testid={`notifications-row-${n.id}-button`}
                    aria-current={current?.id === n.id}
                    className={cn(
                      "flex w-full items-start gap-3 border-b border-border/60 px-4 py-3 text-left transition-colors",
                      current?.id === n.id ? "bg-muted" : "hover:bg-muted/50",
                    )}
                  >
                    <TypeIcon type={n.type} className="mt-0.5" />
                    <div className="min-w-0 flex-1">
                      <p
                        className={cn(
                          "line-clamp-2 text-sm break-keep",
                          n.read ? "text-muted-foreground" : "font-semibold text-foreground",
                        )}
                      >
                        <Sentence parts={notifSentence(n)} />
                      </p>
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">{notifDetail(n)}</p>
                      {needsResponse(n) && (
                        <span className="mt-1.5 inline-block rounded bg-violet-100 px-1.5 py-0.5 text-[11px] font-medium text-violet-700 dark:bg-violet-950 dark:text-violet-300">
                          응답 필요
                        </span>
                      )}
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1.5">
                      <span className="text-[11px] text-muted-foreground" title={formatDateTime(n.at)}>
                        {relativeTime(n.at)}
                      </span>
                      {!n.read && <span className="size-2 rounded-full bg-blue-500" aria-label="안 읽음" />}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
            {data?.has_more && limit < MAX && (
              <button
                type="button"
                onClick={() => setLimit((l) => Math.min(MAX, l + PAGE))}
                data-testid="notifications-load-more"
                className="border-t px-4 py-2 text-sm text-muted-foreground hover:bg-muted/50 hover:text-foreground"
              >
                더 보기
              </button>
            )}
          </div>

          <section className="min-w-0 flex-1">
            {current ? (
              <NotificationDetail v={current} actions={actions} />
            ) : (
              <div className="grid h-full min-h-40 place-items-center text-sm text-muted-foreground">선택한 알림 없음</div>
            )}
          </section>
        </div>
      )}
    </div>
  )
}
