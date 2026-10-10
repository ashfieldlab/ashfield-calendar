"use client"

import { useEffect, useRef, useState } from "react"
import {
  ArrowLeft,
  Check,
  ChevronRight,
  Copy,
  Download,
  MoreHorizontal,
  Plus,
  Radio,
  RefreshCw,
  Rss,
  Trash2,
} from "lucide-react"

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { useToast } from "@/components/ui-custom/use-toast"
import { useAppContext } from "@/components/providers/app-context"
import { api, apiDownload } from "@/lib/api-client"
import { friendlyError } from "@/lib/errors"
import { invalidateApi, useApiGet } from "@/lib/hooks/use-api"
import type { CalendarResponse } from "@/lib/types/api"
import { cn } from "@/lib/utils"
import { formatDateTime } from "@/lib/utils/format"

import { CALENDAR_COLORS, CreateCalendarDialog } from "./create-calendar-dialog"

interface Props {
  calendars: CalendarResponse[]
}

interface SubscriptionResponse {
  enabled: boolean
  token: string | null
  url: string | null
}

function refreshLists() {
  invalidateApi("/api/v1/calendars")
  invalidateApi("/api/v1/events")
}

/** 캘린더 목록 + 표시 토글 + 줄마다 ⋯ 설정 팝오버. 일정 화면 왼쪽 패널에 들어간다. */
export function CalendarList({ calendars }: Props) {
  const { toast } = useToast()
  const [openNew, setOpenNew] = useState(false)
  const [menuId, setMenuId] = useState<string | null>(null)

  async function togglePref(cal: CalendarResponse) {
    try {
      await api(`/api/v1/calendars/${cal.id}/preferences`, {
        method: "PATCH",
        body: { hidden: !cal.hidden },
      })
      refreshLists()
    } catch (e) {
      toast.error(`설정 변경 실패: ${(e as Error).message}`)
    }
  }

  const groups: [string, CalendarResponse[]][] = [
    ["내 캘린더", calendars.filter((c) => c.scope === "personal")],
    ["워크스페이스", calendars.filter((c) => c.scope === "shared")],
  ]

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
        {groups.map(([title, items]) =>
          items.length === 0 ? null : (
            <div key={title} className="space-y-0.5">
              <p className="px-2 pb-0.5 text-[11px] text-muted-foreground">{title}</p>
              {items.map((c) => (
                <CalendarRow
                  key={c.id}
                  cal={c}
                  open={menuId === c.id}
                  onOpenChange={(o) => setMenuId(o ? c.id : null)}
                  onToggle={() => togglePref(c)}
                />
              ))}
            </div>
          ),
        )}
        {calendars.length === 0 && (
          <p className="px-2 py-4 text-center text-xs text-muted-foreground">캘린더 없음</p>
        )}
      </div>

      <CreateCalendarDialog open={openNew} onOpenChange={setOpenNew} />
    </>
  )
}

