"use client"

import { VariantA } from "./variant-a"
import { VariantB } from "./variant-b"
import { VariantC } from "./variant-c"

export const calendarShareVariants = [
  { key: "A", name: "Drive 카드 + 스위치" },
  { key: "B", name: "탭 + 상태 띠" },
  { key: "C", name: "사이드바 메뉴 팝오버" },
]

export function CalendarShareItem({ variant }: { variant: string }) {
  return (
    <div key={variant} className="flex w-full justify-center">
      {variant === "A" && <VariantA />}
      {variant === "B" && <VariantB />}
      {variant === "C" && <VariantC />}
    </div>
  )
}
