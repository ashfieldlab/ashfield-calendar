import { getSessionCookie } from "better-auth/cookies"
import { NextResponse, type NextRequest } from "next/server"

import { AUTH_COOKIE_PREFIX } from "@/lib/env"

// 페이지 가드(낙관적): Better Auth 세션 쿠키 존재만 확인하고, 없으면 /login 으로.
// 세션 유효성은 (protected) 레이아웃이 서버에서 다시 확인하고, API 신원은 백엔드가 JWT 로 검증.
export function proxy(req: NextRequest) {
  const { nextUrl } = req
  if (nextUrl.pathname.startsWith("/login")) return NextResponse.next()
  if (getSessionCookie(req, { cookiePrefix: AUTH_COOKIE_PREFIX })) return NextResponse.next()

  const loginUrl = new URL("/login", nextUrl)
  loginUrl.searchParams.set("callbackUrl", nextUrl.pathname + nextUrl.search)
  return NextResponse.redirect(loginUrl)
}

// 제외: API(BFF 가 자체 401, /api/public 은 비로그인), Next 정적 자원, 외부 고객용 공개 페이지
// (예약 /book, 취소 /cancel, 초대 응답 /rsvp), 아이콘·매니페스트 등 public 파일.
export const config = {
  matcher: ["/((?!api/|_next/|book/|cancel/|rsvp/|icons/|logos/|favicon|manifest-|.*\\.(?:png|ico|svg|webmanifest)$).*)"],
}
