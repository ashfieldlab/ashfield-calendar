"use client"

// 안 C: 주간 슬롯 격자. 브랜드 색 머리띠 아래 월~금 x 시간 격자에서 날짜와 시간을 한 번에 고르고, 오른쪽 패널에서 바로 입력.

import { useState } from "react"
import { CalendarX2, Check, ChevronLeft, ChevronRight, Clock, Globe, Link2Off, Mail, User, X } from "lucide-react"

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
  hm,
  inputCls,
  inputValue,
  slotEnd,
  slotLabel,
  timeLabel,
  useBookingFlow,
  useReschedule,
  weeksOf,
  ymdOf,
  type BookingFlow,
  type Day,
  type Scenario,
} from "./shared"

const T = "pg-public-booking-c"
const WEEKS = weeksOf(DAYS)
const ROWS = DAYS[0].slots.map((s) => hm(s.iso))

export function VariantC({ scenario }: { scenario: Scenario }) {
  const f = useBookingFlow(scenario)

  if (scenario === "error") {
    return (
      <PublicCanvas>
        <div className="bg-primary px-8 py-10 text-primary-foreground">
          <Link2Off className="mb-3 size-7 opacity-80" />
          <h1 className="text-2xl font-bold">존재하지 않거나 종료된 예약입니다</h1>
        </div>
      </PublicCanvas>
    )
  }

  return (
    <PublicCanvas>
      <header className="bg-primary px-8 pt-8 pb-14 text-primary-foreground">
        <p className="text-sm opacity-75">{BOOKING_TYPE.organization}</p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight">{BOOKING_TYPE.title}</h1>
        <div className="mt-3 flex flex-wrap gap-2 text-xs">
          <span className="flex items-center gap-1 rounded-full bg-primary-foreground/15 px-2.5 py-1">
            <Clock className="size-3.5" />
            {BOOKING_TYPE.durationMinutes}분
          </span>
          <span className="flex items-center gap-1 rounded-full bg-primary-foreground/15 px-2.5 py-1">
            <Globe className="size-3.5" />
            {BOOKING_TYPE.timezone}
          </span>
        </div>
        <p className="mt-4 max-w-2xl whitespace-pre-line text-sm leading-relaxed opacity-85">{BOOKING_TYPE.description}</p>
      </header>

      <div className="relative -mt-8 px-6 pb-8">
        {f.step === "done" ? (
          <Ticket f={f} />
        ) : (
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
            <WeekGrid f={f} />
            <Panel f={f} />
          </div>
        )}
      </div>
    </PublicCanvas>
  )
}

