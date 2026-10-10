import type { ComponentType } from "react"

import { EventDialogItem, eventDialogVariants } from "./event-dialog"

export interface PlaygroundVariant {
  key: string
  name: string
}

export interface PlaygroundItem {
  slug: string
  title: string
  group: string
  /** 모달처럼 화면 가운데 어두운 배경 위에 띄울지 */
  stage: "modal" | "page"
  variants: PlaygroundVariant[]
  Component: ComponentType<{ variant: string }>
}

/** 새 항목은 _items/<slug>/ 에 만들고 여기에 한 줄 추가한다. */
export const PLAYGROUND_ITEMS: PlaygroundItem[] = [
  {
    slug: "event-dialog",
    title: "새 일정",
    group: "모달",
    stage: "modal",
    variants: eventDialogVariants,
    Component: EventDialogItem,
  },
]

export function findPlaygroundItem(slug: string) {
  return PLAYGROUND_ITEMS.find((i) => i.slug === slug)
}
