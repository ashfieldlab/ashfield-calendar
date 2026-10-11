import type { ComponentType } from "react";

import { CalendarPageItem, calendarPageVariants } from "./calendar-page";
import { CalendarStyleItem, calendarStyleVariants } from "./calendar-style";
import { EventDialogItem, eventDialogVariants } from "./event-dialog";
import { EventDetailItem, eventDetailVariants } from "./event-detail";
import { SearchItem, searchVariants } from "./search";
import { ActivityPageItem, activityPageVariants } from "./activity-page";
import {
  NotificationsPageItem,
  notificationsPageVariants,
} from "./notifications-page";
import { PublicBookingItem, publicBookingVariants } from "./public-booking";
import { RsvpPageItem, rsvpPageVariants } from "./rsvp-page";
import { BookingTypesItem, bookingTypesVariants } from "./booking-types";
import {
  BookingTypeFormItem,
  bookingTypeFormVariants,
} from "./booking-type-form";
import { SettingsPageItem, settingsPageVariants } from "./settings-page";
import { CalendarDialogItem, calendarDialogVariants } from "./calendar-dialog";
import { CalendarShareItem, calendarShareVariants } from "./calendar-share";
import { RoomConflictItem, roomConflictVariants } from "./room-conflict";

export interface PlaygroundVariant {
  key: string;
  name: string;
}

export interface PlaygroundItem {
  slug: string;
  title: string;
  group: string;
  /** 모달처럼 화면 가운데 어두운 배경 위에 띄울지 */
  stage: "modal" | "page";
  variants: PlaygroundVariant[];
  Component: ComponentType<{ variant: string }>;
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
  {
    slug: "event-detail",
    title: "일정 상세",
    group: "모달",
    stage: "modal",
    variants: eventDetailVariants,
    Component: EventDetailItem,
  },
  {
    slug: "search",
    title: "검색",
    group: "모달",
    stage: "modal",
    variants: searchVariants,
    Component: SearchItem,
  },
  {
    slug: "booking-types",
    title: "예약 양식 목록",
    group: "페이지",
    stage: "page",
    variants: bookingTypesVariants,
    Component: BookingTypesItem,
  },
  {
    slug: "booking-type-form",
    title: "예약 양식 편집",
    group: "페이지",
    stage: "page",
    variants: bookingTypeFormVariants,
    Component: BookingTypeFormItem,
  },
  {
    slug: "public-booking",
    title: "공개 예약",
    group: "페이지",
    stage: "page",
    variants: publicBookingVariants,
    Component: PublicBookingItem,
  },
  {
    slug: "rsvp-page",
    title: "초대 응답, 예약 취소",
    group: "페이지",
    stage: "page",
    variants: rsvpPageVariants,
    Component: RsvpPageItem,
  },
  {
    slug: "activity-page",
    title: "활동 내역",
    group: "페이지",
    stage: "page",
    variants: activityPageVariants,
    Component: ActivityPageItem,
  },
  {
    slug: "notifications-page",
    title: "알림",
    group: "페이지",
    stage: "page",
    variants: notificationsPageVariants,
    Component: NotificationsPageItem,
  },
  {
    slug: "settings-page",
    title: "설정",
    group: "페이지",
    stage: "page",
    variants: settingsPageVariants,
    Component: SettingsPageItem,
  },
  {
    slug: "calendar-dialog",
    title: "새 캘린더",
    group: "모달",
    stage: "modal",
    variants: calendarDialogVariants,
    Component: CalendarDialogItem,
  },
  {
    slug: "calendar-share",
    title: "캘린더 설정",
    group: "모달",
    stage: "modal",
    variants: calendarShareVariants,
    Component: CalendarShareItem,
  },
  {
    slug: "room-conflict",
    title: "회의실 겹침",
    group: "모달",
    stage: "modal",
    variants: roomConflictVariants,
    Component: RoomConflictItem,
  },
];

export function findPlaygroundItem(slug: string) {
  return PLAYGROUND_ITEMS.find((i) => i.slug === slug);
}
