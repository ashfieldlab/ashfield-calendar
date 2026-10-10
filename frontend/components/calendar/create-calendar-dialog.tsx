"use client"

import { useState } from "react"
import { CalendarPlus, Check, Link2, Upload } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { useToast } from "@/components/ui-custom/use-toast"
import { api } from "@/lib/api-client"
import { invalidateApi } from "@/lib/hooks/use-api"
import type { CalendarResponse } from "@/lib/types/api"
import { cn } from "@/lib/utils"

type Scope = "personal" | "shared"
type Source = "native" | "url" | "file"

export const CALENDAR_COLORS = [
  "#3f4a3c",
  "#4f46e5",
  "#2563eb",
  "#0891b2",
  "#059669",
  "#65a30d",
  "#d97706",
  "#dc2626",
  "#db2777",
  "#7c3aed",
]

const SCOPES: { key: Scope; label: string }[] = [
  { key: "personal", label: "내 캘린더" },
  { key: "shared", label: "워크스페이스" },
]

const SOURCES: { key: Source; label: string; icon: typeof CalendarPlus }[] = [
  { key: "native", label: "빈 캘린더", icon: CalendarPlus },
  { key: "url", label: "URL 구독", icon: Link2 },
  { key: "file", label: "파일 가져오기", icon: Upload },
]

const inputClass =
  "h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none transition focus:border-ring focus:ring-3 focus:ring-ring/20"

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
}

/** 새 캘린더 모달. 열 때마다 입력값이 초기화되도록 부모가 open 에 맞춰 마운트한다. */
export function CreateCalendarDialog({ open, onOpenChange }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" data-testid="calendar-new-modal">
        {open && <CreateCalendarForm onDone={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  )
}

function CreateCalendarForm({ onDone }: { onDone: () => void }) {
  const { toast } = useToast()
  const [name, setName] = useState("")
  const [scope, setScope] = useState<Scope>("personal")
  const [color, setColor] = useState(CALENDAR_COLORS[1])
  const [source, setSource] = useState<Source>("native")
  const [icsUrl, setIcsUrl] = useState("")
  const [icsFile, setIcsFile] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)

  const trimmed = name.trim()
  const ready =
    !!trimmed && (source !== "url" || !!icsUrl.trim()) && (source !== "file" || !!icsFile)

  async function create() {
    if (!ready || busy) return
    setBusy(true)
    try {
      const cal = await api<CalendarResponse>("/api/v1/calendars", {
        method: "POST",
        body: {
          name: trimmed,
          scope,
          color,
          external_ics_url: source === "url" ? icsUrl.trim() : null,
        },
      })
      if (source === "file" && icsFile) {
        const imported = await importIcs(cal.id, icsFile)
        toast.success(`'${trimmed}' 캘린더를 만들었습니다 (일정 ${imported}개 가져옴)`)
      } else {
        toast.success(`'${trimmed}' 캘린더를 만들었습니다`)
      }
      invalidateApi("/api/v1/calendars")
      invalidateApi("/api/v1/events")
      onDone()
    } catch (e) {
      toast.error(`생성 실패: ${(e as Error).message}`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>새 캘린더</DialogTitle>
      </DialogHeader>

      <form
        id="calendar-new-form"
        className="space-y-5"
        onSubmit={(e) => {
          e.preventDefault()
          void create()
        }}
      >
        <div className="flex items-center gap-2">
          <Popover>
            <PopoverTrigger asChild>
              <button
                type="button"
                className="grid size-10 shrink-0 place-items-center rounded-lg border border-input transition hover:bg-muted"
                aria-label="색"
                data-testid="calendar-new-color-button"
              >
                <span className="size-4 rounded-full" style={{ backgroundColor: color }} />
              </button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-auto p-3">
              <div className="grid grid-cols-5 gap-1.5">
                {CALENDAR_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColor(c)}
                    aria-label={c}
                    aria-pressed={color === c}
                    data-testid={`calendar-new-color-${c.slice(1)}`}
                    className={cn(
                      "grid size-7 place-items-center rounded-full ring-offset-2 ring-offset-background transition",
                      color === c ? "ring-2 ring-foreground/70" : "hover:scale-110",
                    )}
                    style={{ backgroundColor: c }}
                  >
                    {color === c && <Check className="size-3.5 text-white" />}
                  </button>
                ))}
              </div>
            </PopoverContent>
          </Popover>
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="캘린더 이름"
            className={inputClass}
            data-testid="calendar-new-name-input"
          />
        </div>

        <div role="radiogroup" aria-label="범위" className="inline-flex rounded-lg bg-muted p-0.5 text-sm">
          {SCOPES.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              role="radio"
              aria-checked={scope === key}
              onClick={() => setScope(key)}
              data-testid={`calendar-new-scope-${key}`}
              className={cn(
                "rounded-md px-3 py-1.5 font-medium transition",
                scope === key
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {label}
            </button>
          ))}
        </div>

        <div role="radiogroup" aria-label="가져오기" className="grid grid-cols-3 gap-2">
          {SOURCES.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              type="button"
              role="radio"
              aria-checked={source === key}
              onClick={() => setSource(key)}
              data-testid={`calendar-new-source-${key}`}
              className={cn(
                "flex flex-col items-center gap-2 rounded-xl border px-2 py-3.5 text-xs font-medium transition",
                source === key
                  ? "border-primary bg-primary/5 text-foreground"
                  : "border-input text-muted-foreground hover:bg-muted/60",
              )}
            >
              <Icon className={cn("size-5", source === key && "text-primary")} />
              {label}
            </button>
          ))}
        </div>

        {source === "url" && (
          <input
            type="url"
            value={icsUrl}
            onChange={(e) => setIcsUrl(e.target.value)}
            placeholder="https://example.com/holidays.ics"
            className={cn(inputClass, "font-mono text-xs")}
            data-testid="calendar-new-ics-url-input"
          />
        )}
        {source === "file" && (
          <label className="flex h-20 cursor-pointer items-center justify-center rounded-xl border border-dashed border-input px-3 text-sm text-muted-foreground transition hover:bg-muted/50">
            <input
              type="file"
              accept=".ics,text/calendar"
              className="sr-only"
              onChange={(e) => setIcsFile(e.target.files?.[0] ?? null)}
              data-testid="calendar-new-ics-file-input"
            />
            <span className="truncate">{icsFile?.name ?? ".ics 파일 선택"}</span>
          </label>
        )}
      </form>

      <DialogFooter>
        <Button variant="ghost" type="button" onClick={onDone} data-testid="calendar-new-cancel">
          취소
        </Button>
        <Button type="submit" form="calendar-new-form" disabled={!ready || busy} data-testid="calendar-new-confirm">
          만들기
        </Button>
      </DialogFooter>
    </>
  )
}

/** multipart 업로드는 api-client 를 거치지 않으므로 타임아웃을 직접 건다. */
async function importIcs(calendarId: string, file: File): Promise<number> {
  const form = new FormData()
  form.append("file", file)
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 120_000)
  try {
    const res = await fetch(`/api/v1/calendars/${calendarId}/import-ics`, {
      method: "POST",
      body: form,
      signal: controller.signal,
    })
    if (!res.ok) throw new Error(`ICS 가져오기 실패 (${res.status})`)
    const { imported } = (await res.json()) as { imported: number }
    return imported
  } finally {
    clearTimeout(timer)
  }
}
