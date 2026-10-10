"use client"

import { DemoSeg } from "../public-booking/shared"
import { RSVP_STATES, useRsvpDemo, type RsvpState } from "./shared"
import { VariantA } from "./variant-a"
import { VariantB } from "./variant-b"
import { VariantC } from "./variant-c"

export const rsvpPageVariants = [
  { key: "A", name: "초대장 카드" },
  { key: "B", name: "분할 티켓" },
  { key: "C", name: "카드 없는 문장형" },
]

export function RsvpPageItem({ variant }: { variant: string }) {
  const d = useRsvpDemo()

  return (
    <div className="mx-auto flex max-w-[1180px] flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <DemoSeg<RsvpState> value={d.state} onChange={d.go} options={RSVP_STATES} testid="pg-rsvp-page-demo-state" />
        <span className="font-mono text-xs text-muted-foreground">
          {d.state === "cancel" || d.state === "cancelled" ? "/cancel/[token]" : "/rsvp/[token]"}
        </span>
      </div>
      <div key={variant}>
        {variant === "A" && <VariantA d={d} />}
        {variant === "B" && <VariantB d={d} />}
        {variant === "C" && <VariantC d={d} />}
      </div>
    </div>
  )
}
