"use client"

import { useState } from "react"
import { ChevronDown, Download, Plus, RefreshCw, Rss, Trash2 } from "lucide-react"

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
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

/**
 * 메인 toolbar 우측의 "캘린더 ▾" 트리거 → popover 안에 캘린더 목록 + 추가/관리.
 * 기존 sidebar 의 캘린더 영역 대체.
 */
export function CalendarsPopover({ calendars }: Props) {
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
  const visibleCount = calendars.filter((c) => !c.hidden).length

  return (
    <>
      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            data-testid="calendars-popover-trigger"
            className="inline-flex items-center gap-1.5 rounded border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            캘린더 ({visibleCount})
            <ChevronDown size={14} />
          </button>
        </PopoverTrigger>
        <PopoverContent
          align="end"
          className="max-h-[var(--radix-popover-content-available-height)] w-72 overflow-y-auto p-3"
          data-testid="calendars-popover-content"
        >
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
              캘린더
            </h2>
            <button
              onClick={() => setOpenNew(true)}
              data-testid="calendar-new-button"
              className="rounded p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-900"
              title="새 캘린더"
            >
              <Plus size={14} />
            </button>
          </div>
          <div className="space-y-3">
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
              <p className="px-2 py-4 text-center text-xs text-gray-500">
                캘린더가 없습니다.
              </p>
            )}
          </div>
        </PopoverContent>
      </Popover>

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
      <p className="text-xs font-medium text-gray-500">{title}</p>
      {items.map((c) => {
        const isIcs = c.source === "external_ics"
        return (
          <div
            key={c.id}
            data-testid={`calendar-sidebar-checkbox-${c.id}`}
            className="group flex items-center gap-1.5 rounded px-2 py-1 text-sm hover:bg-gray-50"
          >
            <label className="flex flex-1 cursor-pointer items-center gap-2 truncate">
              <input
                type="checkbox"
                checked={!c.hidden}
                onChange={() => onToggle(c)}
                data-testid={`calendar-sidebar-toggle-${c.id}`}
                className="rounded border-gray-300"
              />
              <span
                className="h-3 w-3 shrink-0 rounded-sm"
                style={{ backgroundColor: c.color_override ?? c.color }}
              />
              <span className="truncate text-gray-700">{c.name}</span>
              {isIcs && (
                <Rss
                  size={11}
                  className="shrink-0 text-gray-400"
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
                className="rounded p-0.5 text-gray-400 opacity-0 transition-opacity hover:bg-gray-200 hover:text-gray-700 group-hover:opacity-100"
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
              className="rounded p-0.5 text-gray-400 opacity-0 transition-opacity hover:bg-gray-200 hover:text-gray-700 group-hover:opacity-100"
            >
              <Download size={12} />
            </button>
            {!isIcs && (
              <button
                onClick={() => onSubscribe(c)}
                data-testid={`calendar-sidebar-subscribe-${c.id}`}
                title="외부 캘린더 구독"
                className="rounded p-0.5 text-gray-400 opacity-0 transition-opacity hover:bg-gray-200 hover:text-gray-700 group-hover:opacity-100"
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
                className="rounded p-0.5 text-gray-400 opacity-0 transition-opacity hover:bg-rose-50 hover:text-rose-600 group-hover:opacity-100"
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
