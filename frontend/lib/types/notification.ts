/** /api/v1/notifications 의 알림별 컨텍스트 (backend/app/schemas/notification.py) */

import type { NotificationResponse } from "@/lib/types/api"

export interface NotificationEventContext {
  id: string
  title: string
  start_at: string
  end_at: string
  all_day: boolean
  location: string | null
  calendar_id: string
  /** 남의 개인 캘린더면 null */
  calendar_name: string | null
  calendar_color: string | null
  deleted: boolean
}

export type RsvpResponse = "accepted" | "tentative" | "declined"

export interface NotificationInvitationContext {
  id: string
  event_id: string
  response: RsvpResponse | "pending"
}

export interface NotificationBookingContext {
  id: string
  booking_type_id: string
  status: "active" | "cancelled" | string
  slot_start_at: string
  slot_end_at: string
  customer_name: string | null
  customer_email: string | null
  calendar_event_id: string | null
}

export interface NotificationItem extends NotificationResponse {
  event?: NotificationEventContext | null
  invitation?: NotificationInvitationContext | null
  booking?: NotificationBookingContext | null
}

export interface NotificationItemList {
  notifications: NotificationItem[]
  unread_count: number
  has_more?: boolean
}
