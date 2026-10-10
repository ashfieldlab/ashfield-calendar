"use client"

// 안 B: 모바일 우선 단계형. 폰 폭 한 열, 위에 진행 막대, 아래 고정 버튼. 날짜 목록, 오전과 오후로 나눈 시간, 정보, 완료.

import { useState } from "react"
import { CalendarX2, Check, ChevronDown, ChevronLeft, ChevronRight, Clock, Link2Off, Mail, X } from "lucide-react"

import { cn } from "@/lib/utils"

import {
  BOOKING,
  BOOKING_TYPE,
  CONSENT_DETAIL,
  DAYS,
  ModalStage,
  PublicCanvas,
  Switch,
  WD,
  dayLabel,
  hm,
  inputCls,
  inputValue,
  isAm,
  longDayLabel,
  slotLabel,
  timeLabel,
  useBookingFlow,
  useReschedule,
  weeksOf,
  type BookingFlow,
  type Scenario,
  type Slot,
} from "./shared"

const T = "pg-public-booking-b"
const STEPS = ["날짜", "시간", "정보", "완료"] as const
const STEP_INDEX = { date: 0, time: 1, form: 2, done: 3 } as const

export function VariantB({ scenario }: { scenario: Scenario }) {
  const f = useBookingFlow(scenario)
  const idx = STEP_INDEX[f.step]

  return (
    <PublicCanvas className="flex justify-center bg-muted/50 py-8">
      <div className="flex h-[640px] w-full max-w-[390px] flex-col overflow-hidden rounded-[28px] border bg-background shadow-xl">
        {scenario === "error" ? (
          <div className="grid flex-1 place-items-center p-8 text-center">
            <div>
              <Link2Off className="mx-auto mb-3 size-8 text-muted-foreground" />
              <p className="font-semibold">존재하지 않거나 종료된 예약입니다</p>
            </div>
          </div>
        ) : (
          <>
            <header className="bg-primary px-5 pt-5 pb-4 text-primary-foreground">
              <div className="flex items-center gap-2">
                {(f.step === "time" || f.step === "form") && (
                  <button type="button" onClick={f.back} aria-label="뒤로" data-testid={`${T}-back-button`} className="-ml-2 rounded-full p-1.5 hover:bg-primary-foreground/15">
                    <ChevronLeft className="size-5" />
                  </button>
                )}
                <div className="min-w-0">
                  <p className="text-xs opacity-75">{BOOKING_TYPE.organization}</p>
                  <h1 className="truncate text-lg font-bold">{BOOKING_TYPE.title}</h1>
                </div>
                <span className="ml-auto flex shrink-0 items-center gap-1 rounded-full bg-primary-foreground/15 px-2.5 py-1 text-xs">
                  <Clock className="size-3" />
                  {BOOKING_TYPE.durationMinutes}분
                </span>
              </div>
              <ol className="mt-4 grid grid-cols-4 gap-1.5">
                {STEPS.map((s, i) => (
                  <li key={s} className="space-y-1">
                    <div className={cn("h-1 rounded-full", i <= idx ? "bg-primary-foreground" : "bg-primary-foreground/25")} />
                    <span className={cn("text-[11px]", i === idx ? "font-semibold" : "opacity-60")}>{s}</span>
                  </li>
                ))}
              </ol>
            </header>

            {f.step === "date" && <DateStep f={f} />}
            {f.step === "time" && <TimeStep f={f} />}
            {f.step === "form" && <FormStep f={f} />}
            {f.step === "done" && <DoneStep f={f} />}
          </>
        )}
      </div>
    </PublicCanvas>
  )
}

