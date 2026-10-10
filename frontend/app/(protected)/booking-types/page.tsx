"use client"

import Link from "next/link"
import { CalendarClock, Copy, ExternalLink, Plus } from "lucide-react"
import { useToast } from "@/components/ui-custom/use-toast"

import { useApiGet } from "@/lib/hooks/use-api"
import type { BookingTypeListResponse } from "@/lib/types/booking"

function publicUrl(publicKey: string): string {
  if (typeof window === "undefined") return `/book/${publicKey}`
  return `${window.location.origin}/book/${publicKey}`
}

export default function BookingTypesPage() {
  const { toast } = useToast()
  const { data, error, isLoading } = useApiGet<BookingTypeListResponse>(
    "/api/v1/booking-types",
  )

  async function copyLink(publicKey: string) {
    try {
      await navigator.clipboard.writeText(publicUrl(publicKey))
      toast.success("공개 URL을 복사했습니다")
    } catch {
      toast.error("복사 실패. 직접 선택해 복사하세요")
    }
  }

  const items = data?.items ?? []

  return (
    <div
      className="h-full overflow-y-auto space-y-4 px-4 py-8 sm:px-6 lg:px-8"
      data-testid="booking-types-page"
    >
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CalendarClock size={20} className="text-gray-600" />
          <h1 className="text-2xl font-bold text-gray-900">예약 양식</h1>
        </div>
        <Link
          href="/booking-types/new"
          data-testid="booking-types-create"
          className="inline-flex items-center gap-1 rounded bg-gray-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-gray-800"
        >
          <Plus size={14} /> 새 양식
        </Link>
      </header>
      <p className="text-sm text-gray-500">
        외부 고객을 위한 일정 예약 양식을 생성합니다.
      </p>

      {error ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          불러오지 못했습니다. 잠시 후 다시 시도해주세요.
        </div>
      ) : isLoading ? (
        <p className="text-sm text-gray-500">불러오는 중…</p>
      ) : items.length === 0 ? (
        <div
          className="rounded-lg border border-dashed border-gray-300 p-8 text-center text-sm text-gray-500"
          data-testid="booking-types-empty"
        >
          아직 예약 양식이 없습니다. 우측 상단의 <strong>새 양식</strong> 을 눌러 만들어보세요.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
          <table
            className="w-full text-sm"
            data-testid="booking-types-list"
          >
            <thead className="bg-gray-50 text-left text-xs text-gray-500">
              <tr>
                <th className="px-4 py-2 font-medium">제목</th>
                <th className="w-20 px-4 py-2 font-medium">길이</th>
                <th className="w-20 px-4 py-2 font-medium">정원</th>
                <th className="w-20 px-4 py-2 font-medium">상태</th>
                <th className="px-4 py-2 font-medium">공개 URL</th>
                <th className="w-32" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {items.map((bt) => (
                <tr
                  key={bt.id}
                  data-testid={`booking-types-row-${bt.id}`}
                  className="hover:bg-gray-50"
                >
                  <td className="px-4 py-2">
                    <Link
                      href={`/booking-types/${bt.id}`}
                      data-testid={`booking-types-row-${bt.id}-link`}
                      className="font-medium text-gray-900 hover:underline"
                    >
                      {bt.title}
                    </Link>
                    {bt.owner_type === "company" && (
                      <span className="ml-1 rounded bg-blue-100 px-1.5 py-0.5 text-[10px] text-blue-800">
                        회사
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-gray-700">
                    {bt.duration_minutes}분
                  </td>
                  <td className="px-4 py-2 text-gray-700">{bt.capacity}</td>
                  <td className="px-4 py-2">
                    {bt.enabled ? (
                      <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-xs text-emerald-800">
                        공개
                      </span>
                    ) : (
                      <span className="rounded bg-gray-200 px-1.5 py-0.5 text-xs text-gray-700">
                        비공개
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2">
                    <code className="rounded bg-gray-100 px-1.5 py-0.5 text-[11px] text-gray-700">
                      /book/{bt.public_key}
                    </code>
                  </td>
                  <td className="px-4 py-2 text-right">
                    <div className="flex justify-end gap-1">
                      <button
                        onClick={() => copyLink(bt.public_key)}
                        title="공개 URL 복사"
                        data-testid={`booking-types-row-${bt.id}-copy`}
                        className="rounded p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-900"
                      >
                        <Copy size={14} />
                      </button>
                      <a
                        href={publicUrl(bt.public_key)}
                        target="_blank"
                        rel="noopener noreferrer"
                        title="공개 페이지 열기"
                        data-testid={`booking-types-row-${bt.id}-open`}
                        className="rounded p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-900"
                      >
                        <ExternalLink size={14} />
                      </a>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
