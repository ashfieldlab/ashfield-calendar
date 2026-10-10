"use client"

// 안 A: 원본을 다듬은 한 화면. 색 견본을 바로 펼치고, 가져오기 방식은 위 탭으로.

import { X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

import { FileDrop, SAMPLE_URL, SCOPE_LABEL, SOURCES, Swatches, inputClass, useDraft, type Scope } from "./shared"

export function VariantA() {
  const { d, set, ready, submit, cancel } = useDraft()

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        submit()
      }}
      className="w-full max-w-[440px] overflow-hidden rounded-2xl border bg-background shadow-2xl"
      data-testid="pg-calendar-dialog-a"
    >
      <div className="h-1.5 transition-colors" style={{ backgroundColor: d.color }} />
      <header className="flex items-center px-5 pt-4">
        <h2 className="flex-1 text-base font-semibold">새 캘린더</h2>
        <button
          type="button"
          onClick={cancel}
          data-testid="pg-calendar-dialog-a-close"
          aria-label="닫기"
          className="-mr-1.5 grid size-8 place-items-center rounded-md text-muted-foreground hover:bg-muted"
        >
          <X size={16} />
        </button>
      </header>

      <div role="tablist" className="mx-5 mt-4 grid grid-cols-3 rounded-lg bg-muted p-0.5">
        {SOURCES.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={d.source === key}
            onClick={() => set({ source: key })}
            data-testid={`pg-calendar-dialog-a-source-${key}`}
            className={cn(
              "inline-flex h-8 items-center justify-center gap-1.5 rounded-md text-xs font-medium transition",
              d.source === key ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon size={14} />
            {label}
          </button>
        ))}
      </div>

      <div className="space-y-4 px-5 pt-5 pb-2">
        {d.source === "url" && (
          <input
            type="url"
            autoFocus
            value={d.url}
            onChange={(e) => set({ url: e.target.value })}
            placeholder={SAMPLE_URL}
            className={cn(inputClass, "font-mono text-xs")}
            data-testid="pg-calendar-dialog-a-url"
          />
        )}
        {d.source === "file" && (
          <FileDrop fileName={d.fileName} onPick={(n) => set({ fileName: n })} testid="pg-calendar-dialog-a-file" className="h-16" />
        )}

        <div className="flex items-center gap-2.5">
          <span className="size-3.5 shrink-0 rounded-full transition-colors" style={{ backgroundColor: d.color }} />
          <input
            autoFocus={d.source === "native"}
            value={d.name}
            onChange={(e) => set({ name: e.target.value })}
            placeholder="캘린더 이름"
            className="h-10 min-w-0 flex-1 border-b border-input bg-transparent text-base font-medium outline-none transition focus:border-ring placeholder:font-normal placeholder:text-muted-foreground/70"
            data-testid="pg-calendar-dialog-a-name"
          />
        </div>

        <Swatches value={d.color} onChange={(c) => set({ color: c })} testid="pg-calendar-dialog-a-color" size="sm" />

        <div className="flex items-center gap-3 pt-1">
          <span className="text-sm text-muted-foreground">공개 범위</span>
          <div role="radiogroup" className="inline-flex rounded-lg border p-0.5 text-sm">
            {(Object.keys(SCOPE_LABEL) as Scope[]).map((k) => (
              <button
                key={k}
                type="button"
                role="radio"
                aria-checked={d.scope === k}
                onClick={() => set({ scope: k })}
                data-testid={`pg-calendar-dialog-a-scope-${k}`}
                className={cn(
                  "rounded-md px-3 py-1 transition",
                  d.scope === k ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {SCOPE_LABEL[k]}
              </button>
            ))}
          </div>
        </div>
      </div>

      <footer className="flex justify-end gap-2 px-5 py-4">
        <Button type="button" variant="ghost" onClick={cancel} data-testid="pg-calendar-dialog-a-cancel">
          취소
        </Button>
        <Button type="submit" disabled={!ready} data-testid="pg-calendar-dialog-a-submit">
          만들기
        </Button>
      </footer>
    </form>
  )
}
