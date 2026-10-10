"use client"

// 안 B: 캘린더 설정 모달에 탭 두 개(일반, 구독). 구독 탭은 큰 상태 띠와 앱별 바로 열기,
// 위험한 동작은 대화상자 대신 버튼 자리에서 한 번 더 확인.

import { useState } from "react"
import { Check, Copy, Download, RefreshCw, Rss, Trash2, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { useToast } from "@/components/ui-custom/use-toast"
import { cn } from "@/lib/utils"

import { CALENDAR_COLORS, Switch, feedUrl, fetchedLabel, useCalendarsState, useCopied, webcalUrl } from "./shared"

type Tab = "general" | "feed"
type Pending = "rotate" | "off" | "delete" | null

export function VariantB() {
  const s = useCalendarsState()
  const { toast } = useToast()
  const { copied, copy } = useCopied()
  const cal = s.get("c-me")
  const [tab, setTab] = useState<Tab>("feed")
  const [pending, setPending] = useState<Pending>(null)
  const on = cal.feed.enabled
  const url = feedUrl(cal.feed.token)

  const apps = [
    { key: "apple", label: "Apple 캘린더", href: webcalUrl(cal.feed.token) },
    { key: "google", label: "Google 캘린더", href: `https://calendar.google.com/calendar/r?cid=${encodeURIComponent(webcalUrl(cal.feed.token))}` },
    { key: "outlook", label: "Outlook", href: `https://outlook.live.com/calendar/0/addfromweb?url=${encodeURIComponent(url)}` },
  ]

  return (
    <div className="w-full max-w-[480px] overflow-hidden rounded-2xl border bg-background shadow-2xl" data-testid="pg-calendar-share-b">
      <header className="flex items-center gap-2.5 px-5 pt-5">
        <span className="size-3 rounded-full" style={{ backgroundColor: cal.color }} />
        <h2 className="flex-1 truncate font-semibold">{cal.name}</h2>
        <button
          type="button"
          onClick={() => toast.info("닫기")}
          data-testid="pg-calendar-share-b-close"
          aria-label="닫기"
          className="-mr-1.5 grid size-8 place-items-center rounded-md text-muted-foreground hover:bg-muted"
        >
          <X size={16} />
        </button>
      </header>

      <div role="tablist" className="mt-3 flex gap-5 border-b px-5">
        {(
          [
            ["general", "일반"],
            ["feed", "구독 주소"],
          ] as const
        ).map(([k, label]) => (
          <button
            key={k}
            type="button"
            role="tab"
            aria-selected={tab === k}
            onClick={() => {
              setTab(k)
              setPending(null)
            }}
            data-testid={`pg-calendar-share-b-tab-${k}`}
            className={cn(
              "-mb-px inline-flex items-center gap-1.5 border-b-2 pb-2.5 text-sm transition",
              tab === k ? "border-primary font-medium" : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {label}
            {k === "feed" && (
              <span className={cn("size-1.5 rounded-full", on ? "bg-emerald-500 dark:bg-emerald-400" : "bg-muted-foreground/40")} />
            )}
          </button>
        ))}
      </div>

      {tab === "general" ? (
        <div className="space-y-5 p-5">
          <div>
            <div className="mb-2 text-xs font-medium text-muted-foreground">색</div>
            <div className="flex flex-wrap gap-1.5">
              {CALENDAR_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => s.setColor(cal.id, c)}
                  aria-label={c}
                  aria-pressed={cal.color === c}
                  data-testid={`pg-calendar-share-b-color-${c.slice(1)}`}
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
          </div>
          <div className="flex items-center justify-between text-sm">
            <span>사이드바에 표시</span>
            <Switch checked={!cal.hidden} onChange={() => s.toggleHidden(cal.id)} testId="pg-calendar-share-b-visible" label="사이드바에 표시" />
          </div>
          <div className="flex items-center gap-2 border-t pt-4">
            <Button variant="outline" size="sm" onClick={() => s.exportIcs(cal)} data-testid="pg-calendar-share-b-export">
              <Download /> .ics 내보내기
            </Button>
            <span className="flex-1" />
            {pending === "delete" ? (
              <>
                <Button variant="ghost" size="sm" onClick={() => setPending(null)} data-testid="pg-calendar-share-b-delete-cancel">
                  취소
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => {
                    s.remove(cal)
                    setPending(null)
                  }}
                  data-testid="pg-calendar-share-b-delete-confirm"
                >
                  일정까지 삭제
                </Button>
              </>
            ) : (
              <Button variant="ghost" size="sm" onClick={() => setPending("delete")} data-testid="pg-calendar-share-b-delete">
                <Trash2 /> 삭제
              </Button>
            )}
          </div>
        </div>
      ) : (
        <div className="p-5">
          <div
            className={cn(
              "flex items-center gap-3 rounded-xl px-4 py-3",
              on ? "bg-emerald-50 dark:bg-emerald-950/40" : "bg-muted",
            )}
          >
            <span
              className={cn(
                "grid size-9 place-items-center rounded-full",
                on
                  ? "bg-emerald-600 text-white dark:bg-emerald-500 dark:text-emerald-950"
                  : "bg-background text-muted-foreground",
              )}
            >
              <Rss size={16} />
            </span>
            <div className="min-w-0 flex-1">
              <div className={cn("text-sm font-medium", on && "text-emerald-800 dark:text-emerald-200")}>
                {on ? "공개 중" : "꺼짐"}
              </div>
              <div className="text-xs text-muted-foreground">{on ? fetchedLabel(cal.feed.lastFetchAt) : "주소 없음"}</div>
            </div>
            {on ? (
              pending === "off" ? (
                <div className="flex gap-1">
                  <Button variant="ghost" size="sm" onClick={() => setPending(null)} data-testid="pg-calendar-share-b-off-cancel">
                    취소
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => {
                      s.disable(cal.id)
                      setPending(null)
                    }}
                    data-testid="pg-calendar-share-b-off-confirm"
                  >
                    끄기
                  </Button>
                </div>
              ) : (
                <Button variant="outline" size="sm" onClick={() => setPending("off")} data-testid="pg-calendar-share-b-off">
                  끄기
                </Button>
              )
            ) : (
              <Button size="sm" onClick={() => s.enable(cal.id)} data-testid="pg-calendar-share-b-enable">
                켜기
              </Button>
            )}
          </div>

          {on && (
            <>
              <div className="mt-4 flex items-center gap-2 rounded-lg border bg-muted/40 p-1 pl-3">
                <input
                  readOnly
                  value={url}
                  onFocus={(e) => e.target.select()}
                  data-testid="pg-calendar-share-b-url"
                  className="min-w-0 flex-1 bg-transparent font-mono text-xs outline-none"
                />
                <Button size="sm" variant={copied ? "outline" : "default"} onClick={() => copy(url)} data-testid="pg-calendar-share-b-copy">
                  {copied ? <Check className="text-emerald-600 dark:text-emerald-400" /> : <Copy />}
                  {copied ? "복사됨" : "복사"}
                </Button>
              </div>

              <div className="mt-4 grid grid-cols-3 gap-2">
                {apps.map((a) => (
                  <a
                    key={a.key}
                    href={a.href}
                    onClick={(e) => {
                      e.preventDefault()
                      toast.info(`${a.label}에서 열기`)
                    }}
                    data-testid={`pg-calendar-share-b-open-${a.key}`}
                    className="flex h-10 items-center justify-center rounded-lg border text-xs font-medium hover:bg-muted"
                  >
                    {a.label}
                  </a>
                ))}
              </div>

              <div className="mt-5 flex items-center gap-2 border-t pt-4 text-xs">
                <span className="flex-1 text-amber-700 dark:text-amber-300">주소만 알면 누구나 볼 수 있음</span>
                {pending === "rotate" ? (
                  <>
                    <Button variant="ghost" size="sm" onClick={() => setPending(null)} data-testid="pg-calendar-share-b-rotate-cancel">
                      취소
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => {
                        s.rotate(cal.id)
                        setPending(null)
                      }}
                      data-testid="pg-calendar-share-b-rotate-confirm"
                    >
                      기존 주소 끊고 재발급
                    </Button>
                  </>
                ) : (
                  <Button variant="ghost" size="sm" onClick={() => setPending("rotate")} data-testid="pg-calendar-share-b-rotate">
                    <RefreshCw /> 재발급
                  </Button>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
