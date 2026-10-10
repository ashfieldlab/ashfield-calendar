"use client"

import { VariantA } from "./variant-a"
import { VariantB } from "./variant-b"
import { VariantC } from "./variant-c"

export const activityPageVariants = [
  { key: "A", name: "날짜별 타임라인 + 문장" },
  { key: "B", name: "달력으로 찾기" },
  { key: "C", name: "일정별 묶음" },
]

export function ActivityPageItem({ variant }: { variant: string }) {
  return (
    <div key={variant}>
      {variant === "A" && <VariantA />}
      {variant === "B" && <VariantB />}
      {variant === "C" && <VariantC />}
    </div>
  )
}