function CalendarRow({
  cal,
  open,
  onOpenChange,
  onToggle,
}: {
  cal: CalendarResponse
  open: boolean
  onOpenChange: (open: boolean) => void
  onToggle: () => void
}) {
  const [view, setView] = useState<"menu" | "feed">("menu")
  const color = cal.color_override ?? cal.color

  return (
    <div
      data-testid={`calendar-sidebar-checkbox-${cal.id}`}
      className={cn("group flex h-8 items-center gap-2 rounded-md pl-2 pr-1 text-sm", open ? "bg-muted" : "hover:bg-muted")}
    >
      <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2">
        <input
          type="checkbox"
          checked={!cal.hidden}
          onChange={onToggle}
          data-testid={`calendar-sidebar-toggle-${cal.id}`}
          className="size-3.5 shrink-0 cursor-pointer rounded"
          style={{ accentColor: color }}
        />
        <span className={cn("truncate", cal.hidden && "text-muted-foreground")}>{cal.name}</span>
      </label>
      {cal.source === "external_ics" && (
        <Rss size={11} className="shrink-0 text-muted-foreground" aria-label="외부 ICS" />
      )}
      {cal.subscription_enabled && (
        <Radio
          size={12}
          className="shrink-0 text-emerald-600 dark:text-emerald-400"
          aria-label="구독 주소 공개 중"
          data-testid={`calendar-sidebar-public-${cal.id}`}
        />
      )}
      <Popover
        open={open}
        onOpenChange={(o) => {
          if (o) setView("menu")
          onOpenChange(o)
        }}
      >
        <PopoverTrigger asChild>
          <button
            type="button"
            data-testid={`calendar-sidebar-menu-${cal.id}`}
            aria-label="캘린더 메뉴"
            className={cn(
              "grid size-6 shrink-0 place-items-center rounded text-muted-foreground transition hover:bg-background hover:text-foreground",
              open ? "bg-background text-foreground" : "opacity-0 focus-visible:opacity-100 group-hover:opacity-100 max-md:opacity-100",
            )}
          >
            <MoreHorizontal size={14} />
          </button>
        </PopoverTrigger>
        <PopoverContent
          side="right"
          align="start"
          sideOffset={8}
          className="w-[272px] gap-0 overflow-hidden p-0"
          data-testid="calendar-menu"
          onEscapeKeyDown={(e) => {
            if (view === "feed") {
              e.preventDefault()
              setView("menu")
            }
          }}
        >
          {view === "menu" ? (
            <Menu cal={cal} onFeed={() => setView("feed")} onClosed={() => onOpenChange(false)} />
          ) : (
            <FeedPanel cal={cal} onBack={() => setView("menu")} />
          )}
        </PopoverContent>
      </Popover>
    </div>
  )
}

function Item({
  icon: Icon,
  label,
  onClick,
  testid,
  right,
  danger,
  disabled,
  title,
}: {
  icon: typeof Rss
  label: string
  onClick: () => void
  testid: string
  right?: React.ReactNode
  danger?: boolean
  disabled?: boolean
  title?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      data-testid={testid}
      className={cn(
        "flex h-9 w-full items-center gap-2.5 rounded-md px-2.5 text-left text-sm transition disabled:opacity-50",
        danger ? "text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/40" : "hover:bg-muted",
      )}
    >
      <Icon size={15} className={danger ? "" : "text-muted-foreground"} />
      <span className="flex-1">{label}</span>
      {right}
    </button>
  )
}

