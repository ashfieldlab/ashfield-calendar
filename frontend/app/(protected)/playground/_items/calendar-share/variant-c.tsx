"use client"

// 안 C: 사이드바 줄의 ⋯ 메뉴에서 끝낸다. 메뉴에 색, 동기화, 내보내기, 구독 주소(상태 표시), 삭제.
// 구독 주소는 같은 팝오버 안에서 한 단계 들어간다. 공개 중인 캘린더는 사이드바에 아이콘으로 보인다.

import { useEffect, useState } from "react"
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

import { cn } from "@/lib/utils"

import {
  CALENDAR_COLORS,
  Switch,
  feedUrl,
  fetchedLabel,
  shortUrl,
  useCalendarsState,
  useCopied,
  type CalState,
  type CalendarsState,
} from "./shared"

export function VariantC() {
  const s = useCalendarsState()
  const [openId, setOpenId] = useState<string | null>("c-me")
  const [top, setTop] = useState(64)
  const [view, setView] = useState<"menu" | "feed">("menu")

  useEffect(() => {
    if (!openId) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return
      if (view === "feed") setView("menu")
      else setOpenId(null)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [openId, view])

  const open = s.cals.find((c) => c.id === openId)
  const groups: [string, CalState[]][] = [
    ["내 캘린더", s.cals.filter((c) => c.scope === "personal")],
    ["워크스페이스", s.cals.filter((c) => c.scope === "shared")],
  ]

  return (
    <div className="relative flex h-[460px] w-full max-w-[600px] rounded-xl border bg-background shadow-2xl" data-testid="pg-calendar-share-c">
      <aside className="w-64 shrink-0 space-y-3 border-r p-3">
        <div className="flex items-center justify-between px-2">
          <h2 className="text-xs font-semibold text-muted-foreground">캘린더</h2>
          <button
            type="button"
            data-testid="pg-calendar-share-c-new"
            aria-label="새 캘린더"
            className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <Plus size={14} />
          </button>
        </div>
        {groups.map(([title, items]) =>
          items.length === 0 ? null : (
            <div key={title} className="space-y-0.5">
              <p className="px-2 pb-0.5 text-[11px] text-muted-foreground">{title}</p>
              {items.map((c) => {
                const active = c.id === openId
                return (
                  <div
                    key={c.id}
                    className={cn("group flex h-8 items-center gap-2 rounded-md pr-1 pl-2 text-sm", active ? "bg-muted" : "hover:bg-muted")}
                  >
                    <input
                      type="checkbox"
                      checked={!c.hidden}
                      onChange={() => s.toggleHidden(c.id)}
                      data-testid={`pg-calendar-share-c-toggle-${c.id}`}
                      className="size-3.5 shrink-0 cursor-pointer rounded"
                      style={{ accentColor: c.color }}
                    />
                    <span className={cn("flex-1 truncate", c.hidden && "text-muted-foreground")}>{c.name}</span>
                    {c.source === "external_ics" && <Rss size={11} className="shrink-0 text-muted-foreground" aria-label="외부 ICS" />}
                    {c.feed.enabled && (
                      <Radio size={12} className="shrink-0 text-emerald-600 dark:text-emerald-400" aria-label="구독 주소 공개 중" />
                    )}
                    <button
                      type="button"
                      onClick={(e) => {
                        const row = e.currentTarget.parentElement
                        setTop(row ? row.offsetTop : 0)
                        setView("menu")
                        setOpenId(active ? null : c.id)
                      }}
                      data-testid={`pg-calendar-share-c-menu-${c.id}`}
                      aria-label="캘린더 메뉴"
                      aria-expanded={active}
                      className={cn(
                        "grid size-6 place-items-center rounded text-muted-foreground transition hover:bg-background hover:text-foreground",
                        active ? "bg-background text-foreground" : "opacity-0 group-hover:opacity-100 focus-visible:opacity-100",
                      )}
                    >
                      <MoreHorizontal size={14} />
                    </button>
                  </div>
                )
              })}
            </div>
          ),
        )}
      </aside>

      {open && (
        <div
          className="absolute left-[252px] z-10 w-[272px] overflow-hidden rounded-xl border bg-popover text-popover-foreground shadow-xl ring-1 ring-foreground/5"
          style={{ top: Math.max(8, top - 8) }}
          data-testid="pg-calendar-share-c-popover"
        >
          {view === "menu" ? (
            <Menu cal={open} s={s} onFeed={() => setView("feed")} onClosed={() => setOpenId(null)} />
          ) : (
            <FeedPanel cal={open} s={s} onBack={() => setView("menu")} />
          )}
        </div>
      )}
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
}: {
  icon: typeof Rss
  label: string
  onClick: () => void
  testid: string
  right?: React.ReactNode
  danger?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-testid={testid}
      className={cn(
        "flex h-9 w-full items-center gap-2.5 rounded-md px-2.5 text-left text-sm transition",
        danger
          ? "text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/40"
          : "hover:bg-muted",
      )}
    >
      <Icon size={15} className={danger ? "" : "text-muted-foreground"} />
      <span className="flex-1">{label}</span>
      {right}
    </button>
  )
}

function Menu({ cal, s, onFeed, onClosed }: { cal: CalState; s: CalendarsState; onFeed: () => void; onClosed: () => void }) {
  const [confirmDelete, setConfirmDelete] = useState(false)
  const isIcs = cal.source === "external_ics"

  return (
    <div className="p-1.5">
      <div className="grid grid-cols-10 gap-1 px-1.5 pt-1.5 pb-2.5">
        {CALENDAR_COLORS.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => s.setColor(cal.id, c)}
            aria-label={c}
            aria-pressed={cal.color === c}
            data-testid={`pg-calendar-share-c-color-${c.slice(1)}`}
            className={cn(
              "grid aspect-square place-items-center rounded-full transition",
              cal.color === c ? "ring-2 ring-foreground/60 ring-offset-1 ring-offset-popover" : "hover:scale-110",
            )}
            style={{ backgroundColor: c }}
          >
            {cal.color === c && <Check className="size-3 text-white" />}
          </button>
        ))}
      </div>
      <div className="my-1 border-t" />
      {isIcs && <Item icon={RefreshCw} label="지금 동기화" onClick={() => s.refresh(cal)} testid="pg-calendar-share-c-refresh" />}
      <Item icon={Download} label=".ics 내보내기" onClick={() => s.exportIcs(cal)} testid="pg-calendar-share-c-export" />
      {!isIcs && (
        <Item
          icon={Radio}
          label="구독 주소"
          onClick={onFeed}
          testid="pg-calendar-share-c-feed"
          right={
            <span className="flex items-center gap-1">
              <span
                className={cn(
                  "rounded-full px-1.5 py-0.5 text-[11px] font-medium",
                  cal.feed.enabled
                    ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300"
                    : "bg-muted text-muted-foreground",
                )}
              >
                {cal.feed.enabled ? "켜짐" : "꺼짐"}
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
                data-testid="pg-calendar-share-c-delete-cancel"
                className="h-8 flex-1 rounded-md text-sm text-muted-foreground hover:bg-muted"
              >
                취소
              </button>
              <button
                type="button"
                onClick={() => {
                  s.remove(cal)
                  onClosed()
                }}
                data-testid="pg-calendar-share-c-delete-confirm"
                className="h-8 flex-1 rounded-md bg-rose-600 text-sm font-medium text-white hover:bg-rose-700 dark:bg-rose-600 dark:hover:bg-rose-500"
              >
                일정까지 삭제
              </button>
            </div>
          ) : (
            <Item icon={Trash2} label="삭제" onClick={() => setConfirmDelete(true)} testid="pg-calendar-share-c-delete" danger />
          )}
        </>
      )}
    </div>
  )
}

