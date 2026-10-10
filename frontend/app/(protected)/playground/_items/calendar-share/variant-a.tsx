"use client"

// 안 A: Drive 공유 링크 카드를 옮긴 2단. 오른쪽 스위치 하나로 켜짐/꺼짐이 바로 보이고, 왼쪽은 캘린더 설정.

import { useState } from "react"
import { Check, Copy, Download, Link2, Link2Off, RefreshCw, Rss, Trash2, X } from "lucide-react"

import { useConfirm } from "@/components/ui-custom/use-confirm"
import { useToast } from "@/components/ui-custom/use-toast"
import { cn } from "@/lib/utils"

import {
  CALENDAR_COLORS,
  QrPattern,
  Switch,
  feedUrl,
  fetchedLabel,
  shortUrl,
  useCalendarsState,
  useCopied,
} from "./shared"

export function VariantA() {
  const s = useCalendarsState()
  const confirm = useConfirm()
  const { toast } = useToast()
  const { copied, copy } = useCopied()
  const cal = s.get("c-me")
  const [name, setName] = useState(cal.name)
  const on = cal.feed.enabled
  const url = feedUrl(cal.feed.token)

  async function turnOff() {
    const ok = await confirm({
      title: "구독 주소 끄기",
      description: "기존 주소가 즉시 무효화됩니다.",
      confirmText: "끄기",
      variant: "destructive",
    })
    if (ok) s.disable(cal.id)
  }

  async function rotate() {
    const ok = await confirm({
      title: "주소 재발급",
      description: "기존 주소로 구독한 앱은 다시 등록해야 합니다.",
      confirmText: "재발급",
    })
    if (ok) s.rotate(cal.id)
  }

  return (
    <div
      className="flex w-full max-w-[680px] flex-col overflow-hidden rounded-xl border bg-background shadow-2xl md:flex-row"
      data-testid="pg-calendar-share-a"
    >
      <section className="flex min-w-0 flex-1 flex-col p-5">
        <div className="flex items-center gap-2.5">
          <span className="size-3.5 shrink-0 rounded-full" style={{ backgroundColor: cal.color }} />
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={() => name.trim() && name !== cal.name && s.rename(cal.id, name.trim())}
            data-testid="pg-calendar-share-a-name"
            className="h-9 min-w-0 flex-1 rounded-md bg-transparent px-1.5 text-base font-semibold outline-none hover:bg-muted/60 focus:bg-muted/60"
          />
        </div>

        <div className="mt-5 grid grid-cols-5 gap-2 self-start">
          {CALENDAR_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => s.setColor(cal.id, c)}
              aria-label={c}
              aria-pressed={cal.color === c}
              data-testid={`pg-calendar-share-a-color-${c.slice(1)}`}
              className={cn(
                "grid size-7 place-items-center rounded-full ring-offset-2 ring-offset-background transition",
                cal.color === c ? "ring-2 ring-foreground/70" : "hover:scale-110",
              )}
              style={{ backgroundColor: c }}
            >
              {cal.color === c && <Check className="size-3.5 text-white" />}
            </button>
          ))}
        </div>

        <div className="mt-6 divide-y rounded-lg border text-sm">
          <div className="flex h-11 items-center justify-between px-3">
            <span>사이드바에 표시</span>
            <Switch
              checked={!cal.hidden}
              onChange={() => s.toggleHidden(cal.id)}
              testId="pg-calendar-share-a-visible"
              label="사이드바에 표시"
            />
          </div>
          <button
            type="button"
            onClick={() => s.exportIcs(cal)}
            data-testid="pg-calendar-share-a-export"
            className="flex h-11 w-full items-center justify-between px-3 text-left hover:bg-muted/50"
          >
            <span>.ics 내보내기</span>
            <Download size={15} className="text-muted-foreground" />
          </button>
        </div>

        <button
          type="button"
          onClick={async () => {
            const ok = await confirm({
              title: "캘린더 삭제",
              description: `'${cal.name}' 안의 일정도 함께 삭제됩니다.`,
              confirmText: "삭제",
              variant: "destructive",
            })
            if (ok) s.remove(cal)
          }}
          data-testid="pg-calendar-share-a-delete"
          className="mt-auto inline-flex items-center gap-1.5 self-start rounded-md px-2 pt-6 pb-1 text-xs text-muted-foreground hover:text-rose-600 dark:hover:text-rose-400"
        >
          <Trash2 size={13} /> 캘린더 삭제
        </button>
      </section>

      <section className="flex shrink-0 flex-col border-t bg-muted/40 md:w-[272px] md:border-t-0 md:border-l">
        <header className="flex items-center gap-2 px-4 pt-4 pb-3">
          <Rss size={16} className="text-muted-foreground" />
          <h3 className="flex-1 text-sm font-medium">구독 주소</h3>
          <Switch
            checked={on}
            onChange={(v) => (v ? s.enable(cal.id) : void turnOff())}
            testId="pg-calendar-share-a-feed-toggle"
            label="구독 주소"
          />
          <button
            type="button"
            onClick={() => toast.info("닫기")}
            data-testid="pg-calendar-share-a-close"
            aria-label="닫기"
            className="-mr-1 ml-1 grid size-7 place-items-center rounded-md text-muted-foreground hover:bg-background hover:text-foreground"
          >
            <X size={16} />
          </button>
        </header>

        {on ? (
          <div className="flex flex-1 flex-col px-4 pb-4">
            <div className="rounded-lg border bg-background p-3">
              <div className="mx-auto w-fit rounded-md p-1">
                <QrPattern seed={cal.feed.token} size={108} />
              </div>
              <div className="mt-2 truncate text-center font-mono text-[11px] text-muted-foreground" title={url}>
                {shortUrl(url)}
              </div>
              <button
                type="button"
                onClick={() => copy(url)}
                data-testid="pg-calendar-share-a-copy"
                className={cn(
                  "mt-2 inline-flex h-8 w-full items-center justify-center gap-1.5 rounded-md text-sm font-medium transition-colors",
                  copied ? "bg-emerald-600 text-white dark:bg-emerald-600" : "bg-primary text-primary-foreground hover:bg-primary/90",
                )}
              >
                {copied ? <Check size={15} /> : <Copy size={14} />}
                {copied ? "복사됨" : "주소 복사"}
              </button>
            </div>
            <p className="mt-3 text-xs text-amber-700 dark:text-amber-300">주소만 알면 누구나 볼 수 있음</p>
            <div className="mt-auto flex items-center gap-2 pt-4 text-xs text-muted-foreground">
              <span className="flex-1" data-testid="pg-calendar-share-a-fetched">
                {fetchedLabel(cal.feed.lastFetchAt)}
              </span>
              <button
                type="button"
                onClick={() => void rotate()}
                data-testid="pg-calendar-share-a-rotate"
                className="inline-flex h-7 items-center gap-1 rounded-md px-2 hover:bg-background hover:text-foreground"
              >
                <RefreshCw size={12} />
                재발급
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 py-10">
            <span className="grid size-12 place-items-center rounded-full bg-background text-muted-foreground ring-1 ring-border">
              <Link2Off size={20} />
            </span>
            <span className="text-sm text-muted-foreground">주소 없음</span>
            <button
              type="button"
              onClick={() => s.enable(cal.id)}
              data-testid="pg-calendar-share-a-enable"
              className="inline-flex h-8 items-center gap-1.5 rounded-md border bg-background px-3 text-sm font-medium hover:bg-muted"
            >
              <Link2 size={14} />
              주소 만들기
            </button>
          </div>
        )}
      </section>
    </div>
  )
}
