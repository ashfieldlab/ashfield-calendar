/** booking 공개 페이지용 헬퍼. */

export function DAYS_LATER(n: number): Date {
  const d = new Date()
  d.setDate(d.getDate() + n)
  return d
}

export function formatLocal(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })
}
