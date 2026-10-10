"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

import { EMPTY_DRAFT, SAMPLE_DRAFT } from "./shared"
import { VariantA } from "./variant-a"
import { VariantB } from "./variant-b"
import { VariantC } from "./variant-c"

export const bookingTypeFormVariants = [
  { key: "A", name: "한 페이지 섹션형" },
  { key: "B", name: "단계 내비 + 미리보기" },
  { key: "C", name: "탭형 + 칠하는 주간 격자" },
]

export function BookingTypeFormItem({ variant }: { variant: string }) {
  const [mode, setMode] = useState<"edit" | "new">("edit")
  const props = { initial: mode === "new" ? EMPTY_DRAFT : SAMPLE_DRAFT, isNew: mode === "new" }
  return (
    <div>
      <div className="mb-4 flex justify-end">
        <div className="inline-flex rounded-lg bg-muted p-0.5 text-xs">
          {(["edit", "new"] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={cn("rounded-md px-2.5 py-1", mode === m ? "bg-background font-medium shadow-sm" : "text-muted-foreground")}
              data-testid={`pg-booking-type-form-mode-${m}`}
            >
              {m === "edit" ? "편집" : "새 양식"}
            </button>
          ))}
        </div>
      </div>
      <div key={`${variant}-${mode}`}>
        {variant === "A" && <VariantA {...props} />}
        {variant === "B" && <VariantB {...props} />}
        {variant === "C" && <VariantC {...props} />}
      </div>
    </div>
  )
}
