"use client"

// 플레이그라운드: 초대 응답(/rsvp/[token])과 예약 취소(/cancel/[token]) 공개 페이지. 가짜 데이터만 쓴다.

import { useState } from "react"

import { formatDay, formatTime } from "../_mock"

export type RsvpState = "pending" | "accepted" | "declined" | "cancel" | "cancelled" | "invalid"
export type RsvpResponse = "accepted" | "tentative" | "declined"

export const RSVP_STATES: { key: RsvpState; name: string }[] = [
  { key: "pending", name: "응답 전" },
  { key: "accepted", name: "수락함" },
  { key: "declined", name: "거절함" },
  { key: "cancel", name: "취소 확인" },
  { key: "cancelled", name: "취소됨" },
  { key: "invalid", name: "잘못된 링크" },
]

export const RESPONSE_LABEL: Record<RsvpResponse, string> = {
  accepted: "참석",
  tentative: "미정",
  declined: "불참",
}

export const RESPONSES: RsvpResponse[] = ["accepted", "tentative", "declined"]

export const INVITE = {
  title: "하반기 파트너 세미나",
  organization: "Ashfield Lab",
  start: new Date(2026, 9, 21, 14, 0).toISOString(),
  end: new Date(2026, 9, 21, 16, 0).toISOString(),
  location: "서울 강남구 테헤란로 152, 12층 세미나실",
  inviteeEmail: "garam@hanbit.example.com",
}

/** 취소 페이지용 예약. 원본 취소 페이지는 예약 정보를 보여주지 않는다 (조회 API 없음). */
export const BOOKED = {
  title: "도입 상담",
  organization: "Ashfield Lab",
  start: new Date(2026, 9, 16, 11, 0).toISOString(),
  end: new Date(2026, 9, 16, 11, 30).toISOString(),
  customerEmail: "garam@hanbit.example.com",
}

/** 10월 21일 (수) 오후 2:00 ~ 오후 4:00 */
export const rangeLabel = (start: string, end: string) => `${formatDay(start)} ${formatTime(start)} ~ ${formatTime(end)}`

export const isCancelPage = (s: RsvpState) => s === "cancel" || s === "cancelled"

export function useRsvpDemo() {
  const [state, setState] = useState<RsvpState>("pending")
  const [response, setResponse] = useState<RsvpResponse | null>(null)
  const [busy, setBusy] = useState<RsvpResponse | "cancel" | null>(null)

  return {
    state,
    response,
    busy,
    /** 전환기에서 상태 바꾸기 */
    go: (s: RsvpState) => {
      setState(s)
      if (s === "accepted") setResponse((r) => (r === "tentative" ? r : "accepted"))
      else if (s === "declined") setResponse("declined")
      else if (s === "pending") setResponse(null)
    },
    respond: (r: RsvpResponse, onDone?: () => void) => {
      if (busy) return
      setBusy(r)
      window.setTimeout(() => {
        setBusy(null)
        setResponse(r)
        setState(r === "declined" ? "declined" : "accepted")
        onDone?.()
      }, 500)
    },
    confirmCancel: () => {
      if (busy) return
      setBusy("cancel")
      window.setTimeout(() => {
        setBusy(null)
        setState("cancelled")
      }, 700)
    },
  }
}

export type RsvpDemo = ReturnType<typeof useRsvpDemo>
