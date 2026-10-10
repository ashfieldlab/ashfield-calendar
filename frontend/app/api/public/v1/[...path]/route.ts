/**
 * 공개(비인증) BFF Proxy: `/api/public/v1/*` → 백엔드로 forward.
 *
 *   - JWT 없음 (ADR-0011 카브-아웃)
 *   - 클라이언트 IP 를 x-forwarded-for 헤더로 백엔드에 전달 (rate limit 키)
 *   - X-Active-Workspace-Id 미설정 (공개 라우트는 워크스페이스 컨텍스트 무관)
 */

import { NextRequest, NextResponse } from "next/server"

const BACKEND_URL = (
  process.env.BACKEND_INTERNAL_URL || "http://localhost:8100"
).replace(/\/$/, "")

async function proxy(
  req: NextRequest,
  ctx: { params: Promise<{ path: string[] }> },
): Promise<Response> {
  const { path } = await ctx.params
  const targetPath = `/api/public/v1/${path.join("/")}`
  const targetUrl = new URL(targetPath, BACKEND_URL)
  targetUrl.search = req.nextUrl.search

  const headers = new Headers()

  // 백엔드가 rate limit per IP 키로 쓰는 헤더: 우리가 명시적으로 채워줘야
  const incomingXff = req.headers.get("x-forwarded-for")
  // Next.js 가 forwarded 헤더 안 채우면 req.ip 가 NextRequest 에 있을 수 있음 (런타임 의존).
  // 가장 안전한 값: 들어온 xff → 그대로, 없으면 비워둠 (백엔드 ip=unknown 처리).
  if (incomingXff) headers.set("x-forwarded-for", incomingXff)

  const contentType = req.headers.get("content-type")
  if (contentType) headers.set("Content-Type", contentType)

  const ua = req.headers.get("user-agent")
  if (ua) headers.set("User-Agent", ua)

  const xRequestId = req.headers.get("x-request-id")
  if (xRequestId) headers.set("X-Request-ID", xRequestId)

  const hasBody = !["GET", "HEAD"].includes(req.method)
  const body = hasBody ? await req.arrayBuffer() : undefined

  let upstream: Response
  try {
    upstream = await fetch(targetUrl.toString(), {
      method: req.method,
      headers,
      body,
      cache: "no-store",
    })
  } catch (err) {
    console.error("[bff-public] backend unreachable", {
      target: targetUrl.toString(),
      method: req.method,
      error: (err as Error).message,
    })
    return NextResponse.json(
      { detail: `Backend unreachable (${BACKEND_URL}).`, target: BACKEND_URL },
      { status: 502, headers: { "Cache-Control": "no-store" } },
    )
  }

  const resHeaders = new Headers()
  const resCt = upstream.headers.get("content-type")
  if (resCt) resHeaders.set("content-type", resCt)
  resHeaders.set("Cache-Control", "no-store, must-revalidate")

  return new NextResponse(upstream.body, {
    status: upstream.status,
    headers: resHeaders,
  })
}

export const GET = proxy
export const POST = proxy
export const PUT = proxy
export const PATCH = proxy
export const DELETE = proxy
