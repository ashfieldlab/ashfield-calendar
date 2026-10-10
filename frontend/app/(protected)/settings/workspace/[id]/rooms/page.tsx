"use client"

import { useState } from "react"
import Link from "next/link"
import { ArrowLeft, DoorOpen, Trash2 } from "lucide-react"
import { useToast } from "@/components/ui-custom/use-toast"

import { useAppContext } from "@/components/providers/app-context"
import { api } from "@/lib/api-client"
import { invalidateApi, useApiGet } from "@/lib/hooks/use-api"
import { useConfirm } from "@/components/ui-custom/use-confirm"
import type { RoomListResponse } from "@/lib/types/api"

const URL = "/api/v1/rooms"

export default function RoomsSettingsPage() {
  const { isWorkspaceAdmin } = useAppContext()
  const { toast } = useToast()
  const confirm = useConfirm()
  const { data, isLoading, error } = useApiGet<RoomListResponse>(
    isWorkspaceAdmin ? URL : null,
  )

  const [name, setName] = useState("")
  const [capacity, setCapacity] = useState("")
  const [busy, setBusy] = useState(false)

  if (!isWorkspaceAdmin) {
    return (
      <div
        className="rounded-lg border border-amber-200 bg-amber-50 p-6 text-sm text-amber-800"
        data-testid="rooms-no-permission"
      >
        워크스페이스 관리자만 접근할 수 있습니다.
      </div>
    )
  }

  async function add() {
    if (!name.trim()) return
    setBusy(true)
    try {
      await api(URL, {
        method: "POST",
        body: {
          name: name.trim(),
          capacity: capacity ? Number(capacity) : null,
        },
      })
      toast.success("회의실을 추가했습니다")
      setName("")
      setCapacity("")
      invalidateApi(URL)
    } catch (e) {
      toast.error(`추가 실패: ${(e as Error).message}`)
    } finally {
      setBusy(false)
    }
  }

  async function remove(id: string, roomName: string) {
    if (
      !(await confirm({
        title: "회의실 삭제",
        description: `'${roomName}'을(를) 삭제하시겠습니까? 이 방을 쓰던 일정은 방만 해제되고 유지됩니다.`,
        confirmText: "삭제",
        variant: "destructive",
      }))
    )
      return
    try {
      await api(`${URL}/${id}`, { method: "DELETE" })
      toast.success("회의실을 삭제했습니다")
      invalidateApi(URL)
    } catch (e) {
      toast.error(`삭제 실패: ${(e as Error).message}`)
    }
  }

  const rooms = data?.rooms ?? []

  return (
    <div
      className="h-full space-y-4 overflow-y-auto px-4 py-8 sm:px-6 lg:px-8"
      data-testid="rooms-settings-page"
    >
      <Link
        href="/settings"
        className="inline-flex items-center gap-1 text-xs text-gray-600 hover:text-gray-900"
        data-testid="rooms-settings-back"
      >
        <ArrowLeft size={12} /> 설정으로
      </Link>
      <header className="flex items-center gap-2">
        <DoorOpen size={20} className="text-gray-600" />
        <h1 className="text-2xl font-bold text-gray-900">회의실 관리</h1>
      </header>

      <div className="flex flex-wrap items-end gap-2 rounded-lg border border-gray-200 bg-white p-4">
        <div className="flex-1 min-w-[10rem]">
          <label className="mb-1 block text-xs font-medium text-gray-600">이름</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="예: 회의실 A"
            data-testid="rooms-name-input"
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
          />
        </div>
        <div className="w-28">
          <label className="mb-1 block text-xs font-medium text-gray-600">
            정원 (선택)
          </label>
          <input
            type="number"
            min={1}
            value={capacity}
            onChange={(e) => setCapacity(e.target.value)}
            placeholder="6"
            data-testid="rooms-capacity-input"
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
          />
        </div>
        <button
          onClick={add}
          disabled={busy || !name.trim()}
          data-testid="rooms-add-button"
          className="rounded bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
        >
          추가
        </button>
      </div>

      {error ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          불러오지 못했습니다. 잠시 후 다시 시도해주세요.
        </div>
      ) : isLoading ? (
        <div className="text-sm text-gray-500">불러오는 중…</div>
      ) : rooms.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-300 p-8 text-center text-sm text-gray-500">
          등록된 회의실이 없습니다.
        </div>
      ) : (
        <ul
          className="divide-y divide-gray-100 overflow-hidden rounded-lg border border-gray-200 bg-white"
          data-testid="rooms-list"
        >
          {rooms.map((r) => (
            <li
              key={r.id}
              data-testid={`rooms-row-${r.id}`}
              className="flex items-center justify-between px-4 py-3"
            >
              <div className="min-w-0">
                <span className="truncate font-medium text-gray-900">{r.name}</span>
                {r.capacity != null && (
                  <span className="ml-2 text-xs text-gray-500">{r.capacity}인</span>
                )}
              </div>
              <button
                onClick={() => remove(r.id, r.name)}
                data-testid={`rooms-row-${r.id}-delete`}
                className="shrink-0 rounded p-1.5 text-gray-400 hover:bg-rose-50 hover:text-rose-600"
                aria-label="삭제"
              >
                <Trash2 size={16} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
