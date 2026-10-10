"use client"

import { useAppContext } from "@/components/providers/app-context"
import { useApiGet } from "@/lib/hooks/use-api"
import type { CalendarListResponse } from "@/lib/types/api"

import { CalendarList } from "./calendar-list"

/**
 * 앱 사이드바 아래에 붙는 캘린더 목록 (일정 화면에서만).
 * 사이드바는 ActiveWorkspaceGate 바깥이라, 활성 워크스페이스가 정해진 뒤에만 요청한다.
 */
export function CalendarSidebar() {
  const { bootstrapped, activeWorkspaceId } = useAppContext()
  const ready = bootstrapped && !!activeWorkspaceId
  const { data } = useApiGet<CalendarListResponse>(ready ? "/api/v1/calendars" : null)
  if (!ready) return null
  return <CalendarList calendars={data?.calendars ?? []} />
}
