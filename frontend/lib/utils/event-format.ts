/** 일정 상세 시트와 검색에서 쓰는 표시용 문자열. */

const WEEKDAY: Record<string, string> = {
  MO: "월",
  TU: "화",
  WE: "수",
  TH: "목",
  FR: "금",
  SA: "토",
  SU: "일",
}

/** RRULE 을 짧은 한국어로: "매주 월, 수", "2주마다", "매월". 모르는 규칙은 "반복". */
export function describeRrule(rrule: string | null | undefined): string {
  if (!rrule) return ""
  const parts = new Map<string, string>()
  for (const kv of rrule.replace(/^RRULE:/i, "").split(";")) {
    const [k, v] = kv.split("=")
    if (k && v) parts.set(k.trim().toUpperCase(), v.trim().toUpperCase())
  }
  const interval = Number(parts.get("INTERVAL") ?? "1") || 1
  const unit: Record<string, [string, string]> = {
    DAILY: ["매일", "일"],
    WEEKLY: ["매주", "주"],
    MONTHLY: ["매월", "개월"],
    YEARLY: ["매년", "년"],
  }
  const freq = unit[parts.get("FREQ") ?? ""]
  if (!freq) return "반복"
  let text = interval > 1 ? `${interval}${freq[1]}마다` : freq[0]
  const byday = parts.get("BYDAY")
  if (byday && parts.get("FREQ") === "WEEKLY") {
    const days = byday
      .split(",")
      .map((d) => WEEKDAY[d.replace(/^[+-]?\d+/, "")])
      .filter(Boolean)
    if (days.length) text += ` ${days.join(", ")}`
  }
  return text
}

/** 알림 분 → "10분 전 알림", "1시간 전 알림", "1일 전 알림". */
export function reminderLabel(min: number | null | undefined): string {
  if (min == null) return ""
  if (min === 0) return "시작할 때 알림"
  if (min % 1440 === 0) return `${min / 1440}일 전 알림`
  if (min % 60 === 0) return `${min / 60}시간 전 알림`
  return `${min}분 전 알림`
}

/** "1시간 30분", "45분" */
export function durationLabel(start: Date, end: Date): string {
  const min = Math.max(0, Math.round((end.getTime() - start.getTime()) / 60000))
  const h = Math.floor(min / 60)
  const m = min % 60
  if (h && m) return `${h}시간 ${m}분`
  return h ? `${h}시간` : `${m}분`
}

/** "10월 12일 (월)" */
export function dayLabel(d: Date): string {
  return d.toLocaleDateString("ko-KR", { month: "long", day: "numeric", weekday: "short" })
}

/** "오후 2:00" */
export function timeOfDay(d: Date): string {
  return d.toLocaleTimeString("ko-KR", { hour: "numeric", minute: "2-digit" })
}

/** 종일 일정의 마지막 날 (끝이 다음 날 0시면 하루 전). */
export function allDayLastDay(start: Date, end: Date): Date {
  const last = new Date(end.getTime() - 1)
  return last < start ? start : last
}

/** 같은 이름이면 같은 색: 아바타 배경 */
export function avatarColor(seed: string): string {
  const palette = ["#4f46e5", "#0891b2", "#059669", "#d97706", "#db2777", "#7c3aed", "#2563eb", "#65a30d"]
  let h = 0
  for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) | 0
  return palette[Math.abs(h) % palette.length]
}

/** 주소의 호스트만 */
export function hostOf(url: string | null | undefined): string {
  if (!url) return ""
  try {
    return new URL(url).host
  } catch {
    return url
  }
}
