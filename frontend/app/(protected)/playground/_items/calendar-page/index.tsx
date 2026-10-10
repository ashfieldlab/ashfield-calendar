"use client"

import { VariantA } from "./variant-a"
import { VariantB } from "./variant-b"
import { VariantC } from "./variant-c"
import { VariantD } from "./variant-d"

export const calendarPageVariants = [
  { key: "A", name: "왼쪽 패널 + 큰 달력" },
  { key: "B", name: "아젠다 + 작은 달력" },
  { key: "C", name: "주간 시간표 + 빠른 추가" },
  { key: "D", name: "A + 큰 날짜, 미니 달력 없음" },
]

export function CalendarPageItem({ variant }: { variant: string }) {
  return (
    <div key={variant} className="h-full">
      {variant === "A" && <VariantA />}
      {variant === "B" && <VariantB />}
      {variant === "C" && <VariantC />}
      {variant === "D" && <VariantD />}
    </div>
  )
}
