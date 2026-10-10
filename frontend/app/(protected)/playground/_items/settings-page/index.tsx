"use client"

import { VariantA } from "./variant-a"
import { VariantB } from "./variant-b"
import { VariantC } from "./variant-c"

export const settingsPageVariants = [
  { key: "A", name: "왼쪽 내비 + 섹션" },
  { key: "B", name: "한 페이지 카드" },
  { key: "C", name: "탭 + 기기 카드" },
]

export function SettingsPageItem({ variant }: { variant: string }) {
  return (
    <div key={variant} className="h-full">
      {variant === "A" && <VariantA />}
      {variant === "B" && <VariantB />}
      {variant === "C" && <VariantC />}
    </div>
  )
}
