import type { ReactNode } from "react"

import type { Part } from "@/lib/utils/activity-format"

/** 문장 조각을 그린다. 행위자, 대상, 강조는 호출자가 꾸민다 */
export function Sentence({
  parts,
  actor = (s) => s,
  target = (s) => s,
  em = (s) => s,
}: {
  parts: Part[]
  actor?: (text: string) => ReactNode
  target?: (text: string, color?: string | null) => ReactNode
  em?: (text: string) => ReactNode
}) {
  return (
    <>
      {parts.map((p, i) => {
        if (typeof p === "string") return <span key={i}>{p}</span>
        const node = p.kind === "actor" ? actor(p.text) : p.kind === "target" ? target(p.text, p.color) : em(p.text)
        return <span key={i}>{node}</span>
      })}
    </>
  )
}
