"use client"

import { useState } from "react"
import { Copy, RefreshCw, X } from "lucide-react"
import { useToast } from "@/components/ui-custom/use-toast"

import { api } from "@/lib/api-client"
import { friendlyError } from "@/lib/errors"
import { useApiGet } from "@/lib/hooks/use-api"
import { useConfirm } from "@/components/ui-custom/use-confirm"
import type { CalendarResponse } from "@/lib/types/api"

interface SubscriptionResponse {
  enabled: boolean
  token: string | null
  url: string | null
}

interface Props {
  calendar: CalendarResponse
  onClose: () => void
}

/**
 * 캘린더 ICS subscription 관리 모달 (ADR-0013).
 *
 * - 활성화/비활성화 토글, URL 표시 + 복사, 토큰 회전
 * - 보안·PIPA 마스킹 경고 카피
 */
export function SubscriptionModal({ calendar, onClose }: Props) {
  const { toast } = useToast()
  const confirm = useConfirm()
  const URL_ = `/api/v1/calendars/${encodeURIComponent(calendar.id)}/subscription`
  const { data, mutate, isLoading } = useApiGet<SubscriptionResponse>(URL_)
  const [busy, setBusy] = useState(false)

  async function enable() {
    setBusy(true)
    try {
      await api(URL_, { method: "POST" })
      mutate()
      toast.success("외부 캘린더를 구독했습니다")
    } catch (e) {
      toast.error(friendlyError(e))
    } finally {
      setBusy(false)
    }
  }

  async function rotate() {
    if (!(await confirm({ title: "구독 URL 재발급", description: "기존 URL 이 즉시 무효화되어 등록된 구독을 다시 설정해야 합니다.", confirmText: "재발급", variant: "destructive" })))
      return
    setBusy(true)
    try {
      await api(URL_ + "/rotate", { method: "POST" })
      mutate()
      toast.success("토큰을 재발급했습니다")
    } catch (e) {
      toast.error(friendlyError(e))
    } finally {
      setBusy(false)
    }
  }

  async function disable() {
    if (!(await confirm({ title: "외부 구독 끄기", description: "등록된 캘린더 앱이 더 이상 일정을 받지 못합니다.", confirmText: "끄기", variant: "destructive" })))
      return
    setBusy(true)
    try {
      await api(URL_, { method: "DELETE" })
      mutate()
      toast.success("외부 구독을 해제했습니다")
    } catch (e) {
      toast.error(friendlyError(e))
    } finally {
      setBusy(false)
    }
  }

  async function copyUrl() {
    if (!data?.url) return
    await navigator.clipboard.writeText(data.url)
    toast.success("복사했습니다")
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
      data-testid="calendar-subscription-modal"
    >
      <div
        className="w-full max-w-lg rounded-lg bg-white p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h3 className="min-w-0 truncate text-sm font-semibold text-gray-900">
            외부 캘린더 구독 ({calendar.name})
          </h3>
          <button
            onClick={onClose}
            data-testid="calendar-subscription-close"
            className="rounded p-1 text-gray-500 hover:bg-gray-100"
          >
            <X size={16} />
          </button>
        </div>

        <div className="space-y-3 text-sm">
          <div className="rounded border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
            <p className="font-medium">⚠ 사용 전 확인</p>
            <ul className="mt-1 list-disc space-y-0.5 pl-4">
              <li>URL 은 비밀번호처럼 다뤄주세요. 유출 시 캘린더 일정이 외부에 노출됩니다.</li>
              <li>가능하면 자체 호스팅 캘린더(Nextcloud 등)에만 등록하세요.</li>
            </ul>
          </div>

          {isLoading || !data ? (
            <p className="text-gray-500">불러오는 중…</p>
          ) : !data.enabled ? (
            <div className="space-y-2">
              <p className="text-gray-700">
                외부 구독이 꺼져 있습니다.
              </p>
              <button
                onClick={enable}
                disabled={busy}
                data-testid="calendar-subscription-enable"
                className="w-full rounded bg-gray-900 px-3 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
              >
                외부 구독 활성화
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">
                  구독 URL
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={data.url ?? ""}
                    readOnly
                    data-testid="calendar-subscription-url"
                    className="w-full rounded border border-gray-300 bg-gray-50 px-3 py-2 font-mono text-xs"
                    onClick={(e) => (e.target as HTMLInputElement).select()}
                  />
                  <button
                    onClick={copyUrl}
                    data-testid="calendar-subscription-copy"
                    className="rounded border border-gray-300 px-3 py-2 text-xs text-gray-600 hover:bg-gray-50"
                  >
                    <Copy size={14} />
                  </button>
                </div>
                <p className="mt-1 text-xs text-gray-500">
                  외부 캘린더 앱의 “URL 구독” 기능에 이 주소를 붙여넣으세요.
                </p>
              </div>

              <div className="flex justify-between gap-2 border-t border-gray-100 pt-3">
                <button
                  onClick={rotate}
                  disabled={busy}
                  data-testid="calendar-subscription-rotate"
                  className="inline-flex items-center gap-1 rounded border border-gray-300 px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  <RefreshCw size={12} /> 토큰 재발급
                </button>
                <button
                  onClick={disable}
                  disabled={busy}
                  data-testid="calendar-subscription-disable"
                  className="rounded px-3 py-1.5 text-xs text-rose-600 hover:bg-rose-50 disabled:opacity-50"
                >
                  외부 구독 끄기
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
