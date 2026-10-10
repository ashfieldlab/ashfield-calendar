"use client"

import { useState } from "react"
import { Download, Plus, RefreshCw, Rss, Trash2 } from "lucide-react"

import { useToast } from "@/components/ui-custom/use-toast"

import { api, apiDownload } from "@/lib/api-client"
import { invalidateApi } from "@/lib/hooks/use-api"
import { useConfirm } from "@/components/ui-custom/use-confirm"
import { formatDateTime } from "@/lib/utils/format"
import type { CalendarResponse } from "@/lib/types/api"

import { CreateCalendarDialog } from "./create-calendar-dialog"
import { SubscriptionModal } from "./subscription-modal"

interface Props {
  calendars: CalendarResponse[]
}

/** 캘린더 목록 + 표시 토글 + 추가/관리. 일정 화면 왼쪽 패널(모바일은 팝오버)에 들어간다. */
export function CalendarList({ calendars }: Props) {
  const { toast } = useToast()
  const confirm = useConfirm()
  const [openNew, setOpenNew] = useState(false)
  const [subscribingCal, setSubscribingCal] = useState<CalendarResponse | null>(null)

  async function togglePref(cal: CalendarResponse) {
    try {
      await api(`/api/v1/calendars/${cal.id}/preferences`, {
        method: "PATCH",
        body: { hidden: !cal.hidden },
      })
      invalidateApi("/api/v1/calendars")
      invalidateApi("/api/v1/events")
    } catch (e) {
      toast.error(`설정 변경 실패: ${(e as Error).message}`)
    }
  }

  async function refreshIcs(cal: CalendarResponse) {
    try {
      await api(`/api/v1/calendars/${cal.id}/refresh`, { method: "POST" })
      toast.success("동기화했습니다")
      invalidateApi("/api/v1/calendars")
      invalidateApi("/api/v1/events")
    } catch (e) {
      toast.error(`동기화 실패: ${(e as Error).message}`)
    }
  }

  async function deleteCalendar(cal: CalendarResponse) {
    const ok = await confirm({
      title: "캘린더 삭제",
      description: `'${cal.name}' 캘린더를 삭제하시겠습니까? 안의 일정도 함께 삭제됩니다.`,
      confirmText: "삭제",
      variant: "destructive",
    })
    if (!ok) return
    try {
      await api(`/api/v1/calendars/${cal.id}`, { method: "DELETE" })
      toast.success(`'${cal.name}' 캘린더를 삭제했습니다`)
      invalidateApi("/api/v1/calendars")
      invalidateApi("/api/v1/events")
    } catch (e) {
      toast.error(`삭제 실패: ${(e as Error).message}`)
    }
  }

  const personal = calendars.filter((c) => c.scope === "personal")
  const shared = calendars.filter((c) => c.scope === "shared")

  return (
    <>
      <div className="space-y-3" data-testid="calendar-list">
        <div className="flex items-center justify-between px-2">
          <h2 className="text-xs font-semibold tracking-wide text-muted-foreground">캘린더</h2>
          <button
            type="button"
            onClick={() => setOpenNew(true)}
            data-testid="calendar-new-button"
            className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
            title="새 캘린더"
            aria-label="새 캘린더"
          >
            <Plus size={14} />
          </button>
        </div>
        <Section
          title="내 캘린더"
          items={personal}
          onToggle={togglePref}
          onRefresh={refreshIcs}
          onDelete={deleteCalendar}
          onSubscribe={setSubscribingCal}
        />
        <Section
          title="워크스페이스"
          items={shared}
          onToggle={togglePref}
          onRefresh={refreshIcs}
          onDelete={deleteCalendar}
          onSubscribe={setSubscribingCal}
        />
        {calendars.length === 0 && (
          <p className="px-2 py-4 text-center text-xs text-muted-foreground">캘린더가 없습니다.</p>
        )}
      </div>

      <CreateCalendarDialog open={openNew} onOpenChange={setOpenNew} />

      {subscribingCal && (
        <SubscriptionModal
          calendar={subscribingCal}
          onClose={() => setSubscribingCal(null)}
        />
      )}
    </>
  )
}

