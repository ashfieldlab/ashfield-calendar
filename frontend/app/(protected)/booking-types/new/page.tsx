"use client"

import { useRouter } from "next/navigation"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { useState } from "react"
import { useToast } from "@/components/ui-custom/use-toast"

import { BookingTypeForm } from "@/components/booking/booking-type-form"
import { api } from "@/lib/api-client"
import { invalidateApi } from "@/lib/hooks/use-api"
import type { BookingTypeCreate, BookingTypeResponse } from "@/lib/types/booking"

export default function NewBookingTypePage() {
  const router = useRouter()
  const { toast } = useToast()
  const [busy, setBusy] = useState(false)

  async function submit(body: BookingTypeCreate): Promise<boolean> {
    setBusy(true)
    try {
      const created = await api<BookingTypeResponse>("/api/v1/booking-types", {
        method: "POST",
        body,
      })
      toast.success("예약 양식을 만들었습니다")
      invalidateApi("/api/v1/booking-types")
      router.push(`/booking-types/${created.id}`)
      return true
    } catch (e) {
      toast.error(`생성 실패: ${(e as Error).message}`)
      return false
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="h-full overflow-y-auto px-4 pt-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl">
        <Link
          href="/booking-types"
          data-testid="booking-types-back"
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-3" /> 예약 양식
        </Link>
        <h1 className="mt-2 mb-4 text-2xl font-bold text-foreground">새 예약 양식</h1>
        <BookingTypeForm onSubmit={submit} busy={busy} submitLabel="만들기" />
      </div>
    </div>
  )
}
