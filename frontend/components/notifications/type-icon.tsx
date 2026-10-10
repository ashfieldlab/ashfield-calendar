import { Bell, CalendarClock, CalendarPlus, CalendarX2, Clock, PencilLine, Ticket, UserCheck, type LucideIcon } from "lucide-react"

import { cn } from "@/lib/utils"

const TYPE_ICON: Record<string, { icon: LucideIcon; tone: string }> = {
  event_invited: { icon: CalendarPlus, tone: "bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300" },
  event_updated: { icon: PencilLine, tone: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300" },
  event_cancelled: { icon: CalendarX2, tone: "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300" },
  event_invitation_response: { icon: UserCheck, tone: "bg-teal-100 text-teal-700 dark:bg-teal-950 dark:text-teal-300" },
  event_reminder: { icon: Clock, tone: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300" },
  booking_received: { icon: Ticket, tone: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300" },
  booking_rescheduled: { icon: CalendarClock, tone: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300" },
  booking_cancelled: { icon: Ticket, tone: "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300" },
}

const FALLBACK = { icon: Bell, tone: "bg-muted text-muted-foreground" }

/** 알림 종류 아이콘 (원형) */
export function TypeIcon({ type, className }: { type: string; className?: string }) {
  const m = TYPE_ICON[type] ?? FALLBACK
  const Icon = m.icon
  return (
    <span className={cn("inline-flex size-8 shrink-0 items-center justify-center rounded-full", m.tone, className)}>
      <Icon className="size-4" />
    </span>
  )
}
