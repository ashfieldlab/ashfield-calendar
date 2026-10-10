"use client"

// 안 B: 종류 먼저 고르기. 1단계에서 네 가지 중 하나, 2단계는 그 종류에 필요한 칸만.

import { useState } from "react"
import { ArrowLeft, ChevronRight, Link2, Upload, User, Users, X, type LucideIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

import { MEMBERS } from "../_mock"
import { FileDrop, SAMPLE_URL, SCOPE_LABEL, Swatches, inputClass, nameFrom, useDraft, type Scope, type Source } from "./shared"

type Kind = "personal" | "shared" | "url" | "file"

const KINDS: { key: Kind; label: string; icon: LucideIcon; scope: Scope; source: Source }[] = [
  { key: "personal", label: "내 캘린더", icon: User, scope: "personal", source: "native" },
  { key: "shared", label: "워크스페이스 캘린더", icon: Users, scope: "shared", source: "native" },
  { key: "url", label: "URL 구독", icon: Link2, scope: "personal", source: "url" },
  { key: "file", label: ".ics 가져오기", icon: Upload, scope: "personal", source: "file" },
]

export function VariantB() {
  const { d, set, ready, submit, cancel } = useDraft()
  const [kind, setKind] = useState<Kind | null>(null)
  const k = KINDS.find((x) => x.key === kind)

  return (
    <div className="w-full max-w-[420px] overflow-hidden rounded-2xl border bg-background shadow-2xl" data-testid="pg-calendar-dialog-b">
      <header className="flex items-center gap-1 px-4 pt-4 pb-2">
        {k && (
          <button
            type="button"
            onClick={() => setKind(null)}
            data-testid="pg-calendar-dialog-b-back"
            aria-label="뒤로"
            className="grid size-8 place-items-center rounded-md text-muted-foreground hover:bg-muted"
          >
            <ArrowLeft size={16} />
          </button>
        )}
        <h2 className={cn("flex-1 text-base font-semibold", !k && "pl-1")}>{k ? k.label : "새 캘린더"}</h2>
        <button
          type="button"
          onClick={cancel}
          data-testid="pg-calendar-dialog-b-close"
          aria-label="닫기"
          className="grid size-8 place-items-center rounded-md text-muted-foreground hover:bg-muted"
        >
          <X size={16} />
        </button>
      </header>

      {!k ? (
        <div className="space-y-1 p-2 pt-0">
          {KINDS.map(({ key, label, icon: Icon, scope, source }) => (
            <button
              key={key}
              type="button"
              onClick={() => {
                setKind(key)
                set({ scope, source })
              }}
              data-testid={`pg-calendar-dialog-b-kind-${key}`}
              className="group flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition hover:bg-muted"
            >
              <span className="grid size-10 shrink-0 place-items-center rounded-xl border bg-card text-muted-foreground transition group-hover:border-primary/40 group-hover:text-primary">
                <Icon size={18} />
              </span>
              <span className="flex-1 text-sm font-medium">{label}</span>
              {key === "shared" && (
                <span className="flex -space-x-1.5">
                  {MEMBERS.slice(0, 4).map((m) => (
                    <span key={m.id} className="size-5 rounded-full ring-2 ring-background" style={{ backgroundColor: m.color }} />
                  ))}
                </span>
              )}
              <ChevronRight size={16} className="text-muted-foreground/60" />
            </button>
          ))}
        </div>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault()
            submit()
          }}
        >
          <div className="space-y-4 px-5 pt-2 pb-2">
            {d.source === "url" && (
              <input
                type="url"
                autoFocus
                value={d.url}
                onChange={(e) => set({ url: e.target.value })}
                onBlur={() => !d.name && d.url && set({ name: nameFrom(d.url) })}
                placeholder={SAMPLE_URL}
                className={cn(inputClass, "font-mono text-xs")}
                data-testid="pg-calendar-dialog-b-url"
              />
            )}
            {d.source === "file" && (
              <FileDrop
                fileName={d.fileName}
                onPick={(n) => set({ fileName: n, name: d.name || nameFrom(n) })}
                testid="pg-calendar-dialog-b-file"
                className="h-24 flex-col"
              />
            )}

            <div className="flex items-center gap-2">
              <span className="grid size-10 shrink-0 place-items-center rounded-lg border">
                <span className="size-4 rounded-full" style={{ backgroundColor: d.color }} />
              </span>
              <input
                autoFocus={d.source === "native"}
                value={d.name}
                onChange={(e) => set({ name: e.target.value })}
                placeholder="이름"
                className={inputClass}
                data-testid="pg-calendar-dialog-b-name"
              />
            </div>
            <Swatches value={d.color} onChange={(c) => set({ color: c })} testid="pg-calendar-dialog-b-color" />

            {d.source !== "native" && (
              <label className="flex items-center gap-3 rounded-lg border px-3 py-2.5 text-sm">
                <Users size={15} className="text-muted-foreground" />
                <span className="flex-1">{SCOPE_LABEL.shared}에 공유</span>
                <input
                  type="checkbox"
                  checked={d.scope === "shared"}
                  onChange={(e) => set({ scope: e.target.checked ? "shared" : "personal" })}
                  data-testid="pg-calendar-dialog-b-share"
                  className="size-4 accent-primary"
                />
              </label>
            )}
          </div>
          <footer className="px-5 pt-3 pb-5">
            <Button type="submit" className="h-10 w-full" disabled={!ready} data-testid="pg-calendar-dialog-b-submit">
              만들기
            </Button>
          </footer>
        </form>
      )}
    </div>
  )
}
