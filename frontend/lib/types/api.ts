/**
 * 백엔드 API 응답 타입: Pydantic 스키마와 1:1 매핑.
 *
 * CalendarResponse / EventResponse 등.
 */

export interface MeResponse {
  sub: string
  email: string
  name: string | null
  groups: string[]
  roles: string[]
  is_system_admin: boolean
}

// --- Phase 1c: Calendars / Events ---

export type CalendarScope = "personal" | "shared"
export type CalendarSource = "native" | "external_ics"

export interface CalendarResponse {
  id: string
  workspace_id: string
  owner_id: string
  scope: CalendarScope
  source: CalendarSource
  name: string
  description: string | null
  color: string
  // 시스템 관리형(공휴일 등): 편집·삭제 불가, 숨김만 가능.
  managed: boolean
  external_ics_url: string | null
  external_ics_refresh_at: string | null
  hidden: boolean
  color_override: string | null
}

export interface CalendarListResponse {
  calendars: CalendarResponse[]
}

export interface EventOccurrence {
  event_id: string
  calendar_id: string
  title: string
  description: string | null
  location: string | null
  start_at: string
  end_at: string
  all_day: boolean
  timezone: string
  is_recurring: boolean
  /** 예약 기능으로 생성된 이벤트면 booking.id (캘린더 UI 는 readonly). */
  booking_id: string | null
}

export interface OccurrenceListResponse {
  occurrences: EventOccurrence[]
}

// --- Phase 1.5c: Event invitations ---

export type InvitationResponse = "pending" | "accepted" | "declined" | "tentative"

export interface EventInvitationResponseDto {
  id: string
  event_id: string
  // 외부 게스트(이메일 초대)는 null.
  invitee_sub: string | null
  invitee_email: string | null
  invitee_name: string | null
  // 계정 없는 외부 게스트 여부 (이메일 + RSVP 토큰).
  external: boolean
  response: InvitationResponse
  responded_at: string | null
  created_at: string
}

export interface EventInvitationList {
  invitations: EventInvitationResponseDto[]
}

// --- Phase 3a: Notifications ---

export interface NotificationResponse {
  id: string
  type: string
  actor_sub: string | null
  actor_name: string | null
  entity_type: string
  entity_id: string
  payload: Record<string, unknown>
  read_at: string | null
  created_at: string
}

export interface NotificationListResponse {
  notifications: NotificationResponse[]
  unread_count: number
  has_more?: boolean
}

export interface EmailPreferenceResponse {
  email_enabled: boolean
  // 카테고리별 이메일 on/off. 키 없으면 on(기본). 카테고리: file_share|event|booking
  email_categories: Record<string, boolean>
}

// --- Phase 4: workspace members ---

export interface WorkspaceMember {
  sub: string
  email: string
  name: string | null
}

export interface WorkspaceMembersResponse {
  members: WorkspaceMember[]
}

export interface EventResponse {
  id: string
  calendar_id: string
  title: string
  description: string | null
  location: string | null
  start_at: string
  end_at: string
  all_day: boolean
  timezone: string
  rrule: string | null
  recurrence_exceptions: string[]
  /** 시작 N분 전 in-app 알림. null = 알림 꺼짐. */
  reminder_minutes_before: number | null
  /** 회의실(Room) 참조. null = 미지정. */
  room_id: string | null
  created_by_sub: string
  /** 예약 기능으로 생성된 이벤트면 booking.id. */
  booking_id: string | null
}

/** 회의실(Room): 워크스페이스 예약 리소스 (ADR-0019). */
export interface Room {
  id: string
  name: string
  capacity: number | null
  created_at: string
}

export interface RoomListResponse {
  rooms: Room[]
}

// 참석자 일정 겹침: 업무 일정끼리만, 겹치는 사람만 (제목 없음)
export interface AttendeeConflictsResponse {
  conflicts: { sub: string; name: string | null }[]
}
