import type { ReactNode } from "react"
import { Link2Off } from "lucide-react"

import { cn } from "@/lib/utils"

/** 공개 초대장, 예약 취소 카드: 브랜드 색 머리 + 날짜 타일 */
export function TicketCard({ children, testid }: { children: ReactNode; testid: string }) {
  return (
    <div className="w-full max-w-md overflow-hidden rounded-2xl border bg-card shadow-sm" data-testid={testid}>
      {children}
    </div>
  )
}

export function TicketHead({ org, title, struck }: { org: string; title: string; struck?: boolean }) {
  return (
    <div className="bg-primary px-6 pt-6 pb-10 text-primary-foreground">
      <p className="text-xs opacity-75">{org}</p>
      <h1 className={cn("mt-1 text-xl font-bold break-keep", struck && "line-through opacity-70")}>{title}</h1>
    </div>
  )
}

export function DateTile({ iso, muted }: { iso: string; muted?: boolean }) {
  const t = new Date(iso)
  return (
    <div className={cn("w-16 shrink-0 overflow-hidden rounded-xl border bg-card text-center shadow-sm", muted && "opacity-60")}>
      <p className="bg-primary/10 py-0.5 text-[11px] font-semibold text-primary dark:bg-primary/20 dark:text-foreground">
        {t.getMonth() + 1}월
      </p>
      <p className="py-1.5 text-2xl leading-none font-bold">{t.getDate()}</p>
    </div>
  )
}

export function InvalidLinkCard({ testid }: { testid: string }) {
  return (
    <div className="w-full max-w-sm rounded-2xl border bg-card p-8 text-center shadow-sm" data-testid={testid}>
      <div className="mx-auto mb-4 grid size-12 place-items-center rounded-full bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400">
        <Link2Off className="size-5" />
      </div>
      <h1 className="font-semibold">링크를 열 수 없습니다</h1>
      <p className="mt-1 text-sm text-muted-foreground">만료되었거나 취소된 일정</p>
    </div>
  )
}

export function ErrorLine({ message, testid }: { message: string; testid: string }) {
  return (
    <p
      className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:bg-rose-950/40 dark:text-rose-300"
      data-testid={testid}
    >
      {message}
    </p>
  )
}
