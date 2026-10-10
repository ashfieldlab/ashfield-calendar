"use client"

// 안 C: 탭형. 큰 제목 머리 아래 탭으로 나누고, 가능 시간은 칠해서 고르는 주간 격자.

import { useState } from "react"
import { ArrowLeft, Clock, Users } from "lucide-react"

import { useToast } from "@/components/ui-custom/use-toast"
import { cn } from "@/lib/utils"

import {
  BlockingPicker,
  ChipPicker,
  DAYS,
  DURATIONS,
  FieldLabel,
  NOTICES,
  NotifyPicker,
  OwnerPicker,
  PUBLIC_URL,
  Stepper,
  TargetCalendarPicker,
  WeekPaint,
  durationText,
  inputCls,
  noticeText,
  openSlotCount,
  useDraft,
  type Draft,
  type VariantProps,
} from "./shared"

const TABS: { key: string; label: string; fields: (keyof Draft)[] }[] = [
  { key: "basic", label: "기본", fields: ["title", "duration", "capacity"] },
  { key: "hours", label: "가능 시간", fields: ["weekly", "availableTo"] },
  { key: "rules", label: "예약 규칙", fields: [] },
  { key: "calendar", label: "캘린더와 알림", fields: ["targetCalendarId"] },
  { key: "publish", label: "공개", fields: [] },
]