function Menu({ cal, onFeed, onClosed }: { cal: CalendarResponse; onFeed: () => void; onClosed: () => void }) {
  const { toast } = useToast()
  const { authUser, isWorkspaceAdmin } = useAppContext()
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [busy, setBusy] = useState(false)
  const isIcs = cal.source === "external_ics"
  const color = cal.color_override ?? cal.color
  // 구독 주소 관리 권한 (ADR-0013): 개인은 소유자, 공유는 워크스페이스 관리자.
  const canFeed = !isIcs && (cal.scope === "personal" ? cal.owner_id === authUser?.id : isWorkspaceAdmin)

  async function setColor(c: string) {
    try {
      await api(`/api/v1/calendars/${cal.id}/preferences`, {
        method: "PATCH",
        body: { color_override: c },
      })
      refreshLists()
    } catch (e) {
      toast.error(`색 변경 실패: ${(e as Error).message}`)
    }
  }

  async function refresh() {
    setBusy(true)
    try {
      await api(`/api/v1/calendars/${cal.id}/refresh`, { method: "POST" })
      toast.success("동기화했습니다")
      refreshLists()
    } catch (e) {
      toast.error(`동기화 실패: ${(e as Error).message}`)
    } finally {
      setBusy(false)
    }
  }

  async function exportIcs() {
    try {
      await apiDownload(`/api/v1/calendars/${cal.id}/ics`, `${cal.name || "calendar"}.ics`)
    } catch (e) {
      toast.error(`다운로드 실패: ${(e as Error).message}`)
    }
  }

  async function remove() {
    setBusy(true)
    try {
      await api(`/api/v1/calendars/${cal.id}`, { method: "DELETE" })
      toast.success(`'${cal.name}' 캘린더를 삭제했습니다`)
      refreshLists()
      onClosed()
    } catch (e) {
      toast.error(`삭제 실패: ${(e as Error).message}`)
      setBusy(false)
    }
  }

  return (
    <div className="p-1.5">
      <div className="grid grid-cols-10 gap-1 px-1.5 pb-2.5 pt-1.5" role="radiogroup" aria-label="색">
        {CALENDAR_COLORS.map((c) => (
          <button
            key={c}
            type="button"
            role="radio"
            onClick={() => setColor(c)}
            aria-label={c}
            aria-checked={color === c}
            data-testid={`calendar-menu-color-${c.slice(1)}`}
            className={cn(
              "grid aspect-square place-items-center rounded-full transition",
              color === c ? "ring-2 ring-foreground/60 ring-offset-1 ring-offset-popover" : "hover:scale-110",
            )}
            style={{ backgroundColor: c }}
          >
            {color === c && <Check className="size-3 text-white" />}
          </button>
        ))}
      </div>
      <div className="my-1 border-t" />
      {isIcs && (
        <Item
          icon={RefreshCw}
          label="지금 동기화"
          onClick={refresh}
          disabled={busy}
          title={cal.external_ics_refresh_at ? `마지막 동기화: ${formatDateTime(cal.external_ics_refresh_at)}` : undefined}
          testid="calendar-menu-refresh"
        />
      )}
      <Item icon={Download} label=".ics 내보내기" onClick={exportIcs} testid="calendar-menu-export" />
      {canFeed && (
        <Item
          icon={Radio}
          label="구독 주소"
          onClick={onFeed}
          testid="calendar-menu-feed"
          right={
            <span className="flex items-center gap-1">
              <span
                className={cn(
                  "rounded-full px-1.5 py-0.5 text-[11px] font-medium",
                  cal.subscription_enabled
                    ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300"
                    : "bg-muted text-muted-foreground",
                )}
              >
                {cal.subscription_enabled ? "켜짐" : "꺼짐"}
              </span>
              <ChevronRight size={14} className="text-muted-foreground" />
            </span>
          }
        />
      )}
      {!cal.managed && (
        <>
          <div className="my-1 border-t" />
          {confirmDelete ? (
            <div className="flex items-center gap-1.5 px-1 py-1">
              <button
                type="button"
                onClick={() => setConfirmDelete(false)}
                disabled={busy}
                data-testid="calendar-menu-delete-cancel"
                className="h-8 flex-1 rounded-md text-sm text-muted-foreground hover:bg-muted"
              >
                취소
              </button>
              <button
                type="button"
                onClick={remove}
                disabled={busy}
                data-testid="calendar-menu-delete-confirm"
                className="h-8 flex-1 rounded-md bg-rose-600 text-sm font-medium text-white hover:bg-rose-700 disabled:opacity-50 dark:bg-rose-600 dark:hover:bg-rose-500"
              >
                일정까지 삭제
              </button>
            </div>
          ) : (
            <Item icon={Trash2} label="삭제" onClick={() => setConfirmDelete(true)} testid="calendar-menu-delete" danger />
          )}
        </>
      )}
    </div>
  )
}

