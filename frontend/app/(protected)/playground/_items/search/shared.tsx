"use client"

// 플레이그라운드: 전역 검색 안 비교. 가짜 일정에서 바로 찾는다 (서버 호출 없음).

import { Fragment } from "react"

import { EVENTS, NOW, formatDay, formatTime, type MockEvent } from "../_mock"

export type Field = "title" | "location" | "description"

export const FIELD_LABEL: Record<Field, string> = {
  title: "제목",
  location: "장소",
  description: "설명",
}

export interface SearchItem {
  id: string
  title: string
  calendarId: string
  start: string
  end: string
  allDay?: boolean
  location?: string
  description?: string
}

const at = (month: number, day: number, h = 0, m = 0) =>
  new Date(2026, month - 1, day, h, m).toISOString()

const EXTRA: SearchItem[] = [
  { id: "s1", title: "제품 회의 회고", calendarId: "c-team", start: at(9, 28, 10), end: at(9, 28, 11), location: "대회의실", description: "9월 출시 회의 정리" },
  { id: "s2", title: "디자인 시스템 리뷰", calendarId: "c-team", start: at(9, 30, 15), end: at(9, 30, 16), location: "소회의실 A" },
  { id: "s3", title: "분기 계획 회의", calendarId: "c-team", start: at(10, 20, 14), end: at(10, 20, 16), location: "대회의실", description: "4분기 목표, 채용 계획" },
  { id: "s4", title: "고객사 미팅: 한빛상사", calendarId: "c-me", start: at(10, 21, 11), end: at(10, 21, 12), location: "한빛상사 본사", description: "도입 견적 회의" },
  { id: "s5", title: "코드 리뷰 데이", calendarId: "c-ops", start: at(10, 23, 13), end: at(10, 23, 17), description: "배포 전 리뷰, 점검 항목 확인" },
  { id: "s6", title: "월간 운영 회의", calendarId: "c-ops", start: at(11, 2, 9, 30), end: at(11, 2, 10, 30), location: "화상 회의" },
  { id: "s7", title: "치과 정기검진", calendarId: "c-me", start: at(9, 14, 18, 30), end: at(9, 14, 19), location: "서초 연세치과" },
  { id: "s8", title: "개천절", calendarId: "c-holiday", start: at(10, 3), end: at(10, 4), allDay: true },
  { id: "s9", title: "디자인 리뷰", calendarId: "c-team", start: at(10, 6, 14), end: at(10, 6, 15, 30), location: "소회의실 A", description: "온보딩 화면 2차" },
]

const fromMock = (e: MockEvent): SearchItem => ({
  id: e.id,
  title: e.title,
  calendarId: e.calendarId,
  start: e.start,
  end: e.end,
  allDay: e.allDay,
  location: e.location,
  description: e.description,
})

export const SEARCH_ITEMS: SearchItem[] = [...EVENTS.map(fromMock), ...EXTRA].sort(
  (a, b) => a.start.localeCompare(b.start),
)

export const RECENT_QUERIES = ["회의", "리뷰", "한빛", "치과"]

export interface Hit {
  item: SearchItem
  /** 제목 말고 다른 곳에서 찾았을 때 */
  field: Field
}

export interface SearchOptions {
  from?: string
  to?: string
  calendars?: Set<string>
  fields?: Set<Field>
}

export function search(q: string, opt: SearchOptions = {}): Hit[] {
  const term = q.trim().toLowerCase()
  if (!term) return []
  const fields: Field[] = opt.fields ? (["title", "location", "description"] as Field[]).filter((f) => opt.fields!.has(f)) : ["title", "location", "description"]
  const fromT = opt.from ? new Date(`${opt.from}T00:00:00`).getTime() : -Infinity
  const toT = opt.to ? new Date(`${opt.to}T23:59:59`).getTime() : Infinity
  const hits: Hit[] = []
  for (const item of SEARCH_ITEMS) {
    const t = new Date(item.start).getTime()
    if (t < fromT || t > toT) continue
    if (opt.calendars && opt.calendars.size > 0 && !opt.calendars.has(item.calendarId)) continue
    const field = fields.find((f) => (item[f] ?? "").toLowerCase().includes(term))
    if (field) hits.push({ item, field })
  }
  return hits
}

export const isPast = (item: SearchItem) => new Date(item.end).getTime() < NOW.getTime()

export function timeLabel(item: SearchItem) {
  return item.allDay ? "종일" : `${formatTime(item.start)} ~ ${formatTime(item.end)}`
}

export function dayKey(iso: string) {
  const d = new Date(iso)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

export const TODAY_KEY = dayKey(NOW.toISOString())

/** yyyy-mm-dd, NOW 기준 n일 뒤 */
export function shiftDay(n: number) {
  const d = new Date(NOW)
  d.setDate(d.getDate() + n)
  return dayKey(d.toISOString())
}

export { formatDay }

/** 일치 부분 강조 */
export function Highlight({ text, q }: { text: string; q: string }) {
  const term = q.trim()
  if (!term) return <>{text}</>
  const lower = text.toLowerCase()
  const t = term.toLowerCase()
  const parts: { s: string; hit: boolean }[] = []
  let i = 0
  while (i < text.length) {
    const j = lower.indexOf(t, i)
    if (j < 0) {
      parts.push({ s: text.slice(i), hit: false })
      break
    }
    if (j > i) parts.push({ s: text.slice(i, j), hit: false })
    parts.push({ s: text.slice(j, j + t.length), hit: true })
    i = j + t.length
  }
  return (
    <>
      {parts.map((p, k) =>
        p.hit ? (
          <mark key={k} className="rounded-sm bg-amber-200/80 px-px text-inherit dark:bg-amber-400/30">
            {p.s}
          </mark>
        ) : (
          <Fragment key={k}>{p.s}</Fragment>
        ),
      )}
    </>
  )
}
