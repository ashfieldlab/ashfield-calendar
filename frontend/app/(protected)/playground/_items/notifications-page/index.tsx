"use client"

import { VariantA } from "./variant-a"
import { VariantB } from "./variant-b"
import { VariantC } from "./variant-c"

export const notificationsPageVariants = [
  { key: "A", name: "받은편지함 2단" },
  { key: "B", name: "카드 + 바로 응답" },
  { key: "C", name: "종 팝오버 중심" },
]

export function NotificationsPageItem({ variant }: { variant: string }) {
  return (
    <div key={variant}>
      {variant === "A" && <VariantA />}
      {variant === "B" && <VariantB />}
      {variant === "C" && <VariantC />}
    </div>
  )
}
