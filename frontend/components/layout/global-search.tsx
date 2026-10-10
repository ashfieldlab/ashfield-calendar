"use client"

import { useEffect, useState } from "react"
import { Search } from "lucide-react"

import { SearchModal } from "@/components/layout/search-modal"

/** 헤더 검색 단추. 누르거나 Ctrl/⌘ K 로 검색 팔레트를 연다. */
export function GlobalSearch() {
  const [open, setOpen] = useState(false)
  const [mac] = useState(() => typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform))

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault()
        setOpen((v) => !v)
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        data-testid="global-search-button"
        aria-label="일정 검색"
        className="inline-flex h-8 items-center gap-2 rounded-lg border border-input bg-card px-2.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground sm:w-56"
      >
        <Search size={14} className="shrink-0" />
        <span className="hidden flex-1 text-left sm:inline">일정 검색</span>
        <kbd className="hidden rounded border bg-background px-1 py-px font-mono text-[10px] sm:inline" suppressHydrationWarning>
          {mac ? "⌘K" : "Ctrl K"}
        </kbd>
      </button>
      {open && <SearchModal onClose={() => setOpen(false)} />}
    </>
  )
}
