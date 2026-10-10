import type { Metadata } from "next"

import { ActiveCompanyGate } from "@/components/layout/active-company-gate"
import { AppShell } from "@/components/layout/app-shell"

// 모든 protected 페이지는 로그인 사용자 데이터 기반 — static prerender 의미 없음.
// useSearchParams 같은 client hook 쓰는 페이지가 prerender 시 Suspense 필요 에러를
// 일으키므로 dynamic 강제 (Next.js 16 build error 회피).
export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "일정 - Ashfield",
  manifest: "/manifest-calendar.webmanifest",
  icons: {
    icon: [
      { url: "/icons/ashfield/favicon.ico", sizes: "any" },
      { url: "/icons/ashfield/favicon_32.png", type: "image/png", sizes: "32x32" },
      { url: "/icons/ashfield/favicon_16.png", type: "image/png", sizes: "16x16" },
      { url: "/icons/ashfield/appicon_192.png", type: "image/png", sizes: "192x192" },
      { url: "/icons/ashfield/appicon_512.png", type: "image/png", sizes: "512x512" },
    ],
    apple: [{ url: "/icons/ashfield/apple-touch-icon.png", sizes: "180x180" }],
  },
}

// 인증 가드는 proxy.ts(세션 쿠키 존재), 신원은 /api/v1/me.
//
// ActiveCompanyGate — activeCompanyId 부트스트랩 끝나야 children 렌더. 안 그러면
// useApiGet 가 X-Active-Company-Id 헤더 없이 발사돼 422.
export default function ProtectedLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div data-testid="protected-main">
      <AppShell>
        <ActiveCompanyGate>{children}</ActiveCompanyGate>
      </AppShell>
    </div>
  )
}
