"use client"

import { VariantA } from "./variant-a"
import { VariantB } from "./variant-b"
import { VariantC } from "./variant-c"
import { VariantD } from "./variant-d"

export const bookingTypesVariants = [
  { key: "A", name: "다듬은 표 + QR 모달" },
  { key: "B", name: "카드 격자" },
  { key: "C", name: "목록 + 공유 패널" },
  { key: "D", name: "소유별 묶음, 펼치는 줄" },
]

export function BookingTypesItem({ variant }: { variant: string }) {
  return (
    <div key={variant}>
      {variant === "A" && <VariantA />}
      {variant === "B" && <VariantB />}
      {variant === "C" && <VariantC />}
      {variant === "D" && <VariantD />}
    </div>
  )
}