export function VariantC({ initial, isNew }: VariantProps) {
  const { toast } = useToast()
  const api = useDraft(initial, isNew)
  const { d, set, errors, dirty, save, reset } = api
  const [tab, setTab] = useState("basic")
  const [tried, setTried] = useState(false)

  return (
    <div className="mx-auto max-w-4xl">
      <div className="rounded-2xl border bg-card">
        <div className="flex items-start gap-3 p-6 pb-0">
          <button
            onClick={() => toast.info("목록으로")}
            className="mt-1 rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
            data-testid="pg-booking-type-form-c-back"
          >
            <ArrowLeft className="size-4" />
          </button>
          <div className="min-w-0 flex-1">
            <input
              value={d.title}
              onChange={(e) => set({ title: e.target.value })}
              placeholder={isNew ? "새 예약 양식" : "제목"}
              className={cn(
                "w-full bg-transparent text-2xl font-bold outline-none placeholder:text-muted-foreground/50",
                tried && errors.title && "placeholder:text-rose-400",
              )}
              data-testid="pg-booking-type-form-c-title"
            />
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <Clock className="size-3" />
                {durationText(d.duration)}
              </span>
              {d.capacity > 1 && (
                <span className="inline-flex items-center gap-1">
                  <Users className="size-3" />
                  {d.capacity}명
                </span>
              )}
              {!isNew && <span className="font-mono">{PUBLIC_URL}</span>}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            {dirty && (
              <button
                onClick={reset}
                className="rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
                data-testid="pg-booking-type-form-c-reset"
              >
                되돌리기
              </button>
            )}
            <button
              onClick={() => {
                setTried(true)
                save()
              }}
              disabled={!dirty && !isNew}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-40"
              data-testid="pg-booking-type-form-c-save"
            >
              {isNew ? "만들기" : "저장"}
            </button>
          </div>
        </div>

        <div className="mt-5 flex gap-1 overflow-x-auto border-b px-5" role="tablist">
          {TABS.map((t) => {
            const bad = tried && t.fields.some((f) => errors[f])
            return (
              <button
                key={t.key}
                role="tab"
                aria-selected={tab === t.key}
                onClick={() => setTab(t.key)}
                className={cn(
                  "relative -mb-px shrink-0 border-b-2 px-3 py-2.5 text-sm transition-colors",
                  tab === t.key ? "border-primary font-medium text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
                )}
                data-testid={`pg-booking-type-form-c-tab-${t.key}`}
              >
                {t.label}
                {bad && <span className="absolute right-0.5 top-2 size-1.5 rounded-full bg-rose-500" />}
              </button>
            )
          })}
        </div>

        <div className="space-y-6 p-6">
          {tab === "basic" && (
            <>
              {isNew && (
                <div className="max-w-sm">
                  <FieldLabel>소유</FieldLabel>
                  <OwnerPicker api={api} testId="pg-booking-type-form-c-owner" />
                </div>
              )}
              <div>
                <FieldLabel>안내 문구</FieldLabel>
                <textarea value={d.description} onChange={(e) => set({ description: e.target.value })} rows={4} className={inputCls} data-testid="pg-booking-type-form-c-description" />
              </div>
              <div className="flex flex-wrap gap-8">
                <div>
                  <FieldLabel error={errors.duration}>길이</FieldLabel>
                  <ChipPicker value={d.duration} options={DURATIONS.map((v) => ({ v, label: durationText(v) }))} onChange={(v) => set({ duration: v })} suffix="분" min={5} max={1440} testId="pg-booking-type-form-c-duration" />
                </div>
                <div>
                  <FieldLabel>정원</FieldLabel>
                  <Stepper value={d.capacity} onChange={(v) => set({ capacity: v })} unit="명" testId="pg-booking-type-form-c-capacity" />
                </div>
              </div>
            </>
          )}

          {tab === "hours" && (
            <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_200px]">
              <div>
                <FieldLabel error={tried ? errors.weekly : undefined}>요일과 시간</FieldLabel>
                <WeekPaint value={d.weekly} onChange={(w) => set({ weekly: w })} testId="pg-booking-type-form-c-paint" />
              </div>
              <div className="space-y-5">
                <div>
                  <FieldLabel>요약</FieldLabel>
                  <ul className="space-y-1 text-xs">
                    {DAYS.map(({ key, label }) => (
                      <li key={key} className="flex gap-2">
                        <span className={cn("w-4 font-medium", !d.weekly[key]?.length && "text-muted-foreground/50")}>{label}</span>
                        <span className="text-muted-foreground tabular-nums">
                          {d.weekly[key]?.length ? d.weekly[key]!.map(([s, e]) => `${s}~${e}`).join(", ") : "-"}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <FieldLabel>시작 날짜</FieldLabel>
                  <input type="date" value={d.availableFrom} onChange={(e) => set({ availableFrom: e.target.value })} className={inputCls} data-testid="pg-booking-type-form-c-from" />
                </div>
                <div>
                  <FieldLabel error={errors.availableTo}>종료 날짜</FieldLabel>
                  <input type="date" value={d.availableTo} onChange={(e) => set({ availableTo: e.target.value })} className={inputCls} data-testid="pg-booking-type-form-c-to" />
                </div>
              </div>
            </div>
          )}

          {tab === "rules" && (
            <div className="grid gap-8 sm:grid-cols-2">
              <div>
                <FieldLabel>최소 예약 시점</FieldLabel>
                <div className="mb-3 text-2xl font-semibold">{noticeText(d.minimumNotice)}</div>
                <ChipPicker value={d.minimumNotice} options={NOTICES} onChange={(v) => set({ minimumNotice: v })} suffix="분 전" min={0} testId="pg-booking-type-form-c-notice" />
              </div>
              <div>
                <FieldLabel>미리 예약 기한</FieldLabel>
                <div className="mb-3 text-2xl font-semibold tabular-nums">{d.lookaheadDays}일</div>
                <input
                  type="range"
                  min={1}
                  max={90}
                  value={d.lookaheadDays}
                  onChange={(e) => set({ lookaheadDays: Number(e.target.value) })}
                  className="w-full accent-primary"
                  data-testid="pg-booking-type-form-c-lookahead"
                />
                <div className="mt-1 flex justify-between text-[11px] text-muted-foreground">
                  <span>1일</span>
                  <span>90일</span>
                </div>
              </div>
              <div className="rounded-xl bg-muted/50 px-4 py-3 sm:col-span-2">
                <div className="text-xs text-muted-foreground">열린 시간</div>
                <div className="mt-0.5 text-lg font-semibold tabular-nums">{openSlotCount(d)}칸</div>
              </div>
            </div>
          )}

          {tab === "calendar" && (
            <>
              <div>
                <FieldLabel error={errors.targetCalendarId}>예약이 들어갈 캘린더</FieldLabel>
                <TargetCalendarPicker api={api} testId="pg-booking-type-form-c-target" />
              </div>
              <div>
                <FieldLabel>충돌 확인</FieldLabel>
                <BlockingPicker api={api} testId="pg-booking-type-form-c-blocking" />
              </div>
              <div>
                <FieldLabel>알림 받을 사람</FieldLabel>
                <NotifyPicker api={api} testId="pg-booking-type-form-c-notify" />
              </div>
            </>
          )}

          {tab === "publish" && (
            <>
              <div>
                <FieldLabel>개인정보 처리방침 URL</FieldLabel>
                <input type="url" value={d.privacyUrl} onChange={(e) => set({ privacyUrl: e.target.value })} placeholder="https://" className={inputCls} data-testid="pg-booking-type-form-c-privacy" />
              </div>
              <div className="max-w-60">
                <FieldLabel>시간대</FieldLabel>
                <input value={d.timezone} onChange={(e) => set({ timezone: e.target.value })} className={inputCls} data-testid="pg-booking-type-form-c-timezone" />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
