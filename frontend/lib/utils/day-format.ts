/** 활동, 알림 화면 공통 날짜 표기 (브라우저 로컬 시간대) */

const WD = ["일", "월", "화", "수", "목", "금", "토"]

/** 10월 12일 (월) */
export function formatDay(iso: string | Date): string {
  const t = new Date(iso)
  return `${t.getMonth() + 1}월 ${t.getDate()}일 (${WD[t.getDay()]})`
}

/** 오후 2:00 */
export function formatTime(iso: string | Date): string {
  return new Date(iso).toLocaleTimeString("ko-KR", { hour: "numeric", minute: "2-digit" })
}

/** 10월 12일 (월) 오후 2:00 */
export const whenText = (iso: string) => `${formatDay(iso)} ${formatTime(iso)}`

/** 14:05 */
export function clock(iso: string): string {
  const t = new Date(iso)
  return `${String(t.getHours()).padStart(2, "0")}:${String(t.getMinutes()).padStart(2, "0")}`
}

/** 2026-10-12 (로컬) */
export function ymdOf(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

/** "2026-10-12" 를 로컬 자정 Date 로 */
export function parseYmd(ymd: string): Date {
  const [y, m, d] = ymd.split("-").map(Number)
  return new Date(y, m - 1, d)
}

/** 일정 시각 범위: "10월 12일 (월) 오후 2:00 ~ 오후 3:00", 종일이면 "10월 12일 (월) 종일" */
export function rangeText(start?: string | null, end?: string | null, allDay?: boolean): string {
  if (!start) return ""
  if (allDay) return `${formatDay(start)} 종일`
  if (!end) return whenText(start)
  const sameDay = ymdOf(new Date(start)) === ymdOf(new Date(end))
  return sameDay
    ? `${formatDay(start)} ${formatTime(start)} ~ ${formatTime(end)}`
    : `${whenText(start)} ~ ${whenText(end)}`
}

export type DayBucket = "오늘" | "어제" | "이번 주" | "이전"
export const DAY_BUCKETS: DayBucket[] = ["오늘", "어제", "이번 주", "이전"]

export function dayBucket(iso: string, now: Date = new Date()): DayBucket {
  const start = new Date(now)
  start.setHours(0, 0, 0, 0)
  const t = new Date(iso).getTime()
  const day = 86_400_000
  if (t >= start.getTime()) return "오늘"
  if (t >= start.getTime() - day) return "어제"
  if (t >= start.getTime() - 6 * day) return "이번 주"
  return "이전"
}

/** 같은 값이면 같은 색: 아바타 배경 */
export function seedColor(seed: string): string {
  const palette = ["#4f46e5", "#0891b2", "#059669", "#d97706", "#db2777", "#7c3aed", "#2563eb", "#65a30d"]
  let h = 0
  for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) | 0
  return palette[Math.abs(h) % palette.length]
}