function FeedPanel({ cal, s, onBack }: { cal: CalState; s: CalendarsState; onBack: () => void }) {
  const { copied, copy } = useCopied()
  const [confirm, setConfirm] = useState<"off" | "rotate" | null>(null)
  const on = cal.feed.enabled
  const url = feedUrl(cal.feed.token)

  return (
    <div>
      <header className="flex items-center gap-1.5 border-b px-2 py-2">
        <button
          type="button"
          onClick={onBack}
          data-testid="pg-calendar-share-c-feed-back"
          aria-label="뒤로"
          className="grid size-7 place-items-center rounded-md text-muted-foreground hover:bg-muted"
        >
          <ArrowLeft size={15} />
        </button>
        <span className="flex-1 truncate text-sm font-medium">구독 주소</span>
        <Switch
          checked={on}
          onChange={(v) => (v ? s.enable(cal.id) : setConfirm("off"))}
          testId="pg-calendar-share-c-feed-toggle"
          label="구독 주소"
        />
      </header>

      {confirm ? (
        <div className="space-y-3 p-3">
          <p className="text-sm">{confirm === "off" ? "기존 주소를 끊고 끌까요?" : "기존 주소를 끊고 새로 만들까요?"}</p>
          <div className="flex gap-1.5">
            <button
              type="button"
              onClick={() => setConfirm(null)}
              data-testid="pg-calendar-share-c-feed-confirm-cancel"
              className="h-8 flex-1 rounded-md border text-sm hover:bg-muted"
            >
              취소
            </button>
            <button
              type="button"
              onClick={() => {
                if (confirm === "off") s.disable(cal.id)
                else s.rotate(cal.id)
                setConfirm(null)
              }}
              data-testid="pg-calendar-share-c-feed-confirm-ok"
              className="h-8 flex-1 rounded-md bg-rose-600 text-sm font-medium text-white hover:bg-rose-700 dark:bg-rose-600 dark:hover:bg-rose-500"
            >
              {confirm === "off" ? "끄기" : "재발급"}
            </button>
          </div>
        </div>
      ) : on ? (
        <div className="space-y-2.5 p-3">
          <button
            type="button"
            onClick={() => copy(url)}
            data-testid="pg-calendar-share-c-copy"
            title={url}
            className={cn(
              "flex w-full items-center gap-2 rounded-lg border px-2.5 py-2 text-left transition",
              copied ? "border-emerald-300 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/40" : "bg-muted/40 hover:bg-muted",
            )}
          >
            <span className="min-w-0 flex-1 truncate font-mono text-[11px]">{shortUrl(url)}</span>
            {copied ? (
              <Check size={14} className="shrink-0 text-emerald-600 dark:text-emerald-400" />
            ) : (
              <Copy size={14} className="shrink-0 text-muted-foreground" />
            )}
          </button>
          <div className="flex items-center text-xs text-muted-foreground">
            <span className="flex-1">{fetchedLabel(cal.feed.lastFetchAt)}</span>
            <button
              type="button"
              onClick={() => setConfirm("rotate")}
              data-testid="pg-calendar-share-c-rotate"
              className="inline-flex h-7 items-center gap-1 rounded-md px-2 hover:bg-muted hover:text-foreground"
            >
              <RefreshCw size={12} /> 재발급
            </button>
          </div>
        </div>
      ) : (
        <div className="px-3 py-6 text-center text-sm text-muted-foreground">꺼짐</div>
      )}
    </div>
  )
}
