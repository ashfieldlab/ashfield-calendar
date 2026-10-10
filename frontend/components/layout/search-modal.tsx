"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { Calendar, Search, X } from "lucide-react"

import { api } from "@/lib/api-client"
import { formatDateTime } from "@/lib/utils/format"

interface SearchEventItem {
  id: string
  calendar_id: string
  title: string
  description: string | null
  location: string | null
  start_at: string
  end_at: string
}

interface SearchResponse {
  events: SearchEventItem[]
}

// 상세 검색 모달 (일정 날짜 필터). 제출식.
export function SearchModal({
  initialQuery,
  onClose,
}: {
  initialQuery: string
  onClose: () => void
}) {
  const [q, setQ] = useState(initialQuery)
  const [from, setFrom] = useState("")
  const [to, setTo] = useState("")
  const [data, setData] = useState<SearchResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  // 포커스는 마운트 시 1회만 — 부모 리렌더로 재실행되면 열린 select 에서
  // 포커스를 뺏어 닫히므로 deps 를 비운다.
  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [onClose])

  async function runSearch() {
    const term = q.trim()
    if (!term) return
    setLoading(true)
    setSearched(true)
    try {
      const p = new URLSearchParams({ q: term, limit: "50" })
      if (from) p.set("date_from", new Date(`${from}T00:00:00`).toISOString())
      if (to) p.set("date_to", new Date(`${to}T23:59:59`).toISOString())
      setData(await api<SearchResponse>(`/api/v1/search?${p}`))
    } catch {
      setData(null)
    } finally {
      setLoading(false)
    }
  }

  const results = data?.events ?? []

  return (
    <div
      className="fixed inset-0 z-[60] flex items-start justify-center bg-black/30 p-4 pt-[8vh]"
      // 누르기가 배경에서 "시작"됐을 때만 닫기 — 네이티브 select 팝업이 닫히며
      // 흘리는 click 이나 안쪽 드래그가 배경에서 끝나도 모달이 닫히지 않게.
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        className="flex max-h-[80vh] w-[560px] flex-col overflow-hidden rounded-lg bg-white shadow-xl"
        data-testid="search-modal"
      >
        <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
          <h3 className="text-sm font-semibold text-gray-900">상세 검색</h3>
          <button
            onClick={onClose}
            data-testid="search-modal-close"
            className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
          >
            <X size={16} />
          </button>
        </div>

        <div className="space-y-2 border-b border-gray-100 p-4">
          <div className="relative">
            <Search
              size={14}
              className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400"
            />
            <input
              ref={inputRef}
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && runSearch()}
              placeholder="검색어"
              data-testid="search-modal-input"
              className="w-full rounded border border-gray-300 py-1.5 pl-8 pr-3 text-sm focus:border-gray-500 focus:outline-none"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              data-testid="search-modal-from"
              className="rounded border border-gray-300 px-2 py-1.5 text-xs focus:border-gray-500 focus:outline-none"
              title="일정 시작일"
            />
            <span className="text-gray-400">~</span>
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              data-testid="search-modal-to"
              className="rounded border border-gray-300 px-2 py-1.5 text-xs focus:border-gray-500 focus:outline-none"
            />
            <button
              onClick={runSearch}
              disabled={loading || !q.trim()}
              data-testid="search-modal-submit"
              className="ml-auto rounded bg-gray-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-gray-800 disabled:opacity-50"
            >
              {loading ? "검색 중…" : "검색"}
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {!searched ? (
            <p className="p-8 text-center text-xs text-gray-400">
              검색어와 필터를 정하고 검색하세요.
            </p>
          ) : loading ? (
            <p className="p-8 text-center text-xs text-gray-500">검색 중…</p>
          ) : results.length === 0 ? (
            <p
              className="p-8 text-center text-xs text-gray-500"
              data-testid="search-modal-empty"
            >
              결과가 없습니다.
            </p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {(data?.events ?? []).map((e) => (
                <li key={e.id}>
                  <Link
                    href="/calendar"
                    onClick={onClose}
                    data-testid={`search-modal-event-${e.id}`}
                    className="flex items-center gap-2 px-4 py-2.5 text-sm hover:bg-gray-50"
                  >
                    <Calendar size={14} className="shrink-0 text-emerald-600" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-gray-900">{e.title}</p>
                      <p className="truncate text-[11px] text-gray-500">
                        {formatDateTime(e.start_at)}
                        {e.location && ` · ${e.location}`}
                      </p>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
