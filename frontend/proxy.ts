import { NextResponse, type NextRequest } from "next/server"

import { hasSessionCookie } from "@/lib/auth-session"

// 페이지 가드: 세션 쿠키 존재만 확인 (로컬=dev_token, 운영=ashfield_sid).
// 없으면 /login 으로. 신원 검증은 백엔드(JWKS / 게이트웨이 /auth/me) 책임.
export function proxy(req: NextRequest) {
  const { nextUrl } = req
  if (nextUrl.pathname.startsWith("/login")) return NextResponse.next()
  if (hasSessionCookie(req.cookies)) return NextResponse.next()

  const loginUrl = new URL("/login", nextUrl)
  loginUrl.searchParams.set("callbackUrl", nextUrl.pathname + nextUrl.search)
  return NextResponse.redirect(loginUrl)
}

// 제외: API(BFF 가 자체 401, /api/public 은 비로그인), Next 정적 자원, 외부 고객용 공개 페이지
// (예약 /book, 취소 /cancel, 초대 응답 /rsvp), 아이콘·매니페스트 등 public 파일.
export const config = {
  matcher: ["/((?!api/|_next/|book/|cancel/|rsvp/|icons/|logos/|favicon|manifest-|.*\\.(?:png|ico|svg|webmanifest)$).*)"],
}