function DateStep({ f }: { f: BookingFlow }) {
  if (f.days.length === 0) {
    return (
      <div className="grid flex-1 place-items-center text-center text-sm text-muted-foreground" data-testid={`${T}-no-slots`}>
        <div>
          <CalendarX2 className="mx-auto mb-2 size-7" />
          가능한 시간이 없습니다
        </div>
      </div>
    )
  }
  // 마감인 날도 줄에 남겨 날짜 흐름이 끊기지 않게
  const weeks = weeksOf(DAYS)
  return (
    <div className="flex-1 overflow-y-auto px-4 py-3">
      {weeks.map((w) => (
        <section key={w[0].ymd} className="mb-3">
          <h2 className="sticky top-0 bg-background py-1.5 text-xs font-semibold text-muted-foreground">
            {w[0].date.getMonth() + 1}월 {w[0].date.getDate()}일 주
          </h2>
          <ul className="divide-y rounded-2xl border">
            {w.map((d) => {
              const n = d.open.length
              return (
                <li key={d.ymd}>
                  <button
                    type="button"
                    disabled={n === 0}
                    onClick={() => f.pickDate(d.ymd)}
                    data-testid={`${T}-day-${d.ymd}`}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left transition active:bg-muted disabled:opacity-45"
                  >
                    <span className="w-8 text-center text-xl font-bold tabular-nums">{d.date.getDate()}</span>
                    <span className="text-sm">{WD[d.date.getDay()]}요일</span>
                    <span className={cn("ml-auto text-xs", n ? "font-medium text-primary" : "text-muted-foreground")}>{n ? `${n}개` : "마감"}</span>
                    {n > 0 && <ChevronRight className="size-4 text-muted-foreground" />}
                  </button>
                </li>
              )
            })}
          </ul>
        </section>
      ))}
    </div>
  )
}

function TimeStep({ f }: { f: BookingFlow }) {
  const day = f.day
  if (!day) return null
  const groups: [string, Slot[]][] = [
    ["오전", day.open.filter((s) => isAm(s.iso))],
    ["오후", day.open.filter((s) => !isAm(s.iso))],
  ]
  return (
    <>
      <div className="flex-1 overflow-y-auto px-4 py-4">
        <p className="mb-4 text-base font-semibold">{longDayLabel(day.date)}</p>
        {groups.map(([label, list]) =>
          list.length === 0 ? null : (
            <section key={label} className="mb-5">
              <h3 className="mb-2 text-xs font-semibold text-muted-foreground">{label}</h3>
              <div className="grid grid-cols-3 gap-2">
                {list.map((s) => (
                  <button
                    key={s.iso}
                    type="button"
                    onClick={() => f.selectSlot(s.iso)}
                    data-testid={`${T}-slot-${s.iso}`}
                    className={cn(
                      "rounded-xl border py-3 text-sm font-semibold tabular-nums transition",
                      f.slot === s.iso ? "border-primary bg-primary text-primary-foreground" : "active:bg-muted",
                    )}
                  >
                    {hm(s.iso)}
                  </button>
                ))}
              </div>
            </section>
          ),
        )}
      </div>
      <BottomBar>
        <button
          type="button"
          disabled={!f.slot}
          onClick={() => f.slot && f.pickSlot(f.slot)}
          data-testid={`${T}-next-button`}
          className="w-full rounded-xl bg-primary py-3.5 text-base font-semibold text-primary-foreground disabled:opacity-40"
        >
          {f.slot ? `${timeLabel(f.slot)} 선택` : "시간 선택"}
        </button>
      </BottomBar>
    </>
  )
}

