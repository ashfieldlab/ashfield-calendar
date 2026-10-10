"use client"

import { useState } from "react"
import { RotateCcw } from "lucide-react"

import { DemoSeg, type Scenario } from "./shared"
import { RescheduleStageA, VariantA } from "./variant-a"
import { RescheduleStageB, VariantB } from "./variant-b"
import { RescheduleStageC, VariantC } from "./variant-c"

export const publicBookingVariants = [
  { key: "A", name: "3단 카드 (Calendly식)" },
  { key: "B", name: "모바일 단계형" },
  { key: "C", name: "주간 슬롯 격자" },
]

type Mode = "book" | "reschedule"

const T = "pg-public-booking"

export function PublicBookingItem({ variant }: { variant: string }) {
  const [mode, setMode] = useState<Mode>("book")
  const [scenario, setScenario] = useState<Scenario>("ok")
  const [nonce, setNonce] = useState(0)

  return (
    <div className="mx-auto flex max-w-[1180px] flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <DemoSeg
          value={mode}
          onChange={setMode}
          options={[
            { key: "book", name: "예약 페이지" },
            { key: "reschedule", name: "일정 변경 모달" },
          ]}
          testid={`${T}-demo-mode`}
        />
        {mode === "book" && (
          <DemoSeg
            value={scenario}
            onChange={setScenario}
            options={[
              { key: "ok", name: "정상" },
              { key: "empty", name: "빈 슬롯" },
              { key: "error", name: "잘못된 링크" },
            ]}
            testid={`${T}-demo-scenario`}
          />
        )}
        <button
          type="button"
          onClick={() => setNonce((n) => n + 1)}
          data-testid={`${T}-demo-reset-button`}
          className="inline-flex items-center gap-1 rounded-full border border-dashed border-muted-foreground/40 px-2.5 py-1 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <RotateCcw className="size-3" />
          처음부터
        </button>
      </div>

      <div key={`${variant}-${mode}-${scenario}-${nonce}`}>
        {mode === "book" ? (
          <>
            {variant === "A" && <VariantA scenario={scenario} />}
            {variant === "B" && <VariantB scenario={scenario} />}
            {variant === "C" && <VariantC scenario={scenario} />}
          </>
        ) : (
          <>
            {variant === "A" && <RescheduleStageA />}
            {variant === "B" && <RescheduleStageB />}
            {variant === "C" && <RescheduleStageC />}
          </>
        )}
      </div>
    </div>
  )
}
