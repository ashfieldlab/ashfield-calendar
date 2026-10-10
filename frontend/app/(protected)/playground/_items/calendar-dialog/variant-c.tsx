"use client"

// 안 C: 넓은 2단. 왼쪽은 고르는 대로 바뀌는 미리보기(사이드바 줄, 한 주 일정), 오른쪽은 입력.

import { Link2, Rss, Upload, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

import { CALENDARS, MEMBERS } from "../_mock"
import { FileDrop, SAMPLE_URL, SCOPE_LABEL, SOURCES, Swatches, inputClass, nameFrom, useDraft, type Scope } from "./shared"

const WEEK = ["월", "화", "수", "목", "금"]
const SAMPLE: { day: number; top: number; h: number }[] = [
  { day: 0, top: 18, h: 22 },
  { day: 2, top: 48, h: 30 },
  { day: 3, top: 10, h: 18 },
  { day: 4, top: 60, h: 20 },
]

export function VariantC() {
  const { d, set, ready, submit, cancel } = useDraft()
  const shown = d.name.trim() || "새 캘린더"
  const others = CALENDARS.filter((c) => c.scope === d.scope).slice(0, 2)

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        submit()
      }}
      className="flex w-full max-w-[760px] overflow-hidden rounded-2xl border bg-background shadow-2xl"
      data-testid="pg-calendar-dialog-c"
    >
      <aside className="hidden w-[300px] shrink-0 flex-col gap-5 border-r bg-muted/40 p-5 sm:flex">
        <div className="rounded-xl border bg-background p-2">
          <p className="px-2 pb-1 text-[11px] text-muted-foreground">{SCOPE_LABEL[d.scope]}</p>
          {others.map((c) => (
            <div key={c.id} className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-muted-foreground">
              <span className="size-3 rounded-sm" style={{ backgroundColor: c.color }} />
              <span className="truncate">{c.name}</span>
            </div>
          ))}
          <div className="flex items-center gap-2 rounded-md bg-muted px-2 py-1.5 text-sm font-medium">
            <span className="size-3 rounded-sm transition-colors" style={{ backgroundColor: d.color }} />
            <span className="flex-1 truncate">{shown}</span>
            {d.source === "url" && <Rss size={11} className="text-muted-foreground" />}
          </div>
        </div>

        <div className="rounded-xl border bg-background p-3">
          <div className="grid grid-cols-5 gap-1 text-center text-[11px] text-muted-foreground">
            {WEEK.map((w) => (
              <span key={w}>{w}</span>
            ))}
          </div>
          <div className="relative mt-2 grid h-24 grid-cols-5 gap-1">
            {WEEK.map((w) => (
              <span key={w} className="rounded-md bg-muted/60" />
            ))}
            {d.source !== "native" || d.name
              ? SAMPLE.map((e, i) => (
                  <span
                    key={i}
                    className="absolute rounded-[5px] transition-colors"
                    style={{
                      left: `calc(${e.day * 20}% + 2px)`,
                      width: "calc(20% - 6px)",
                      top: e.top,
                      height: e.h,
                      backgroundColor: d.color,
                      opacity: d.source === "native" ? 0.35 : 0.9,
                    }}
                  />
                ))
              : null}
          </div>
        </div>

        {d.scope === "shared" && (
          <div className="mt-auto flex items-center gap-2 text-xs text-muted-foreground">
            <span className="flex -space-x-1.5">
              {MEMBERS.map((m) => (
                <span key={m.id} className="size-5 rounded-full ring-2 ring-muted" style={{ backgroundColor: m.color }} />
              ))}
            </span>
            {MEMBERS.length}명
          </div>
        )}
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center px-6 pt-5">
          <h2 className="flex-1 text-lg font-semibold">새 캘린더</h2>
          <button
            type="button"
            onClick={cancel}
            data-testid="pg-calendar-dialog-c-close"
            aria-label="닫기"
            className="-mr-2 grid size-8 place-items-center rounded-md text-muted-foreground hover:bg-muted"
          >
            <X size={16} />
          </button>
        </header>

        <div className="flex-1 space-y-5 px-6 py-5">
          <Field label="이름">
            <input
              autoFocus
              value={d.name}
              onChange={(e) => set({ name: e.target.value })}
              placeholder="캘린더 이름"
              className={inputClass}
              data-testid="pg-calendar-dialog-c-name"
            />
          </Field>

          <Field label="색">
            <Swatches value={d.color} onChange={(c) => set({ color: c })} testid="pg-calendar-dialog-c-color" />
          </Field>

          <Field label="범위">
            <div className="grid grid-cols-2 gap-2">
              {(Object.keys(SCOPE_LABEL) as Scope[]).map((k) => (
                <button
                  key={k}
                  type="button"
                  role="radio"
                  aria-checked={d.scope === k}
                  onClick={() => set({ scope: k })}
                  data-testid={`pg-calendar-dialog-c-scope-${k}`}
                  className={cn(
                    "flex h-10 items-center gap-2 rounded-lg border px-3 text-sm transition",
                    d.scope === k ? "border-primary bg-primary/5 font-medium" : "border-input text-muted-foreground hover:bg-muted/50",
                  )}
                >
                  <span
                    className={cn(
                      "size-3.5 rounded-full border-2 transition",
                      d.scope === k ? "border-primary bg-primary ring-2 ring-inset ring-background" : "border-input",
                    )}
                  />
                  {SCOPE_LABEL[k]}
                </button>
              ))}
            </div>
          </Field>

          <Field label="일정">
            <div className="flex gap-4 border-b">
              {SOURCES.map(({ key, label }) => (
                <button
                  key={key}
                  type="button"
                  role="tab"
                  aria-selected={d.source === key}
                  onClick={() => set({ source: key })}
                  data-testid={`pg-calendar-dialog-c-source-${key}`}
                  className={cn(
                    "-mb-px border-b-2 pb-2 text-sm transition",
                    d.source === key ? "border-primary font-medium" : "border-transparent text-muted-foreground hover:text-foreground",
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
            {d.source === "url" && (
              <div className="relative mt-3">
                <Link2 size={14} className="absolute top-3 left-3 text-muted-foreground" />
                <input
                  type="url"
                  value={d.url}
                  onChange={(e) => set({ url: e.target.value })}
                  onBlur={() => !d.name && d.url && set({ name: nameFrom(d.url) })}
                  placeholder={SAMPLE_URL}
                  className={cn(inputClass, "pl-8 font-mono text-xs")}
                  data-testid="pg-calendar-dialog-c-url"
                />
              </div>
            )}
            {d.source === "file" && (
              <FileDrop
                fileName={d.fileName}
                onPick={(n) => set({ fileName: n, name: d.name || nameFrom(n) })}
                testid="pg-calendar-dialog-c-file"
                className="mt-3 h-14"
              />
            )}
          </Field>
        </div>

        <footer className="flex items-center gap-2 border-t px-6 py-3.5">
          {d.source === "file" && d.fileName && (
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              <Upload size={12} /> {d.fileName}
            </span>
          )}
          <span className="flex-1" />
          <Button type="button" variant="ghost" onClick={cancel} data-testid="pg-calendar-dialog-c-cancel">
            취소
          </Button>
          <Button type="submit" disabled={!ready} data-testid="pg-calendar-dialog-c-submit">
            만들기
          </Button>
        </footer>
      </div>
    </form>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-2 text-xs font-medium text-muted-foreground">{label}</div>
      {children}
    </div>
  )
}
