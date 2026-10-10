/** 외부 고객 예약: BookingType / Booking 도메인 타입 (E-1~E-5 backend 와 매칭). */

export type BookingTypeOwner = "user" | "workspace"

export interface WeeklySchedule {
  mon?: [string, string][]
  tue?: [string, string][]
  wed?: [string, string][]
  thu?: [string, string][]
  fri?: [string, string][]
  sat?: [string, string][]
  sun?: [string, string][]
}

export interface BookingTypeResponse {
  id: string
  owner_type: BookingTypeOwner
  owner_user_sub: string | null
  owner_workspace_id: string | null
  public_key: string
  title: string
  description: string | null
  privacy_policy_url: string | null
  duration_minutes: number
  timezone: string
  weekly_schedule: WeeklySchedule
  available_from: string | null
  available_to: string | null
  minimum_notice_minutes: number
  lookahead_days: number
  target_calendar_id: string
  blocking_calendar_ids: string[]
  capacity: number
  notify_user_subs: string[]
  enabled: boolean
}

/** 목록 응답: 예약 통계 계산 필드 포함. */
export interface BookingTypeListItem extends BookingTypeResponse {
  upcoming_count: number
  next_booking_at: string | null
  last_30d_count: number
}

export interface BookingTypeListResponse {
  items: BookingTypeListItem[]
}

export interface BookingTypeCreate {
  owner_type: BookingTypeOwner
  title: string
  description?: string | null
  privacy_policy_url?: string | null
  duration_minutes: number
  timezone: string
  weekly_schedule: WeeklySchedule
  available_from?: string | null
  available_to?: string | null
  minimum_notice_minutes: number
  lookahead_days: number
  target_calendar_id: string
  blocking_calendar_ids: string[]
  capacity: number
  notify_user_subs: string[]
}

export interface BookingRow {
  id: string
  slot_start_at: string
  slot_end_at: string
  customer_name: string | null
  customer_email: string | null
  customer_message: string | null
  status: "active" | "cancelled"
  cancelled_at: string | null
  created_at: string
}

export interface BookingListResponse {
  items: BookingRow[]
}

/** 운영자 슬롯 (GET /booking-types/{id}/slots): 마감 칸 포함. */
export interface OperatorSlot {
  start_at: string
  end_at: string
  remaining: number
  open: boolean
}

export interface OperatorSlotListResponse {
  slots: OperatorSlot[]
}