function FormStep({ f }: { f: BookingFlow }) {
  const [more, setMore] = useState(false)
  return (
    <>
      <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
        <div className="flex items-center gap-3 rounded-2xl bg-primary/10 px-4 py-3">
          <div className="min-w-0 flex-1 text-sm">
            <p className="font-semibold text-primary">{f.slot && slotLabel(f.slot)}</p>
            <p className="text-xs text-muted-foreground">{BOOKING_TYPE.timezone}</p>
          </div>
          <button type="button" onClick={() => f.goto("time")} data-testid={`${T}-change-button`} className="shrink-0 text-xs font-medium text-primary underline-offset-2 hover:underline">
            변경
          </button>
        </div>
        <input
          value={f.form.name}
          onChange={(e) => f.setField("name", e.target.value)}
          placeholder="이름"
          className={cn(inputCls, "rounded-xl py-3.5 text-base")}
          data-testid={`${T}-name-input`}
        />
        <input
          type="email"
          value={f.form.email}
          onChange={(e) => f.setField("email", e.target.value)}
          placeholder="이메일"
          className={cn(inputCls, "rounded-xl py-3.5 text-base")}
          data-testid={`${T}-email-input`}
        />
        <textarea
          rows={3}
          value={f.form.message}
          onChange={(e) => f.setField("message", e.target.value)}
          placeholder="메시지 (선택)"
          className={cn(inputCls, "resize-none rounded-xl py-3 text-base")}
          data-testid={`${T}-message-input`}
        />
        <div className="rounded-xl border">
          <div className="flex items-center gap-3 px-3 py-3">
            <button
              type="button"
              role="checkbox"
              aria-checked={f.form.consent}
              onClick={() => f.setField("consent", !f.form.consent)}
              data-testid={`${T}-consent-input`}
              className={cn(
                "grid size-6 shrink-0 place-items-center rounded-full border-2 transition",
                f.form.consent ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/40",
              )}
            >
              {f.form.consent && <Check className="size-3.5" strokeWidth={3} />}
            </button>
            <span className="flex-1 text-sm">(필수) 개인정보 수집, 이용 동의</span>
            <button type="button" onClick={() => setMore((v) => !v)} aria-label="자세히" data-testid={`${T}-consent-more-button`} className="rounded p-1 text-muted-foreground">
              <ChevronDown className={cn("size-4 transition", more && "rotate-180")} />
            </button>
          </div>
          {more && (
            <p className="border-t px-3 py-2.5 text-xs leading-relaxed text-muted-foreground">
              {CONSENT_DETAIL}{" "}
              <a href={BOOKING_TYPE.privacyUrl} target="_blank" rel="noopener noreferrer" className="text-primary underline" data-testid={`${T}-privacy-link`}>
                개인정보 처리방침
              </a>
            </p>
          )}
        </div>
      </div>
      <BottomBar>
        <button
          type="button"
          onClick={f.submit}
          disabled={!f.valid || f.submitting}
          data-testid={`${T}-submit-button`}
          className="w-full rounded-xl bg-primary py-3.5 text-base font-semibold text-primary-foreground disabled:opacity-40"
        >
          {f.submitting ? "처리 중…" : "예약하기"}
        </button>
      </BottomBar>
    </>
  )
}

function DoneStep({ f }: { f: BookingFlow }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6 text-center" data-testid={`${T}-done`}>
      <div className="mb-4 grid size-16 place-items-center rounded-full bg-primary text-primary-foreground">
        <Check className="size-8" strokeWidth={3} />
      </div>
      <h2 className="text-xl font-bold">예약 완료</h2>
      <p className="mt-2 text-sm font-medium text-primary">{f.slot && slotLabel(f.slot)}</p>
      <div className="mt-6 w-full space-y-2 rounded-2xl bg-muted/60 p-4 text-left text-sm">
        <p className="flex items-center gap-2">
          <Mail className="size-4 text-muted-foreground" />
          {f.form.email}
        </p>
        <p className="text-xs text-muted-foreground">변경, 취소는 메일의 링크로</p>
      </div>
    </div>
  )
}

function BottomBar({ children }: { children: React.ReactNode }) {
  return <div className="border-t bg-background/95 p-4 backdrop-blur">{children}</div>
}

// ---------- 일정 변경 모달: 시트형 ----------

