"use client"

import { useState } from "react"
import { CalendarPlus, Check, Link2, Upload, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { useToast } from "@/components/ui-custom/use-toast"
import { api, apiUploadFile } from "@/lib/api-client"
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
      <DialogContent
        className="gap-0 overflow-hidden p-0 sm:max-w-[440px]"
        showCloseButton={false}
        data-testid="calendar-new-modal"
      >
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
        const { imported } = await apiUploadFile<{ imported: number }>(
          `/api/v1/calendars/${cal.id}/import-ics`,
          icsFile,
        )
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
    <form
      id="calendar-new-form"
      onSubmit={(e) => {
        e.preventDefault()
        void create()
      }}
    >
      <div className="h-1.5 transition-colors" style={{ backgroundColor: color }} />
      <header className="flex items-center px-5 pt-4">
        <DialogTitle className="flex-1 text-base font-semibold">새 캘린더</DialogTitle>
        <button
          type="button"
          onClick={onDone}
          data-testid="calendar-new-close"
          aria-label="닫기"
          className="-mr-1.5 grid size-8 place-items-center rounded-md text-muted-foreground hover:bg-muted"
        >
          <X size={16} />
        </button>
      </header>

      <div role="tablist" aria-label="가져오기" className="mx-5 mt-4 grid grid-cols-3 rounded-lg bg-muted p-0.5">
        {SOURCES.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={source === key}
            onClick={() => setSource(key)}
            data-testid={`calendar-new-source-${key}`}
            className={cn(
              "inline-flex h-8 items-center justify-center gap-1.5 rounded-md text-xs font-medium transition",
              source === key ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon size={14} />
            {label}
          </button>
        ))}
      </div>

      <div className="space-y-4 px-5 pb-2 pt-5">
        {source === "url" && (
          <input
            type="url"
            autoFocus
            value={icsUrl}
            onChange={(e) => setIcsUrl(e.target.value)}
            placeholder="https://example.com/holidays.ics"
            className={cn(inputClass, "font-mono text-xs")}
            data-testid="calendar-new-ics-url-input"
          />
        )}
        {source === "file" && <FileDrop file={icsFile} onPick={setIcsFile} />}

        <div className="flex items-center gap-2.5">
          <span className="size-3.5 shrink-0 rounded-full transition-colors" style={{ backgroundColor: color }} />
          <input
            autoFocus={source === "native"}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="캘린더 이름"
            aria-label="캘린더 이름"
            className="h-10 min-w-0 flex-1 border-b border-input bg-transparent text-base font-medium outline-none transition placeholder:font-normal placeholder:text-muted-foreground/70 focus:border-ring"
            data-testid="calendar-new-name-input"
          />
        </div>

        <div role="radiogroup" aria-label="색" className="flex flex-wrap gap-1.5">
          {CALENDAR_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              role="radio"
              aria-checked={color === c}
              aria-label={c}
              onClick={() => setColor(c)}
              data-testid={`calendar-new-color-${c.slice(1)}`}
              className={cn(
                "grid size-6 place-items-center rounded-full ring-offset-2 ring-offset-background transition",
                color === c ? "ring-2 ring-foreground/70" : "hover:scale-110",
              )}
              style={{ backgroundColor: c }}
            >
              {color === c && <Check className="size-3.5 text-white" />}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3 pt-1">
          <span className="text-sm text-muted-foreground">범위</span>
          <div role="radiogroup" aria-label="범위" className="inline-flex rounded-lg border p-0.5 text-sm">
            {SCOPES.map(({ key, label }) => (
              <button
                key={key}
                type="button"
                role="radio"
                aria-checked={scope === key}
                onClick={() => setScope(key)}
                data-testid={`calendar-new-scope-${key}`}
                className={cn(
                  "rounded-md px-3 py-1 transition",
                  scope === key ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <footer className="flex justify-end gap-2 px-5 py-4">
        <Button variant="ghost" type="button" onClick={onDone} data-testid="calendar-new-cancel">
          취소
        </Button>
        <Button type="submit" disabled={!ready || busy} data-testid="calendar-new-confirm">
          만들기
        </Button>
      </footer>
    </form>
  )
}

/** .ics 파일: 눌러서 고르거나 끌어 놓기 */
function FileDrop({ file, onPick }: { file: File | null; onPick: (f: File | null) => void }) {
  const [over, setOver] = useState(false)
  return (
    <label
      onDragOver={(e) => {
        e.preventDefault()
        setOver(true)
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault()
        setOver(false)
        const f = e.dataTransfer.files?.[0]
        if (f) onPick(f)
      }}
      className={cn(
        "flex h-16 cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed px-3 text-sm transition",
        over ? "border-primary bg-primary/5 text-foreground" : "border-input text-muted-foreground hover:bg-muted/50",
      )}
      data-testid="calendar-new-ics-drop"
    >
      <input
        type="file"
        accept=".ics,text/calendar"
        className="sr-only"
        onChange={(e) => onPick(e.target.files?.[0] ?? null)}
        data-testid="calendar-new-ics-file-input"
      />
      <Upload size={16} className="shrink-0" />
      <span className={cn("truncate", file && "font-medium text-foreground")}>{file?.name ?? ".ics 파일"}</span>
    </label>
  )
}
