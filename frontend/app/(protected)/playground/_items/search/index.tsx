"use client"

import { VariantA } from "./variant-a"
import { VariantB } from "./variant-b"
import { VariantC } from "./variant-c"

export const searchVariants = [
  { key: "A", name: "커맨드 팔레트" },
  { key: "B", name: "날짜별 그룹" },
  { key: "C", name: "필터 칩 + 카드" },
]

export function SearchItem({ variant }: { variant: string }) {
  return (
    <div key={variant} className="flex w-full justify-center">
      {variant === "A" && <VariantA />}
      {variant === "B" && <VariantB />}
      {variant === "C" && <VariantC />}
    </div>
  )
}
