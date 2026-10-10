// 앱 정의 (ashfield-calendar = 일정 앱 단독).
export const APP = {
  id: "calendar",
  title: "일정",
  home: "/calendar",
  // 활동 필터용 audit entity_type (이 앱 소유 이벤트만 활동 내역에 노출)
  entityTypes: ["calendar", "event", "booking", "booking_type", "caldav_token"],
} as const
