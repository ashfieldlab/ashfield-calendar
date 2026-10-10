/** /api/v1/search 응답 (backend app/api/v1/search.py) */

export type SearchMatchedField = "title" | "location" | "description"

export interface SearchEventItem {
  id: string
  calendar_id: string
  title: string
  description: string | null
  location: string | null
  start_at: string
  end_at: string
  all_day?: boolean
  is_recurring?: boolean
  /** 검색어가 맞은 곳 (제목 우선, 다음 장소, 설명) */
  matched_field?: SearchMatchedField
  calendar_name?: string | null
  calendar_color?: string | null
}

export interface SearchResponse {
  events: SearchEventItem[]
}