function WeekGrid({ f }: { f: BookingFlow }) {
  const empty = f.days.length === 0
  const firstOpen = Math.max(
    0,
    WEEKS.findIndex((w) => w.some((d) => d.open.length > 0)),
  )
  const [wi, setWi] = useState(firstOpen)
  const week = WEEKS[wi]
  const start = week[0].date
  const end = week[week.length - 1].date

  return (
    <div className="min-w-0 rounded-2xl border bg-card p-4 shadow-sm">
      <div className="mb-3 flex items-center gap-2">
        <button
          type="button"
          onClick={() => setWi((i) => i - 1)}
          disabled={wi === 0}
          aria-label="이전 주"
          data-testid={`${T}-week-prev`}
          className="grid size-8 place-items-center rounded-lg border hover:bg-muted disabled:opacity-30"
        >
          <ChevronLeft className="size-4" />
        </button>
        <button
          type="button"
          onClick={() => setWi((i) => i + 1)}
          disabled={wi === WEEKS.length - 1}
          aria-label="다음 주"
          data-testid={`${T}-week-next`}
          className="grid size-8 place-items-center rounded-lg border hover:bg-muted disabled:opacity-30"
        >
          <ChevronRight className="size-4" />
        </button>
        <span className="ml-1 text-sm font-semibold">
          {start.getMonth() + 1}월 {start.getDate()}일 ~ {end.getMonth() + 1}월 {end.getDate()}일
        </span>
      </div>

      <div className="relative overflow-x-auto">
        <div className="grid min-w-[520px] gap-1.5" style={{ gridTemplateColumns: `repeat(${week.length}, minmax(0, 1fr))` }}>
          {week.map((d) => (
            <div key={d.ymd} className="pb-1 text-center">
              <p className="text-[11px] text-muted-foreground">{WD[d.date.getDay()]}</p>
              <p className={cn("text-lg font-bold", d.open.length === 0 || empty ? "text-muted-foreground/50" : "")}>{d.date.getDate()}</p>
            </div>
          ))}
          {ROWS.map((row) =>
            week.map((d) => <Cell key={`${d.ymd}-${row}`} day={d} row={row} f={f} hidden={empty} />),
          )}
        </div>
        {empty && (
          <div className="absolute inset-0 grid place-items-center bg-card/70" data-testid={`${T}-no-slots`}>
            <p className="flex items-center gap-2 rounded-full border bg-card px-4 py-2 text-sm text-muted-foreground shadow-sm">
              <CalendarX2 className="size-4" />
              가능한 시간이 없습니다
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

function Cell({ day, row, f, hidden }: { day: Day; row: string; f: BookingFlow; hidden: boolean }) {
  const s = day.open.find((x) => hm(x.iso) === row)
  if (!s || hidden) return <span className="grid h-9 place-items-center text-xs text-muted-foreground/30">-</span>
  const sel = f.slot === s.iso
  return (
    <button
      type="button"
      onClick={() => {
        f.pickDate(day.ymd)
        f.pickSlot(s.iso)
      }}
      data-testid={`${T}-slot-${s.iso}`}
      className={cn(
        "h-9 rounded-lg text-xs font-semibold tabular-nums transition",
        sel ? "bg-primary text-primary-foreground shadow-sm" : "bg-primary/10 text-primary hover:bg-primary/20",
      )}
    >
      {row}
    </button>
  )
}

function Panel({ f }: { f: BookingFlow }) {
  const ready = !!f.slot && f.step === "form"
  return (
    <aside className="h-fit space-y-3 rounded-2xl border bg-card p-4 shadow-sm lg:sticky lg:top-4">
      <div className={cn("rounded-xl border-2 border-dashed px-3 py-2.5 text-sm", ready ? "border-primary/50 bg-primary/5" : "border-border text-muted-foreground")}>
        {ready && f.slot ? (
          <div className="flex items-start gap-2">
            <p className="flex-1 font-semibold text-primary">{slotLabel(f.slot)}</p>
            <button
              type="button"
              onClick={() => {
                f.selectSlot(null)
                f.goto("date")
              }}
              aria-label="선택 해제"
              data-testid={`${T}-clear-button`}
              className="rounded p-0.5 text-muted-foreground hover:bg-muted"
            >
              <X className="size-4" />
            </button>
          </div>
        ) : (
          "시간 선택 안 함"
        )}
      </div>
      <fieldset disabled={!ready} className="space-y-3 disabled:opacity-50">
        <input value={f.form.name} onChange={(e) => f.setField("name", e.target.value)} placeholder="이름" className={inputCls} data-testid={`${T}-name-input`} />
        <input type="email" value={f.form.email} onChange={(e) => f.setField("email", e.target.value)} placeholder="이메일" className={inputCls} data-testid={`${T}-email-input`} />
        <textarea rows={3} value={f.form.message} onChange={(e) => f.setField("message", e.target.value)} placeholder="메시지 (선택)" className={cn(inputCls, "resize-none")} data-testid={`${T}-message-input`} />
        <label className="flex gap-2 text-xs leading-relaxed text-muted-foreground">
          <input
            type="checkbox"
            checked={f.form.consent}
            onChange={(e) => f.setField("consent", e.target.checked)}
            className="mt-0.5 size-4 shrink-0 accent-primary"
            data-testid={`${T}-consent-input`}
          />
          <span>
            <strong className="text-foreground">(필수) 개인정보 수집과 이용 동의.</strong> {CONSENT_DETAIL}{" "}
            <a href={BOOKING_TYPE.privacyUrl} target="_blank" rel="noopener noreferrer" className="text-primary underline" data-testid={`${T}-privacy-link`}>
              처리방침
            </a>
          </span>
        </label>
        <button
          type="button"
          onClick={f.submit}
          disabled={!f.valid || f.submitting}
          data-testid={`${T}-submit-button`}
          className="w-full rounded-lg bg-primary py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-40"
        >
          {f.submitting ? "처리 중…" : "예약하기"}
        </button>
      </fieldset>
    </aside>
  )
}

function Ticket({ f }: { f: BookingFlow }) {
  const d = f.slot ? new Date(f.slot) : null
  return (
    <div className="mx-auto flex max-w-2xl overflow-hidden rounded-2xl border bg-card shadow-sm" data-testid={`${T}-done`}>
      <div className="flex w-32 shrink-0 flex-col items-center justify-center border-r-2 border-dashed bg-primary/10 py-6 text-primary">
        <p className="text-sm font-medium">{d && `${d.getMonth() + 1}월`}</p>
        <p className="text-5xl font-bold leading-none">{d?.getDate()}</p>
        <p className="mt-1 text-sm">{d && `${WD[d.getDay()]}요일`}</p>
      </div>
      <div className="flex-1 space-y-3 p-6">
        <p className="flex items-center gap-1.5 text-sm font-semibold text-emerald-700 dark:text-emerald-400">
          <Check className="size-4" strokeWidth={3} />
          예약 완료
        </p>
        <h2 className="text-xl font-bold">{BOOKING_TYPE.title}</h2>
        <p className="text-sm text-foreground/80">
          {f.slot && `${timeLabel(f.slot)} ~ ${timeLabel(slotEnd(f.slot))}`}, {BOOKING_TYPE.timezone}
        </p>
        <div className="space-y-1 border-t pt-3 text-sm text-muted-foreground">
          <p className="flex items-center gap-2">
            <User className="size-4" />
            {f.form.name}
          </p>
          <p className="flex items-center gap-2">
            <Mail className="size-4" />
            {f.form.email}: 안내 메일 발송, 변경과 취소 링크 포함
          </p>
        </div>
      </div>
    </div>
  )
}

// ---------- 일정 변경 모달: 주간 격자 ----------

export function RescheduleC() {
  const r = useReschedule()
  const currentYmd = ymdOf(new Date(BOOKING.slotIso))
  const [wi, setWi] = useState(() => Math.max(0, WEEKS.findIndex((w) => w.some((d) => d.ymd === currentYmd))))
  const week = WEEKS[wi]

  return (
    <div className="w-full max-w-[760px] overflow-hidden rounded-2xl bg-card shadow-2xl dark:ring-1 dark:ring-foreground/10">
      <header className="flex items-start justify-between gap-3 border-b px-5 py-4">
        <div>
          <h3 className="font-semibold">예약 시간 변경</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {BOOKING.customerName}, {BOOKING.customerEmail}
          </p>
        </div>
        <button type="button" onClick={r.close} aria-label="닫기" data-testid={`${T}-resched-close-button`} className="rounded-md p-1.5 text-muted-foreground hover:bg-muted">
          <X className="size-4" />
        </button>
      </header>

      <div className="px-5 py-4">
        <div className="mb-3 flex items-center gap-2">
          <button type="button" onClick={() => setWi((i) => i - 1)} disabled={wi === 0} aria-label="이전 주" data-testid={`${T}-resched-week-prev`} className="grid size-7 place-items-center rounded-md border hover:bg-muted disabled:opacity-30">
            <ChevronLeft className="size-4" />
          </button>
          <button type="button" onClick={() => setWi((i) => i + 1)} disabled={wi === WEEKS.length - 1} aria-label="다음 주" data-testid={`${T}-resched-week-next`} className="grid size-7 place-items-center rounded-md border hover:bg-muted disabled:opacity-30">
            <ChevronRight className="size-4" />
          </button>
          <span className="text-sm font-medium">
            {week[0].date.getMonth() + 1}월 {week[0].date.getDate()}일 주
          </span>
          <span className="ml-auto flex items-center gap-3 text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1">
              <span className="size-2.5 rounded-sm ring-2 ring-foreground/60 ring-inset" />
              현재
            </span>
            {r.force && (
              <span className="flex items-center gap-1">
                <span className="size-2.5 rounded-sm bg-amber-200 dark:bg-amber-800" />
                마감
              </span>
            )}
          </span>
        </div>
        <div className="overflow-x-auto">
          <div className="grid min-w-[520px] gap-1" style={{ gridTemplateColumns: `44px repeat(${week.length}, minmax(0, 1fr))` }}>
            <span />
            {week.map((d) => (
              <span key={d.ymd} className="pb-1 text-center text-xs font-medium">
                {WD[d.date.getDay()]} {d.date.getDate()}
              </span>
            ))}
            {ROWS.map((row) => (
              <RowCells key={row} row={row} week={week} r={r} />
            ))}
          </div>
        </div>
      </div>

      <div className="grid gap-4 border-t px-5 py-4 sm:grid-cols-2">
        <div className="space-y-2">
          <div className="rounded-lg bg-muted/50 px-3 py-2 text-xs">
            <p className={cn(r.target && "text-muted-foreground line-through")}>{slotLabel(BOOKING.slotIso)}</p>
            <p className={cn("font-semibold", r.target ? "text-primary" : "text-muted-foreground")}>{r.target ? slotLabel(r.target) : "새 시간 선택 안 함"}</p>
          </div>
          <textarea rows={2} value={r.memo} onChange={(e) => r.setMemo(e.target.value)} placeholder="메모" className={cn(inputCls, "resize-none")} data-testid={`${T}-resched-memo-input`} />
        </div>
        <div className="space-y-2.5 text-sm">
          <div className="flex items-center justify-between gap-3">
            <span>
              가용 시간 외 강제
              <span className="block text-xs text-muted-foreground">요일, 시간, 정원 검증 생략</span>
            </span>
            <Switch checked={r.force} onChange={r.setForce} label="가용 시간 외 강제" testid={`${T}-resched-force-switch`} />
          </div>
          {r.force && (
            <input
              type="datetime-local"
              value={r.target ? inputValue(r.target) : ""}
              onChange={(e) => e.target.value && r.setTarget(new Date(e.target.value).toISOString())}
              className={cn(inputCls, "py-1.5")}
              data-testid={`${T}-resched-custom-input`}
            />
          )}
          <div className="flex items-center justify-between gap-3">
            <span>고객에게 변경 안내 메일</span>
            <Switch checked={r.notify} onChange={r.setNotify} label="고객에게 변경 안내 메일" testid={`${T}-resched-notify-switch`} />
          </div>
        </div>
      </div>

      <footer className="flex justify-end gap-2 border-t px-5 py-3">
        <button type="button" onClick={r.close} disabled={r.busy} data-testid={`${T}-resched-cancel-button`} className="rounded-lg border px-3.5 py-2 text-sm hover:bg-muted">
          취소
        </button>
        <button
          type="button"
          onClick={r.submit}
          disabled={!r.target || r.busy}
          data-testid={`${T}-resched-submit-button`}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-40"
        >
          {r.busy ? "처리 중…" : "변경 적용"}
        </button>
      </footer>
    </div>
  )
}

function RowCells({ row, week, r }: { row: string; week: Day[]; r: ReturnType<typeof useReschedule> }) {
  return (
    <>
      <span className="grid h-7 items-center text-[11px] text-muted-foreground tabular-nums">{row}</span>
      {week.map((d) => {
        const s = d.slots.find((x) => hm(x.iso) === row)
        if (!s) return <span key={d.ymd} />
        const current = s.iso === BOOKING.slotIso
        const sel = s.iso === r.target
        const pickable = !current && (s.open || r.force)
        return (
          <button
            key={d.ymd}
            type="button"
            disabled={!pickable}
            onClick={() => {
              r.setYmd(d.ymd)
              r.setTarget(s.iso)
            }}
            aria-label={slotLabel(s.iso)}
            data-testid={`${T}-resched-slot-${s.iso}`}
            className={cn(
              "h-7 rounded-md transition",
              sel
                ? "bg-primary"
                : current
                  ? "ring-2 ring-foreground/60 ring-inset"
                  : s.open
                    ? "bg-primary/10 hover:bg-primary/25"
                    : r.force
                      ? "bg-amber-200 hover:bg-amber-300 dark:bg-amber-800 dark:hover:bg-amber-700"
                      : "bg-muted/40",
            )}
          >
            {sel && <Check className="mx-auto size-3.5 text-primary-foreground" strokeWidth={3} />}
          </button>
        )
      })}
    </>
  )
}

export function RescheduleStageC() {
  return (
    <ModalStage>
      <RescheduleC />
    </ModalStage>
  )
}
