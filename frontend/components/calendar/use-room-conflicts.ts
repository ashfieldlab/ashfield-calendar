import { useEffect, useState } from "react"

import { api } from "@/lib/api-client"
import type { RoomConflict, RoomConflictsResponse } from "@/lib/types/api"

/** [start, end) 에 사용 중인 회의실 → 겹친 일정. 저장 전 미리보기용: 최종 판단은 저장 시 백엔드. */
export function useRoomConflicts(
  start: Date,
  end: Date,
  { excludeEventId, enabled }: { excludeEventId?: string; enabled: boolean },
): Map<string, RoomConflict> {
  const [conflicts, setConflicts] = useState<Map<string, RoomConflict>>(() => new Map())
  const startISO = start.toISOString()
  const endISO = end.toISOString()

  useEffect(() => {
    let cancelled = false
    if (!enabled || endISO <= startISO) {
      void Promise.resolve().then(() => !cancelled && setConflicts(new Map()))
      return () => {
        cancelled = true
      }
    }
    api<RoomConflictsResponse>("/api/v1/rooms/conflicts", {
      method: "POST",
      body: { start_at: startISO, end_at: endISO, exclude_event_id: excludeEventId ?? null },
    })
      .then((r) => !cancelled && setConflicts(new Map(r.conflicts.map((c) => [c.room_id, c]))))
      .catch(() => !cancelled && setConflicts(new Map()))
    return () => {
      cancelled = true
    }
  }, [startISO, endISO, excludeEventId, enabled])

  return conflicts
}
