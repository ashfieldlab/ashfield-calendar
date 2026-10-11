"use client"

import { useState, type ComponentType } from "react"

import { MOCK_ROOMS, type MockConflict, type VariantProps } from "./shared"
import { VariantA } from "./variant-a"
import { VariantB } from "./variant-b"
import { VariantC } from "./variant-c"

export const roomConflictVariants = [
  { key: "A", name: "겹친 일정 카드" },
  { key: "B", name: "시간 막대" },
  { key: "C", name: "카드 + 빈 회의실" },
]

const VARIANTS: Record<string, ComponentType<VariantProps>> = { A: VariantA, B: VariantB, C: VariantC }

function at(h: number, m = 0) {
  const d = new Date()
  d.setHours(h, m, 0, 0)
  return d
}

// 폼: 14:00 ~ 15:00, "1층"(r1) 은 13:30 ~ 14:30 사용 중
const START = at(14)
const END = at(15)
const BUSY = new Set(["r1"])

function conflictFor(roomId: string, title: string | null): MockConflict | null {
  if (!BUSY.has(roomId)) return null
  return { start_at: at(13, 30).toISOString(), end_at: at(14, 30).toISOString(), all_day: false, title }
}

function Panel({ variant, heading, title }: { variant: string; heading: string; title: string | null }) {
  const [roomId, setRoomId] = useState("r1")
  const Variant = VARIANTS[variant] ?? VariantA
  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">{heading}</p>
      <aside className="w-[260px] space-y-5 rounded-xl border bg-muted/40 p-5">
        <Variant
          rooms={MOCK_ROOMS}
          roomId={roomId}
          onRoomChange={setRoomId}
          start={START}
          end={END}
          conflict={conflictFor(roomId, title)}
          busyRoomIds={BUSY}
        />
      </aside>
    </div>
  )
}

export function RoomConflictItem({ variant }: { variant: string }) {
  return (
    <div key={variant} className="flex w-full flex-wrap justify-center gap-6 rounded-2xl bg-background p-6">
      <Panel variant={variant} heading="볼 수 있는 일정" title="ㅇㅇㅇㅇ" />
      <Panel variant={variant} heading="남의 개인 일정" title={null} />
    </div>
  )
}