export function RescheduleB() {
  const r = useReschedule()
  const days = DAYS.filter((d) => r.force || d.open.length > 0)
  const slots = r.slotsOf(r.day)

  return (
    <div className="flex max-h-[660px] w-full max-w-[400px] flex-col overflow-hidden rounded-3xl bg-card shadow-2xl dark:ring-1 dark:ring-foreground/10">
      <div className="mx-auto mt-2.5 h-1 w-10 rounded-full bg-muted-foreground/30" />
      <header className="flex items-center justify-between px-5 pt-3 pb-2">
        <h3 className="text-base font-semibold">예약 시간 변경</h3>
        <button type="button" onClick={r.close} aria-label="닫기" data-testid={`${T}-resched-close-button`} className="rounded-full bg-muted p-1.5 text-muted-foreground">
          <X className="size-4" />
        </button>
      </header>

      <div className="flex-1 space-y-4 overflow-y-auto px-5 pb-4">
        <div className="rounded-2xl bg-muted/60 px-4 py-3 text-sm">
          <p className="font-medium">
            {BOOKING.customerName} <span className="font-normal text-muted-foreground">{BOOKING.customerEmail}</span>
          </p>
          <p className={cn("mt-1", r.target ? "text-muted-foreground line-through" : "text-foreground/80")}>{slotLabel(BOOKING.slotIso)}</p>
          {r.target && <p className="font-semibold text-primary">{slotLabel(r.target)}</p>}
        </div>

        <div className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1">
          {days.map((d) => (
            <button
              key={d.ymd}
              type="button"
              onClick={() => r.setYmd(d.ymd)}
              data-testid={`${T}-resched-day-${d.ymd}`}
              className={cn(
                "flex w-12 shrink-0 flex-col items-center rounded-2xl border py-2 transition",
                r.ymd === d.ymd ? "border-primary bg-primary text-primary-foreground" : "active:bg-muted",
              )}
            >
              <span className="text-[11px] opacity-70">{WD[d.date.getDay()]}</span>
              <span className="text-base font-bold">{d.date.getDate()}</span>
            </button>
          ))}
        </div>

        <div className="grid grid-cols-4 gap-1.5">
          {slots.map((s) => {
            const current = s.iso === BOOKING.slotIso
            return (
              <button
                key={s.iso}
                type="button"
                disabled={current}
                onClick={() => r.setTarget(s.iso)}
                data-testid={`${T}-resched-slot-${s.iso}`}
                className={cn(
                  "rounded-xl border py-2 text-sm font-semibold tabular-nums transition",
                  r.target === s.iso
                    ? "border-primary bg-primary text-primary-foreground"
                    : current
                      ? "border-dashed text-muted-foreground line-through"
                      : s.open
                        ? "active:bg-muted"
                        : "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300",
                )}
              >
                {hm(s.iso)}
              </button>
            )
          })}
        </div>
        {r.day && slots.length === 0 && <p className="text-center text-sm text-muted-foreground">{dayLabel(r.day.date)} 마감</p>}

        {r.force && (
          <input
            type="datetime-local"
            value={r.target ? inputValue(r.target) : ""}
            onChange={(e) => e.target.value && r.setTarget(new Date(e.target.value).toISOString())}
            className={cn(inputCls, "rounded-xl")}
            data-testid={`${T}-resched-custom-input`}
          />
        )}

        <textarea
          rows={2}
          value={r.memo}
          onChange={(e) => r.setMemo(e.target.value)}
          placeholder="메모"
          className={cn(inputCls, "resize-none rounded-xl")}
          data-testid={`${T}-resched-memo-input`}
        />

        <div className="divide-y rounded-2xl border text-sm">
          <div className="flex items-center justify-between gap-3 px-4 py-3">
            <div>
              <p>가용 시간 외 강제</p>
              <p className="text-xs text-muted-foreground">요일, 시간, 정원 검증 생략</p>
            </div>
            <Switch checked={r.force} onChange={r.setForce} label="가용 시간 외 강제" testid={`${T}-resched-force-switch`} />
          </div>
          <div className="flex items-center justify-between gap-3 px-4 py-3">
            <p>고객에게 변경 안내 메일</p>
            <Switch checked={r.notify} onChange={r.setNotify} label="고객에게 변경 안내 메일" testid={`${T}-resched-notify-switch`} />
          </div>
        </div>
      </div>

      <div className="border-t p-4">
        <button
          type="button"
          onClick={r.submit}
          disabled={!r.target || r.busy}
          data-testid={`${T}-resched-submit-button`}
          className="w-full rounded-xl bg-primary py-3 text-base font-semibold text-primary-foreground disabled:opacity-40"
        >
          {r.busy ? "처리 중…" : "변경 적용"}
        </button>
      </div>
    </div>
  )
}

export function RescheduleStageB() {
  return (
    <ModalStage>
      <RescheduleB />
    </ModalStage>
  )
}

