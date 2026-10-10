"use client"

// 플레이그라운드: 새 캘린더 모달 안 비교. 만들지 않고 toast 로만 알린다.

import { useState } from "react"
import { CalendarPlus, Check, Link2, Upload, type LucideIcon } from "lucide-react"

import { CALENDAR_COLORS } from "@/components/calendar/create-calendar-dialog"
import { useToast } from "@/components/ui-custom/use-toast"
import { cn } from "@/lib/utils"

export { CALENDAR_COLORS }

export type Scope = "personal" | "shared"
export type Source = "native" | "url" | "file"

export const SCOPE_LABEL: Record<Scope, string> = { personal: "내 캘린더", shared: "워크스페이스" }

export const SOURCES: { key: Source; label: string; icon: LucideIcon }[] = [
  { key: "native", label: "빈 캘린더", icon: CalendarPlus },
  { key: "url", label: "URL 구독", icon: Link2 },
  { key: "file", label: "파일 가져오기", icon: Upload },
]

export interface Draft {
  name: string
  color: string
  scope: Scope
  source: Source
  url: string
  fileName: string
}

export function useDraft(initial?: Partial<Draft>) {
  const { toast } = useToast()
  const [d, setD] = useState<Draft>({
    name: "",
    color: CALENDAR_COLORS[1],
    scope: "personal",
    source: "native",
    url: "",
    fileName: "",
    ...initial,
  })
  const set = (p: Partial<Draft>) => setD((x) => ({ ...x, ...p }))
  const ready =
    !!d.name.trim() && (d.source !== "url" || !!d.url.trim()) && (d.source !== "file" || !!d.fileName)

  function submit() {
    if (!ready) return
    const extra = d.source === "file" ? " (일정 24개 가져옴)" : ""
    toast.success(`'${d.name.trim()}' 캘린더를 만들었습니다${extra}`)
  }
  const cancel = () => toast.info("취소")

  return { d, set, ready, submit, cancel }
}

/** 주소나 파일 이름에서 캘린더 이름 후보를 뽑는다: .../kr-holidays.ics → kr holidays */
export function nameFrom(pathish: string) {
  const last = pathish.trim().split(/[/\\?#]/).filter(Boolean).pop() ?? ""
  return decodeURIComponent(last).replace(/\.ics$/i, "").replace(/[-_]+/g, " ").trim()
}

export const SAMPLE_URL = "https://calendar.example.com/kr-holidays.ics"

export const inputClass =
  "h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none transition focus:border-ring focus:ring-3 focus:ring-ring/20"

export function Swatches({
  value,
  onChange,
  testid,
  size = "md",
}: {
  value: string
  onChange: (c: string) => void
  testid: string
  size?: "sm" | "md"
}) {
  return (
    <div role="radiogroup" aria-label="색" className="flex flex-wrap gap-1.5">
      {CALENDAR_COLORS.map((c) => (
        <button
          key={c}
          type="button"
          role="radio"
          aria-checked={value === c}
          aria-label={c}
          onClick={() => onChange(c)}
          data-testid={`${testid}-${c.slice(1)}`}
          className={cn(
            "grid place-items-center rounded-full ring-offset-2 ring-offset-background transition",
            size === "sm" ? "size-6" : "size-7",
            value === c ? "ring-2 ring-foreground/70" : "hover:scale-110",
          )}
          style={{ backgroundColor: c }}
        >
          {value === c && <Check className="size-3.5 text-white" />}
        </button>
      ))}
    </div>
  )
}

/** 실제 업로드 대신 파일 이름만 받는다. */
export function FileDrop({
  fileName,
  onPick,
  testid,
  className,
}: {
  fileName: string
  onPick: (name: string) => void
  testid: string
  className?: string
}) {
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
        if (f) onPick(f.name)
      }}
      className={cn(
        "flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed px-3 text-sm transition",
        over ? "border-primary bg-primary/5 text-foreground" : "border-input text-muted-foreground hover:bg-muted/50",
        className,
      )}
    >
      <input
        type="file"
        accept=".ics,text/calendar"
        className="sr-only"
        onChange={(e) => onPick(e.target.files?.[0]?.name ?? "")}
        data-testid={testid}
      />
      <Upload size={16} className="shrink-0" />
      <span className={cn("truncate", fileName && "font-medium text-foreground")}>{fileName || ".ics 파일"}</span>
    </label>
  )
}
