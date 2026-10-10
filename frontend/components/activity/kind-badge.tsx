import {
  CalendarCheck,
  CalendarClock,
  CalendarMinus,
  CalendarPlus,
  CalendarX2,
  Clock,
  Download,
  KeyRound,
  Link2,
  PencilLine,
  RefreshCw,
  Rss,
  Scissors,
  Ticket,
  UserCheck,
  UserMinus,
  UserPlus,
  type LucideIcon,
} from "lucide-react"

import { cn } from "@/lib/utils"
import type { ActKind } from "@/lib/utils/activity-format"

const TONE = {
  green: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  blue: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  amber: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  rose: "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300",
  violet: "bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300",
  teal: "bg-teal-100 text-teal-700 dark:bg-teal-950 dark:text-teal-300",
  muted: "bg-muted text-muted-foreground",
}

const KIND_ICON: Record<ActKind, { icon: LucideIcon; tone: string }> = {
  create: { icon: CalendarPlus, tone: TONE.green },
  update: { icon: PencilLine, tone: TONE.blue },
  reschedule: { icon: Clock, tone: TONE.amber },
  delete: { icon: CalendarX2, tone: TONE.rose },
  skip: { icon: CalendarMinus, tone: TONE.muted },
  detach: { icon: Scissors, tone: TONE.blue },
  invite: { icon: UserPlus, tone: TONE.violet },
  uninvite: { icon: UserMinus, tone: TONE.muted },
  rsvp: { icon: UserCheck, tone: TONE.teal },
  booked: { icon: Ticket, tone: TONE.green },
  booking_reschedule: { icon: CalendarClock, tone: TONE.amber },
  booking_cancel: { icon: Ticket, tone: TONE.rose },
  bt_create: { icon: CalendarCheck, tone: TONE.green },
  bt_update: { icon: PencilLine, tone: TONE.blue },
  bt_delete: { icon: CalendarX2, tone: TONE.rose },
  link_rotate: { icon: Link2, tone: TONE.amber },
  cal_create: { icon: CalendarPlus, tone: TONE.green },
  cal_subscribe: { icon: Rss, tone: TONE.teal },
  cal_update: { icon: PencilLine, tone: TONE.blue },
  cal_refresh: { icon: RefreshCw, tone: TONE.teal },
  cal_delete: { icon: CalendarX2, tone: TONE.rose },
  import: { icon: Download, tone: TONE.blue },
  feed: { icon: RefreshCw, tone: TONE.amber },
  caldav_create: { icon: KeyRound, tone: TONE.violet },
  caldav_revoke: { icon: KeyRound, tone: TONE.muted },
}

export function KindBadge({ kind, className }: { kind: ActKind; className?: string }) {
  const m = KIND_ICON[kind]
  const Icon = m.icon
  return (
    <span className={cn("inline-flex size-7 shrink-0 items-center justify-center rounded-full", m.tone, className)}>
      <Icon className="size-3.5" />
    </span>
  )
}
