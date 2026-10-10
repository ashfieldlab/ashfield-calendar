import type { ComponentType } from "react"

import { CalendarPageItem, calendarPageVariants } from "./calendar-page"
import { CalendarStyleItem, calendarStyleVariants } from "./calendar-style"
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
    slug: "calendar-page",
    title: "일정 메인",
    group: "페이지",
    stage: "page",
    variants: calendarPageVariants,
    Component: CalendarPageItem,
  },
  {
    slug: "calendar-style",
    title: "달력 스타일",
    group: "페이지",
    stage: "page",
    variants: calendarStyleVariants,
    Component: CalendarStyleItem,
  },
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
