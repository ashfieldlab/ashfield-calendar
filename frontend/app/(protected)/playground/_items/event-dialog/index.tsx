"use client"

import { useToast } from "@/components/ui-custom/use-toast"
import { useApiGet } from "@/lib/hooks/use-api"
import type { CalendarListResponse, RoomListResponse } from "@/lib/types/api"

import type { EventDraft } from "./shared"
import { VariantA } from "./variant-a"
import { VariantB } from "./variant-b"
import { VariantC } from "./variant-c"

export const eventDialogVariants = [
  { key: "A", name: "아이콘 줄 목록" },
  { key: "B", name: "넓은 2단" },
  { key: "C", name: "빠른 입력 + 칩" },
]

export function EventDialogItem({ variant }: { variant: string }) {
  const { toast } = useToast()
  const { data: calList } = useApiGet<CalendarListResponse>("/api/v1/calendars")
  const { data: roomData } = useApiGet<RoomListResponse>("/api/v1/rooms")
  if (!calList) return null

  const props = {
    calendars: calList.calendars,
    rooms: roomData?.rooms ?? [],
    onClose: () => toast.success("취소"),
    onSubmit: (d: EventDraft) => toast.success(`저장 안 함: ${JSON.stringify(d)}`),
  }

  return (
    <div key={variant} className="flex w-full justify-center">
      {variant === "A" && <VariantA {...props} />}
      {variant === "B" && <VariantB {...props} />}
      {variant === "C" && <VariantC {...props} />}
    </div>
  )
}
