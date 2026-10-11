"use client"

// 플레이그라운드: 일정 모달 오른쪽 칸의 회의실 겹침 표시 비교. mock 데이터만 쓴다.

import { formatTime, rangeText, ymdOf } from "@/lib/utils/day-format"

export interface MockRoom {
  id: string
  name: string
  capacity: number | null
}

export interface MockConflict {
  start_at: string
  end_at: string
  all_day: boolean
  /** 요청자가 읽을 수 있는 일정일 때만 */
  title: string | null
}

export interface VariantProps {
  rooms: MockRoom[]
  roomId: string
  onRoomChange: (id: string) => void
  /** 폼에서 고른 시간 */
  start: Date
  end: Date
  /** 선택한 방의 겹침 (없으면 null) */
  conflict: MockConflict | null
  /** 이 시간에 사용 중인 방 id */
  busyRoomIds: Set<string>
}

export const MOCK_ROOMS: MockRoom[] = [
  { id: "r1", name: "1층", capacity: 2 },
  { id: "r2", name: "1층 회의실", capacity: 15 },
  { id: "r3", name: "2층 소회의실", capacity: 6 },
]

export const fieldClass =
  "h-9 rounded-lg border border-input bg-background px-2.5 text-sm outline-none transition focus:border-ring focus:ring-3 focus:ring-ring/20"

export function roomLabel(r: MockRoom) {
  return r.capacity != null ? `${r.name} (${r.capacity}인)` : r.name
}

/** 폼 날짜와 같은 날이면 시각만, 아니면 날짜까지 */
export function conflictWhen(c: MockConflict, formStart: Date): string {
  const sameDay =
    !c.all_day &&
    ymdOf(new Date(c.start_at)) === ymdOf(formStart) &&
    ymdOf(new Date(c.end_at)) === ymdOf(formStart)
  return sameDay
    ? `${formatTime(c.start_at)} ~ ${formatTime(c.end_at)}`
    : rangeText(c.start_at, c.end_at, c.all_day)
}

export function Prop({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <p className="text-[11px] font-semibold tracking-wide text-muted-foreground">{label}</p>
      {children}
    </div>
  )
}
