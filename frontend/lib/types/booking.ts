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

export interface BookingTypeListResponse {
  items: BookingTypeResponse[]
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
