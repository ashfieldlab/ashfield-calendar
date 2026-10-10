/**
 * 알림 타입별 사용자 친화 문장 + 링크.
 *
 * 백엔드 payload 의 raw 필드를 받아 "관리자가 'LICENSE.txt'을(를) 공유했습니다" 같은
 * 한 줄 카피로 변환. 모르는 type 은 fallback.
 */

import type { NotificationResponse } from "@/lib/types/api"

interface RenderedNotification {
  /** 한 줄 제목: 무엇이 일어났는지. */
  title: string
  /** 한 줄 부연: 대상의 이름, 시간, 세부. 없으면 빈 문자열. */
  subtitle: string
  /** 클릭 시 이동할 URL. */
  href: string
}

const RESPONSE_LABEL: Record<string, string> = {
  accepted: "수락",
  declined: "거절",
  tentative: "미정",
  pending: "대기",
}

function actor(n: NotificationResponse): string {
  return n.actor_name || n.actor_sub || "시스템"
}

export function renderNotification(
  n: NotificationResponse,
): RenderedNotification {
  const p = n.payload as Record<string, string | number | undefined>
  const who = actor(n)

  switch (n.type) {
    case "event_invited": {
      const title = (p.title as string) || "일정"
      const start = p.start_at
        ? new Date(String(p.start_at)).toLocaleString("ko-KR", {
            month: "long",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })
        : ""
      return {
        title: `${who}님이 일정에 초대했습니다`,
        subtitle: start ? `${title}, ${start}` : title,
        href: "/calendar",
      }
    }
    case "event_invitation_response": {
      const title = (p.title as string) || "일정"
      const resp = RESPONSE_LABEL[String(p.response ?? "")] ?? "응답"
      return {
        title: `${who}님이 ${resp}했습니다`,
        subtitle: title,
        href: "/calendar",
      }
    }
    case "event_reminder": {
      const title = (p.title as string) || "일정"
      const mins = Number(p.minutes_before ?? 0)
      const start = p.occurrence_start
        ? new Date(String(p.occurrence_start)).toLocaleString("ko-KR", {
            month: "long",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })
        : ""
      return {
        title: `일정 시작 ${mins}분 전`,
        subtitle: start ? `${title}, ${start}` : title,
        href: "/calendar",
      }
    }
    case "booking_received": {
      const title = (p.title as string) || "예약"
      const name = (p.customer_name as string) || "고객"
      const slot = (p.slot_start_local as string) || ""
      const btId = (p.booking_type_id as string) || ""
      return {
        title: `새 예약: ${title}`,
        subtitle: slot ? `${name}, ${slot}` : name,
        href: btId ? `/booking-types/${btId}` : "/booking-types",
      }
    }
    case "booking_rescheduled": {
      const title = (p.title as string) || "예약"
      const name = (p.customer_name as string) || "고객"
      const newSlot = (p.new_slot_local as string) || ""
      const btId = (p.booking_type_id as string) || ""
      return {
        title: `예약 시간 변경: ${title}`,
        subtitle: newSlot ? `${name}, ${newSlot}` : name,
        href: btId ? `/booking-types/${btId}` : "/booking-types",
      }
    }
    case "booking_cancelled": {
      const title = (p.title as string) || "예약"
      const name = (p.customer_name as string) || "고객"
      const slot = (p.slot_start_local as string) || ""
      const btId = (p.booking_type_id as string) || ""
      return {
        title: `예약 취소: ${title}`,
        subtitle: slot ? `${name}, ${slot}` : name,
        href: btId ? `/booking-types/${btId}` : "/booking-types",
      }
    }
    default:
      return {
        title: n.type,
        subtitle: JSON.stringify(p).slice(0, 80),
        href: linkForEntity(n.entity_type),
      }
  }
}

function linkForEntity(entityType: string): string {
  return entityType === "booking" ? "/booking-types" : "/calendar"
}
