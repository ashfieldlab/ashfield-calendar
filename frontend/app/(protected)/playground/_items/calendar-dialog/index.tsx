"use client"

import { VariantA } from "./variant-a"
import { VariantB } from "./variant-b"
import { VariantC } from "./variant-c"

export const calendarDialogVariants = [
  { key: "A", name: "한 화면, 위 탭" },
  { key: "B", name: "종류 먼저 고르기" },
  { key: "C", name: "미리보기 2단" },
]

export function CalendarDialogItem({ variant }: { variant: string }) {
  return (
    <div key={variant} className="flex w-full justify-center">
      {variant === "A" && <VariantA />}
      {variant === "B" && <VariantB />}
      {variant === "C" && <VariantC />}
    </div>
  )
}
