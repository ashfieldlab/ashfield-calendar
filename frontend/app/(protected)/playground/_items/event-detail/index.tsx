"use client"

import { VariantA } from "./variant-a"
import { VariantB } from "./variant-b"
import { VariantC } from "./variant-c"
import { VariantD } from "./variant-d"

export const eventDetailVariants = [
  { key: "A", name: "작은 팝오버 카드" },
  { key: "B", name: "넓은 모달 + 응답 현황" },
  { key: "C", name: "오른쪽 시트" },
  { key: "D", name: "날짜 타일 + 단축키" },
]

export function EventDetailItem({ variant }: { variant: string }) {
  return (
    <div key={variant} className="flex w-full justify-center">
      {variant === "A" && <VariantA />}
      {variant === "B" && <VariantB />}
      {variant === "C" && <VariantC />}
      {variant === "D" && <VariantD />}
    </div>
  )
}
