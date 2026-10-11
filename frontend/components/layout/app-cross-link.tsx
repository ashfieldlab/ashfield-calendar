"use client"

import { Folder } from "lucide-react"

import { env } from "@/lib/env"

// 파일 앱(ashfield-drive)으로 가는 은근한 링크. 다른 origin 이라 <a>(풀 페이지 이동). URL(env) 없으면 숨김.
export function AppCrossLink() {
  if (!env.driveUrl) return null
  return (
    <a
      href={env.driveUrl}
      data-testid="app-cross-link"
      title="파일 앱으로 이동"
      className="inline-flex items-center gap-1.5 rounded px-2 py-1 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
    >
      <Folder size={16} />
      <span className="hidden sm:inline">파일</span>
    </a>
  )
}
