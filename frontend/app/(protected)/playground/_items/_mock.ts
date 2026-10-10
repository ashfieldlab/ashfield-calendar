// 플레이그라운드 전용 가짜 데이터. 화면 모양을 비교하려는 것이라 서버를 부르지 않는다.
// 항목별로 더 필요한 데이터는 각 항목의 shared.tsx 에 둔다.

export interface MockMember {
  id: string
  name: string
  email: string
  color: string
}

export const ME: MockMember = { id: "u1", name: "Proto", email: "proto7@example.com", color: "#4f6b4a" }

export const MEMBERS: MockMember[] = [
  ME,
  { id: "u2", name: "김하늘", email: "sky@example.com", color: "#2563eb" },
  { id: "u3", name: "이서준", email: "seojun@example.com", color: "#d97706" },
  { id: "u4", name: "박지민", email: "jimin@example.com", color: "#db2777" },
  { id: "u5", name: "최도윤", email: "doyun@example.com", color: "#7c3aed" },
  { id: "u6", name: "정유나", email: "yuna@example.com", color: "#0d9488" },
]

export const memberOf = (id: string) => MEMBERS.find((m) => m.id === id) ?? ME

export interface MockCalendar {
  id: string
  name: string
  color: string
  scope: "personal" | "shared"
  source: "native" | "external_ics"
  owner: string
  /** 구독(외부 ICS) 주소 */
  url?: string
}

export const CALENDARS: MockCalendar[] = [
  { id: "c-me", name: "내 일정", color: "#4f6b4a", scope: "personal", source: "native", owner: "u1" },
  { id: "c-team", name: "제품팀", color: "#2563eb", scope: "shared", source: "native", owner: "u2" },
  { id: "c-ops", name: "운영", color: "#d97706", scope: "shared", source: "native", owner: "u3" },
  { id: "c-holiday", name: "대한민국 공휴일", color: "#dc2626", scope: "personal", source: "external_ics", owner: "u1", url: "https://calendar.example.com/kr-holidays.ics" },
]

export const calendarOf = (id: string) => CALENDARS.find((c) => c.id === id) ?? CALENDARS[0]

export interface MockRoom {
  id: string
  name: string
  capacity: number
}

export const ROOMS: MockRoom[] = [
  { id: "r-1", name: "대회의실", capacity: 12 },
  { id: "r-2", name: "소회의실 A", capacity: 4 },
  { id: "r-3", name: "포커스룸", capacity: 2 },
]

export type MockRsvp = "accepted" | "declined" | "tentative" | "pending"

export interface MockEvent {
  id: string
  title: string
  calendarId: string
  start: string
  end: string
  allDay?: boolean
  location?: string
  roomId?: string
  description?: string
  /** 사람이 읽는 반복 설명 */
  repeat?: string
  organizer: string
  attendees: { id: string; rsvp: MockRsvp }[]
  /** 예약 양식으로 들어온 일정 */
  booking?: { typeName: string; guestName: string; guestEmail: string }
}

/** 기준 시각: 2026-10-10 (토) 오전 */
export const NOW = new Date("2026-10-10T10:20:00+09:00")

const at = (day: number, h: number, m = 0) => {
  const t = new Date("2026-10-01T00:00:00+09:00")
  t.setDate(day)
  t.setHours(h, m)
  return t.toISOString()
}

export const EVENTS: MockEvent[] = [
  { id: "e1", title: "주간 제품 회의", calendarId: "c-team", start: at(12, 10), end: at(12, 11), roomId: "r-1", repeat: "매주 월요일", organizer: "u2", description: "지난주 출시 회고, 이번 주 우선순위 정리", attendees: [{ id: "u1", rsvp: "accepted" }, { id: "u3", rsvp: "accepted" }, { id: "u4", rsvp: "tentative" }, { id: "u5", rsvp: "pending" }] },
  { id: "e2", title: "디자인 리뷰", calendarId: "c-team", start: at(13, 14), end: at(13, 15, 30), roomId: "r-2", organizer: "u1", attendees: [{ id: "u2", rsvp: "accepted" }, { id: "u4", rsvp: "declined" }] },
  { id: "e3", title: "치과", calendarId: "c-me", start: at(14, 18, 30), end: at(14, 19, 30), location: "서초 연세치과", organizer: "u1", attendees: [] },
  { id: "e4", title: "한글날 대체공휴일", calendarId: "c-holiday", start: at(9, 0), end: at(10, 0), allDay: true, organizer: "u1", attendees: [] },
  { id: "e5", title: "서버 점검", calendarId: "c-ops", start: at(15, 2), end: at(15, 4), organizer: "u3", description: "DB 마이너 업그레이드", attendees: [{ id: "u1", rsvp: "pending" }, { id: "u6", rsvp: "accepted" }] },
  { id: "e6", title: "도입 상담: 한빛상사", calendarId: "c-me", start: at(16, 11), end: at(16, 11, 30), location: "화상 회의", organizer: "u1", attendees: [], booking: { typeName: "30분 상담", guestName: "윤가람", guestEmail: "garam@hanbit.example.com" } },
  { id: "e7", title: "팀 워크숍", calendarId: "c-team", start: at(22, 0), end: at(24, 0), allDay: true, location: "가평 리조트", organizer: "u2", attendees: [{ id: "u1", rsvp: "accepted" }, { id: "u3", rsvp: "accepted" }, { id: "u4", rsvp: "accepted" }, { id: "u5", rsvp: "accepted" }, { id: "u6", rsvp: "tentative" }] },
  { id: "e8", title: "1:1 서준", calendarId: "c-me", start: at(10, 16), end: at(10, 16, 30), organizer: "u1", repeat: "격주 토요일", attendees: [{ id: "u3", rsvp: "accepted" }] },
]

export const roomOf = (id?: string) => ROOMS.find((r) => r.id === id)

const WD = ["일", "월", "화", "수", "목", "금", "토"]

/** 10월 12일 (월) */
export function formatDay(iso: string) {
  const t = new Date(iso)
  return `${t.getMonth() + 1}월 ${t.getDate()}일 (${WD[t.getDay()]})`
}

/** 오후 2:00 */
export function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("ko-KR", { hour: "numeric", minute: "2-digit" })
}

/** 방금, 5분 전, 3시간 전, 어제, 3일 전 */
export function relativeTime(iso: string, now = NOW) {
  const s = Math.round((now.getTime() - new Date(iso).getTime()) / 1000)
  if (s < 60) return "방금"
  if (s < 3600) return `${Math.floor(s / 60)}분 전`
  if (s < 86400) return `${Math.floor(s / 3600)}시간 전`
  const d = Math.floor(s / 86400)
  return d === 1 ? "어제" : `${d}일 전`
}
