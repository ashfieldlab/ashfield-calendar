"use client";

// 안 A: 한 페이지 섹션형. 왼쪽 섹션 제목, 오른쪽 입력. 프리셋 칩과 하단 고정 저장 바.

import { ArrowLeft } from "lucide-react";

import { useToast } from "@/components/ui-custom/use-toast";
import { cn } from "@/lib/utils";

import {
  BlockingPicker,
  ChipPicker,
  DURATIONS,
  FieldLabel,
  LOOKAHEADS,
  NOTICES,
  NotifyPicker,
  OwnerPicker,
  PUBLIC_URL,
  Stepper,
  TargetCalendarPicker,
  WeeklyList,
  durationText,
  inputCls,
  useDraft,
  type VariantProps,
} from "./shared";

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="grid gap-4 py-7 md:grid-cols-[180px_1fr] md:gap-8">
      <h2 className="text-sm font-semibold">{title}</h2>
      <div className="min-w-0 space-y-5">{children}</div>
    </section>
  );
}

export function VariantA({ initial, isNew }: VariantProps) {
  const { toast } = useToast();
  const api = useDraft(initial, isNew);
  const { d, set, errors, dirty, save, reset } = api;

  return (
    <div className="mx-auto max-w-4xl">
      <button
        onClick={() => toast.info("목록으로")}
        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        data-testid="pg-booking-type-form-a-back"
      >
        <ArrowLeft className="size-3" /> 예약 양식
      </button>
      <h1 className="mt-2 text-2xl font-bold">
        {isNew ? "새 예약 양식" : d.title || "예약 양식"}
      </h1>
      {!isNew && (
        <p className="mt-1 font-mono text-xs text-muted-foreground">
          {PUBLIC_URL}
        </p>
      )}

      <div className="mt-4 divide-y rounded-2xl border bg-card px-6">
        <Section title="기본">
          {isNew && (
            <div>
              <FieldLabel>소유</FieldLabel>
              <OwnerPicker api={api} testId="pg-booking-type-form-a-owner" />
            </div>
          )}
          <div>
            <FieldLabel error={errors.title}>제목</FieldLabel>
            <input
              value={d.title}
              onChange={(e) => set({ title: e.target.value })}
              placeholder="예: 30분 상담"
              className={cn(
                inputCls,
                "text-base font-medium",
                errors.title && "border-rose-400 dark:border-rose-700",
              )}
              data-testid="pg-booking-type-form-a-title"
            />
          </div>
          <div>
            <FieldLabel>안내 문구</FieldLabel>
            <textarea
              value={d.description}
              onChange={(e) => set({ description: e.target.value })}
              rows={3}
              className={cn(inputCls, "resize-y")}
              data-testid="pg-booking-type-form-a-description"
            />
          </div>
        </Section>

        <Section title="시간">
          <div>
            <FieldLabel error={errors.duration}>길이</FieldLabel>
            <ChipPicker
              value={d.duration}
              options={DURATIONS.map((v) => ({ v, label: durationText(v) }))}
              onChange={(v) => set({ duration: v })}
              suffix="분"
              min={5}
              max={1440}
              testId="pg-booking-type-form-a-duration"
            />
          </div>
          <div>
            <FieldLabel error={errors.capacity}>정원</FieldLabel>
            <Stepper
              value={d.capacity}
              onChange={(v) => set({ capacity: v })}
              unit="명"
              testId="pg-booking-type-form-a-capacity"
            />
          </div>
        </Section>

        <Section title="가능 시간">
          <div>
            <FieldLabel error={errors.weekly}>요일과 시간</FieldLabel>
            <WeeklyList
              value={d.weekly}
              onChange={(w) => set({ weekly: w })}
              testId="pg-booking-type-form-a-weekly"
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <FieldLabel>시작 날짜</FieldLabel>
              <input
                type="date"
                value={d.availableFrom}
                onChange={(e) => set({ availableFrom: e.target.value })}
                className={inputCls}
                data-testid="pg-booking-type-form-a-from"
              />
            </div>
            <div>
              <FieldLabel error={errors.availableTo}>종료 날짜</FieldLabel>
              <input
                type="date"
                value={d.availableTo}
                onChange={(e) => set({ availableTo: e.target.value })}
                className={inputCls}
                data-testid="pg-booking-type-form-a-to"
              />
            </div>
          </div>
        </Section>

        <Section title="예약 규칙">
          <div>
            <FieldLabel>최소 예약 시점</FieldLabel>
            <ChipPicker
              value={d.minimumNotice}
              options={NOTICES.map((n) => ({ v: n.v, label: n.label }))}
              onChange={(v) => set({ minimumNotice: v })}
              suffix="분 전"
              min={0}
              testId="pg-booking-type-form-a-notice"
            />
          </div>
          <div>
            <FieldLabel>미리 예약 기한</FieldLabel>
            <ChipPicker
              value={d.lookaheadDays}
              options={LOOKAHEADS.map((v) => ({ v, label: `${v}일` }))}
              onChange={(v) => set({ lookaheadDays: v })}
              suffix="일"
              min={1}
              max={90}
              testId="pg-booking-type-form-a-lookahead"
            />
          </div>
        </Section>

        <Section title="캘린더">
          <div>
            <FieldLabel error={errors.targetCalendarId}>
              예약이 들어갈 캘린더
            </FieldLabel>
            <TargetCalendarPicker
              api={api}
              testId="pg-booking-type-form-a-target"
            />
          </div>
          <div>
            <FieldLabel>충돌 확인</FieldLabel>
            <BlockingPicker
              api={api}
              testId="pg-booking-type-form-a-blocking"
            />
          </div>
        </Section>

        <Section title="알림과 공개">
          <div>
            <FieldLabel>알림 받을 사람</FieldLabel>
            <NotifyPicker api={api} testId="pg-booking-type-form-a-notify" />
          </div>
          <div className="grid gap-4 sm:grid-cols-[1fr_200px]">
            <div>
              <FieldLabel>개인정보 처리방침 URL</FieldLabel>
              <input
                type="url"
                value={d.privacyUrl}
                onChange={(e) => set({ privacyUrl: e.target.value })}
                placeholder="https://"
                className={inputCls}
                data-testid="pg-booking-type-form-a-privacy"
              />
            </div>
            <div>
              <FieldLabel>시간대</FieldLabel>
              <input
                value={d.timezone}
                onChange={(e) => set({ timezone: e.target.value })}
                className={inputCls}
                data-testid="pg-booking-type-form-a-timezone"
              />
            </div>
          </div>
        </Section>
      </div>

      <div className="sticky -bottom-24 z-10 -mx-px mt-4 bg-background px-px pb-[72px]">
        <div className="flex items-center justify-end gap-2 rounded-xl border bg-card px-4 py-3 shadow-lg">
          <span
            className={cn(
              "mr-auto text-xs",
              dirty
                ? "text-amber-700 dark:text-amber-400"
                : "text-muted-foreground",
            )}
          >
            {dirty ? "저장 안 됨" : isNew ? "" : "저장됨"}
          </span>
          <button
            onClick={reset}
            disabled={!dirty}
            className="rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-40"
            data-testid="pg-booking-type-form-a-reset"
          >
            되돌리기
          </button>
          <button
            onClick={save}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            data-testid="pg-booking-type-form-a-save"
          >
            {isNew ? "만들기" : "저장"}
          </button>
        </div>
      </div>
    </div>
  );
}
