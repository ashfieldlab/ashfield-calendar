/** /api/v1/me/activity (backend/app/api/v1/activity.py) */

export interface ActivityItem {
  id: string
  /** 공개 라우트(손님)와 시스템은 null */
  actor_sub: string | null
  actor_name: string | null
  actor_type: "user" | "public" | "system" | string
  action: string
  entity_type: string
  entity_id: string
  meta: Record<string, unknown>
  created_at: string
}

export interface ActivityResponse {
  items: ActivityItem[]
}