function FeedPanel({ cal, onBack }: { cal: CalendarResponse; onBack: () => void }) {
  const { toast } = useToast()
  const path = `/api/v1/calendars/${encodeURIComponent(cal.id)}/subscription`
  const { data, mutate } = useApiGet<SubscriptionResponse>(path)
  const [confirm, setConfirm] = useState<"off" | "rotate" | null>(null)
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current)
    },
    [],
  )
  const on = data?.enabled ?? !!cal.subscription_enabled

  async function run(method: "POST" | "DELETE", url: string, msg: string) {
    setBusy(true)
    try {
      await api(url, { method })
      await mutate()
      invalidateApi("/api/v1/calendars")
      toast.success(msg)
    } catch (e) {
      toast.error(friendlyError(e))
    } finally {
      setBusy(false)
      setConfirm(null)
    }
  }

  async function copy() {
    if (!data?.url) return
    try {
      await navigator.clipboard.writeText(data.url)
      setCopied(true)
      if (timer.current) clearTimeout(timer.current)
      timer.current = setTimeout(() => setCopied(false), 1600)
    } catch {
      toast.error("복사하지 못했습니다")
    }
  }

  return (
    <div data-testid="calendar-feed">
      <header className="flex items-center gap-1.5 border-b px-2 py-2">
        <button
          type="button"
          onClick={onBack}
          data-testid="calendar-feed-back"
          aria-label="뒤로"
          className="grid size-7 place-items-center rounded-md text-muted-foreground hover:bg-muted"
        >
          <ArrowLeft size={15} />
        </button>
        <span className="flex-1 truncate text-sm font-medium">구독 주소</span>
        <button
          type="button"
          role="switch"
          aria-checked={on}
          aria-label="구독 주소"
          disabled={busy || !data}
          onClick={() => (on ? setConfirm("off") : void run("POST", path, "구독 주소를 켰습니다"))}
          data-testid="calendar-feed-toggle"
          className={cn(
            "relative inline-flex h-5 w-9 shrink-0 items-center rounded-full outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/30 disabled:opacity-50",
            on ? "bg-primary" : "bg-input dark:bg-input/80",
          )}
        >
          <span
            className={cn(
              "inline-block size-4 rounded-full bg-background shadow-sm transition-transform",
              on ? "translate-x-[18px]" : "translate-x-0.5",
            )}
          />
        </button>
      </header>

      {confirm ? (
        <div className="space-y-3 p-3">
          <p className="text-sm">{confirm === "off" ? "기존 주소를 끊고 끌까요?" : "기존 주소를 끊고 새로 만들까요?"}</p>
          <div className="flex gap-1.5">
            <button
              type="button"
              onClick={() => setConfirm(null)}
              disabled={busy}
              data-testid="calendar-feed-confirm-cancel"
              className="h-8 flex-1 rounded-md border text-sm hover:bg-muted"
            >
              취소
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() =>
                confirm === "off"
                  ? run("DELETE", path, "구독 주소를 껐습니다")
                  : run("POST", `${path}/rotate`, "새 주소로 바꿨습니다")
              }
              data-testid="calendar-feed-confirm-ok"
              className="h-8 flex-1 rounded-md bg-rose-600 text-sm font-medium text-white hover:bg-rose-700 disabled:opacity-50 dark:bg-rose-600 dark:hover:bg-rose-500"
            >
              {confirm === "off" ? "끄기" : "재발급"}
            </button>
          </div>
        </div>
      ) : on && data?.url ? (
        <div className="space-y-2.5 p-3">
          <button
            type="button"
            onClick={copy}
            data-testid="calendar-feed-copy"
            title={data.url}
            className={cn(
              "flex w-full items-center gap-2 rounded-lg border px-2.5 py-2 text-left transition",
              copied
                ? "border-emerald-300 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/40"
                : "bg-muted/40 hover:bg-muted",
            )}
          >
            <span className="min-w-0 flex-1 truncate font-mono text-[11px]" data-testid="calendar-feed-url">
              {data.url.replace(/^https?:\/\//, "")}
            </span>
            {copied ? (
              <Check size={14} className="shrink-0 text-emerald-600 dark:text-emerald-400" />
            ) : (
              <Copy size={14} className="shrink-0 text-muted-foreground" />
            )}
          </button>
          <div className="flex justify-end text-xs text-muted-foreground">
            <button
              type="button"
              onClick={() => setConfirm("rotate")}
              data-testid="calendar-feed-rotate"
              className="inline-flex h-7 items-center gap-1 rounded-md px-2 hover:bg-muted hover:text-foreground"
            >
              <RefreshCw size={12} /> 재발급
            </button>
          </div>
        </div>
      ) : (
        <div className="px-3 py-6 text-center text-sm text-muted-foreground">{data ? "꺼짐" : "불러오는 중"}</div>
      )}
    </div>
  )
}
