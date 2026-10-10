"use client"

// 안 B: 왼쪽 단계 내비 + 가운데 입력 + 오른쪽 실시간 공개 페이지 미리보기.

import { useState } from "react"
import { ArrowLeft, Check } from "lucide-react"

import { useToast } from "@/components/ui-custom/use-toast"
import { cn } from "@/lib/utils"

import {
  BlockingPicker,
  BookingPreview,
  ChipPicker,
  DURATIONS,
  FieldLabel,
  LOOKAHEADS,
  NOTICES,
  NotifyPicker,
  OwnerPicker,
  Stepper,
  TargetCalendarPicker,
  WeeklyList,
  durationText,
  inputCls,
  openSlotCount,
  useDraft,
  type Draft,
  type VariantProps,
} from "./shared"

const STEPS: { key: string; label: string; fields: (keyof Draft)[] }[] = [
  { key: "basic", label: "기본", fields: ["title", "duration", "capacity"] },
  { key: "hours", label: "가능 시간", fields: ["weekly", "availableTo"] },
  { key: "rules", label: "예약 규칙", fields: [] },
  { key: "calendar", label: "캘린더", fields: ["targetCalendarId"] },
  { key: "publish", label: "알림과 공개", fields: [] },
]

export function VariantB({ initial, isNew }: VariantProps) {
  const { toast } = useToast()
  const api = useDraft(initial, isNew)
  const { d, set, errors, dirty, save } = api
  const [step, setStep] = useState(0)
  const [visited, setVisited] = useState<Set<number>>(() => new Set(isNew ? [0] : STEPS.map((_, i) => i)))
  const go = (i: number) => {
    setStep(i)
    setVisited((v) => new Set(v).add(i))
  }
  const stepOk = (i: number) => STEPS[i].fields.every((f) => !errors[f])
  const last = step === STEPS.length - 1
  const slots = openSlotCount(d)

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-5 flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <button
            onClick={() => toast.info("목록으로")}
            className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
            data-testid="pg-booking-type-form-b-back"
          >
            <ArrowLeft className="size-4" />
          </button>
          <h1 className="truncate text-xl font-bold">{isNew ? "새 예약 양식" : d.title || "예약 양식"}</h1>
          {dirty && !isNew && <span className="size-2 shrink-0 rounded-full bg-amber-500" title="저장 안 됨" />}
        </div>
        {!isNew && (
          <button
            onClick={save}
            disabled={!dirty}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-40"
            data-testid="pg-booking-type-form-b-save"
          >
            저장
          </button>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-[180px_minmax(0,1fr)_320px]">
        <nav className="flex gap-1 overflow-x-auto lg:flex-col" data-testid="pg-booking-type-form-b-steps">
          {STEPS.map((s, i) => {
            const done = visited.has(i) && stepOk(i) && i !== step
            const bad = visited.has(i) && !stepOk(i)
            return (
              <button
                key={s.key}
                onClick={() => go(i)}
                className={cn(
                  "flex shrink-0 items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm transition-colors",
                  i === step ? "bg-muted font-medium" : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
                )}
                data-testid={`pg-booking-type-form-b-step-${s.key}`}
              >
                <span
                  className={cn(
                    "grid size-5 shrink-0 place-items-center rounded-full border text-[11px] tabular-nums",
                    i === step && "border-primary bg-primary text-primary-foreground",
                    done && "border-emerald-500 bg-emerald-500 text-white dark:border-emerald-600 dark:bg-emerald-600",
                    bad && i !== step && "border-rose-400 text-rose-600 dark:border-rose-700 dark:text-rose-400",
                  )}
                >
                  {done ? <Check className="size-3" /> : i + 1}
                </span>
                {s.label}
              </button>
            )
          })}
        </nav>

        <div className="min-w-0 rounded-2xl border bg-card p-6">
          <h2 className="mb-5 text-lg font-semibold">{STEPS[step].label}</h2>
          <div className="space-y-6">
            {step === 0 && (
              <>
                {isNew && (
                  <div>
                    <FieldLabel>소유</FieldLabel>
                    <OwnerPicker api={api} testId="pg-booking-type-form-b-owner" />
                  </div>
                )}
                <div>
                  <FieldLabel error={!isNew || visited.size > 1 ? errors.title : undefined}>제목</FieldLabel>
                  <input
                    autoFocus
                    value={d.title}
                    onChange={(e) => set({ title: e.target.value })}
                    placeholder="예: 30분 상담"
                    className={cn(inputCls, "text-base font-medium")}
                    data-testid="pg-booking-type-form-b-title"
                  />
                </div>
                <div>
                  <FieldLabel>안내 문구</FieldLabel>
                  <textarea value={d.description} onChange={(e) => set({ description: e.target.value })} rows={3} className={inputCls} data-testid="pg-booking-type-form-b-description" />
                </div>
                <div className="grid gap-6 sm:grid-cols-[1fr_auto]">
                  <div>
                    <FieldLabel error={errors.duration}>길이</FieldLabel>
                    <ChipPicker value={d.duration} options={DURATIONS.map((v) => ({ v, label: durationText(v) }))} onChange={(v) => set({ duration: v })} suffix="분" min={5} max={1440} testId="pg-booking-type-form-b-duration" />
                  </div>
                  <div>
                    <FieldLabel>정원</FieldLabel>
                    <Stepper value={d.capacity} onChange={(v) => set({ capacity: v })} unit="명" testId="pg-booking-type-form-b-capacity" />
                  </div>
                </div>
              </>
            )}

            {step === 1 && (
              <>
                <div>
                  <FieldLabel error={errors.weekly}>요일과 시간</FieldLabel>
                  <WeeklyList value={d.weekly} onChange={(w) => set({ weekly: w })} testId="pg-booking-type-form-b-weekly" />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <FieldLabel>시작 날짜</FieldLabel>
                    <input type="date" value={d.availableFrom} onChange={(e) => set({ availableFrom: e.target.value })} className={inputCls} data-testid="pg-booking-type-form-b-from" />
                  </div>
                  <div>
                    <FieldLabel error={errors.availableTo}>종료 날짜</FieldLabel>
                    <input type="date" value={d.availableTo} onChange={(e) => set({ availableTo: e.target.value })} className={inputCls} data-testid="pg-booking-type-form-b-to" />
                  </div>
                </div>
              </>
            )}

            {step === 2 && (
              <>
                <div>
                  <FieldLabel>최소 예약 시점</FieldLabel>
                  <ChipPicker value={d.minimumNotice} options={NOTICES} onChange={(v) => set({ minimumNotice: v })} suffix="분 전" min={0} testId="pg-booking-type-form-b-notice" />
                </div>
                <div>
                  <FieldLabel>미리 예약 기한</FieldLabel>
                  <ChipPicker value={d.lookaheadDays} options={LOOKAHEADS.map((v) => ({ v, label: `${v}일` }))} onChange={(v) => set({ lookaheadDays: v })} suffix="일" min={1} max={90} testId="pg-booking-type-form-b-lookahead" />
                </div>
              </>
            )}

            {step === 3 && (
              <>
                <div>
                  <FieldLabel error={errors.targetCalendarId}>예약이 들어갈 캘린더</FieldLabel>
                  <TargetCalendarPicker api={api} testId="pg-booking-type-form-b-target" />
                </div>
                <div>
                  <FieldLabel>충돌 확인</FieldLabel>
                  <BlockingPicker api={api} testId="pg-booking-type-form-b-blocking" />
                </div>
              </>
            )}

            {step === 4 && (
              <>
                <div>
                  <FieldLabel>알림 받을 사람</FieldLabel>
                  <NotifyPicker api={api} testId="pg-booking-type-form-b-notify" />
                </div>
                <div>
                  <FieldLabel>개인정보 처리방침 URL</FieldLabel>
                  <input type="url" value={d.privacyUrl} onChange={(e) => set({ privacyUrl: e.target.value })} placeholder="https://" className={inputCls} data-testid="pg-booking-type-form-b-privacy" />
                </div>
                <div>
                  <FieldLabel>시간대</FieldLabel>
                  <input value={d.timezone} onChange={(e) => set({ timezone: e.target.value })} className={cn(inputCls, "max-w-60")} data-testid="pg-booking-type-form-b-timezone" />
                </div>
              </>
            )}
          </div>

          <div className="mt-8 flex items-center justify-between border-t pt-4">
            <button
              onClick={() => go(step - 1)}
              disabled={step === 0}
              className="rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground disabled:invisible"
              data-testid="pg-booking-type-form-b-prev"
            >
              이전
            </button>
            {last ? (
              <button
                onClick={save}
                className="rounded-md bg-primary px-5 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                data-testid="pg-booking-type-form-b-submit"
              >
                {isNew ? "만들기" : "저장"}
              </button>
            ) : (
              <button
                onClick={() => go(step + 1)}
                className="rounded-md border px-5 py-2 text-sm font-medium hover:bg-muted"
                data-testid="pg-booking-type-form-b-next"
              >
                다음
              </button>
            )}
          </div>
        </div>

        <aside className="space-y-2 lg:sticky lg:top-0 lg:self-start">
          <div className="flex items-center justify-between px-1 text-xs text-muted-foreground">
            <span>미리보기</span>
            <span className={cn(slots === 0 && "text-rose-600 dark:text-rose-400")}>
              {d.lookaheadDays}일 동안 {slots}칸
            </span>
          </div>
          <BookingPreview d={d} />
        </aside>
      </div>
    </div>
  )
}