function Section({
  title,
  items,
  onToggle,
  onRefresh,
  onDelete,
  onSubscribe,
}: {
  title: string
  items: CalendarResponse[]
  onToggle: (cal: CalendarResponse) => void
  onRefresh: (cal: CalendarResponse) => void
  onDelete: (cal: CalendarResponse) => void
  onSubscribe: (cal: CalendarResponse) => void
}) {
  const { toast } = useToast()
  if (items.length === 0) return null
  return (
    <div className="space-y-1">
      <p className="px-2 pb-0.5 text-[11px] text-muted-foreground">{title}</p>
      {items.map((c) => {
        const isIcs = c.source === "external_ics"
        return (
          <div
            key={c.id}
            data-testid={`calendar-sidebar-checkbox-${c.id}`}
            className="group flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm hover:bg-muted"
          >
            <label className="flex flex-1 cursor-pointer items-center gap-2 truncate">
              <input
                type="checkbox"
                checked={!c.hidden}
                onChange={() => onToggle(c)}
                data-testid={`calendar-sidebar-toggle-${c.id}`}
                className="size-3.5 shrink-0 cursor-pointer rounded"
                style={{ accentColor: c.color_override ?? c.color }}
              />
              <span className={c.hidden ? "truncate text-muted-foreground" : "truncate"}>{c.name}</span>
              {isIcs && (
                <Rss
                  size={11}
                  className="shrink-0 text-muted-foreground"
                  aria-label="외부 ICS"
                />
              )}
            </label>
            {isIcs && (
              <button
                onClick={() => onRefresh(c)}
                data-testid={`calendar-sidebar-refresh-${c.id}`}
                title={
                  c.external_ics_refresh_at
                    ? `마지막 동기화: ${formatDateTime(c.external_ics_refresh_at)}`
                    : "동기화"
                }
                className="rounded p-0.5 text-muted-foreground opacity-0 transition-opacity hover:bg-background hover:text-foreground group-hover:opacity-100 focus-visible:opacity-100"
              >
                <RefreshCw size={12} />
              </button>
            )}
            <button
              type="button"
              onClick={async () => {
                try {
                  await apiDownload(
                    `/api/v1/calendars/${c.id}/ics`,
                    `${c.name || "calendar"}.ics`,
                  )
                } catch (e) {
                  toast.error(`다운로드 실패: ${(e as Error).message}`)
                }
              }}
              data-testid={`calendar-sidebar-export-${c.id}`}
              title=".ics 일괄 다운로드"
              className="rounded p-0.5 text-muted-foreground opacity-0 transition-opacity hover:bg-background hover:text-foreground group-hover:opacity-100 focus-visible:opacity-100"
            >
              <Download size={12} />
            </button>
            {!isIcs && (
              <button
                onClick={() => onSubscribe(c)}
                data-testid={`calendar-sidebar-subscribe-${c.id}`}
                title="외부 캘린더 구독"
                className="rounded p-0.5 text-muted-foreground opacity-0 transition-opacity hover:bg-background hover:text-foreground group-hover:opacity-100 focus-visible:opacity-100"
              >
                <Rss size={12} />
              </button>
            )}
            {/* 관리형(공휴일)은 삭제 불가: 숨김 토글만 제공 */}
            {!c.managed && (
              <button
                onClick={() => onDelete(c)}
                data-testid={`calendar-sidebar-delete-${c.id}`}
                title="캘린더 삭제"
                className="rounded p-0.5 text-muted-foreground opacity-0 transition-opacity hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100 focus-visible:opacity-100"
              >
                <Trash2 size={12} />
              </button>
            )}
          </div>
        )
      })}
    </div>
  )
}
