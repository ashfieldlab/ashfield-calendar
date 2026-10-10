"use client"

// 안 A: Calendly식 3단. 왼쪽 양식 정보, 가운데 월 달력, 오른쪽 시간 열. 시간을 누르면 [시간][다음] 으로 갈라진다.

import { useState } from "react"
import {
  ArrowLeft,
  ArrowRight,
  CalendarCheck,
  CalendarX2,
  ChevronLeft,
  ChevronRight,
  CircleCheck,
  Clock,
  Globe,
  Link2Off,
  Mail,
  User,
  X,
} from "lucide-react"

import { cn } from "@/lib/utils"

import {
  BOOKING,
  BOOKING_TYPE,
  CONSENT_DETAIL,
  DAYS,
  ModalStage,
  PublicCanvas,
  Switch,
  TODAY_YMD,
  WD,
  dayLabel,
  inputCls,
  inputValue,
  longDayLabel,
  monthCells,
  slotLabel,
  timeLabel,
  useBookingFlow,
  useReschedule,
  ymdOf,
  type BookingFlow,
  type Day,
  type Scenario,
} from "./shared"

const T = "pg-public-booking-a"

export function VariantA({ scenario }: { scenario: Scenario }) {
  const f = useBookingFlow(scenario)

  if (scenario === "error") {
    return (
      <PublicCanvas className="grid place-items-center bg-muted/40">
        <div className="w-full max-w-sm rounded-2xl border bg-card p-8 text-center shadow-sm">
          <div className="mx-auto mb-4 grid size-12 place-items-center rounded-full bg-muted text-muted-foreground">
            <Link2Off className="size-5" />
          </div>
          <h1 className="font-semibold">존재하지 않거나 종료된 예약입니다</h1>
        </div>
      </PublicCanvas>
    )
  }

  return (
    <PublicCanvas className="flex items-start justify-center bg-muted/40 px-4 py-10">
      <div className="w-full max-w-[1000px] overflow-hidden rounded-2xl border bg-card shadow-sm">
        {f.step === "done" ? (
          <Done f={f} />
        ) : (
          <div className="grid md:grid-cols-[280px_minmax(0,1fr)]">
            <Info f={f} />
            <div className="min-w-0 border-t p-6 md:border-t-0 md:border-l">
              {f.step === "form" ? <Form f={f} /> : <Picker f={f} />}
            </div>
          </div>
        )}
      </div>
    </PublicCanvas>
  )
}

function Info({ f }: { f: BookingFlow }) {
  return (
    <aside className="space-y-4 p-6">
      {f.step === "form" && (
        <button
          type="button"
          onClick={f.back}
          aria-label="뒤로"
          data-testid={`${T}-back-button`}
          className="grid size-9 place-items-center rounded-full border text-primary hover:bg-primary/10"
        >
          <ArrowLeft className="size-4" />
        </button>
      )}
      <div>
        <p className="text-sm font-medium text-muted-foreground">{BOOKING_TYPE.organization}</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight">{BOOKING_TYPE.title}</h1>
      </div>
      <ul className="space-y-2 text-sm text-muted-foreground">
        <li className="flex items-center gap-2">
          <Clock className="size-4" />
          {BOOKING_TYPE.durationMinutes}분
        </li>
        <li className="flex items-center gap-2">
          <Globe className="size-4" />
          {BOOKING_TYPE.timezone}
        </li>
        {f.slot && f.step === "form" && (
          <li className="flex items-start gap-2 font-medium text-primary">
            <CalendarCheck className="mt-0.5 size-4 shrink-0" />
            {slotLabel(f.slot)}
          </li>
        )}
      </ul>
      <p className="whitespace-pre-line text-sm leading-relaxed text-foreground/80">{BOOKING_TYPE.description}</p>
    </aside>
  )
}

function Picker({ f }: { f: BookingFlow }) {
  const first = f.days[0]?.date ?? new Date(2026, 9, 1)
  const [view, setView] = useState(() => new Date(first.getFullYear(), first.getMonth(), 1))
  const available = new Set(f.days.map((d) => d.ymd))
  const lastDay = f.days[f.days.length - 1]?.date
  const canPrev = view.getTime() > new Date(first.getFullYear(), first.getMonth(), 1).getTime()
  const canNext = !!lastDay && view.getTime() < new Date(lastDay.getFullYear(), lastDay.getMonth(), 1).getTime()
  const day = f.days.find((d) => d.ymd === f.ymd) ?? null

  return (
    <div>
      <h2 className="mb-5 text-lg font-semibold">날짜와 시간 선택</h2>
      <div className={cn("grid gap-6", day && "lg:grid-cols-[minmax(0,1fr)_200px]")}>
        <div className="mx-auto w-full max-w-[420px]">
          <MonthGrid
            view={view}
            onView={setView}
            canPrev={canPrev}
            canNext={canNext}
            isAvailable={(ymd) => available.has(ymd)}
            selected={f.ymd}
            onSelect={f.pickDate}
            testid={T}
          />
          {f.days.length === 0 && (
            <div className="mt-4 flex items-center justify-center gap-2 rounded-lg bg-muted/60 p-3 text-sm text-muted-foreground" data-testid={`${T}-no-slots`}>
              <CalendarX2 className="size-4" />
              가능한 시간이 없습니다
            </div>
          )}
        </div>
        {day && <TimeColumn day={day} f={f} />}
      </div>
    </div>
  )
}

function TimeColumn({ day, f }: { day: Day; f: BookingFlow }) {
  return (
    <div className="min-w-0">
      <p className="mb-3 text-sm font-medium">{longDayLabel(day.date)}</p>
      <div className="max-h-[380px] space-y-2 overflow-y-auto pr-1">
        {day.open.map((s) =>
          f.slot === s.iso ? (
            <div key={s.iso} className="grid grid-cols-2 gap-1.5">
              <span className="grid place-items-center rounded-lg bg-foreground/75 py-2.5 text-sm font-semibold text-background">
                {timeLabel(s.iso)}
              </span>
              <button
                type="button"
                onClick={() => f.pickSlot(s.iso)}
                data-testid={`${T}-next-button`}
                className="rounded-lg bg-primary py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
              >
                다음
              </button>
            </div>
          ) : (
            <button
              key={s.iso}
              type="button"
              onClick={() => f.selectSlot(s.iso)}
              data-testid={`${T}-slot-${s.iso}`}
              className="w-full rounded-lg border border-primary/40 py-2.5 text-sm font-semibold text-primary transition hover:border-primary hover:bg-primary/5"
            >
              {timeLabel(s.iso)}
            </button>
          ),
        )}
      </div>
    </div>
  )
}

function Form({ f }: { f: BookingFlow }) {
  return (
    <div className="max-w-lg space-y-4">
      <h2 className="text-lg font-semibold">정보 입력</h2>
      <label className="block space-y-1.5">
        <span className="text-sm font-medium">이름</span>
        <input value={f.form.name} onChange={(e) => f.setField("name", e.target.value)} className={inputCls} data-testid={`${T}-name-input`} />
      </label>
      <label className="block space-y-1.5">
        <span className="text-sm font-medium">이메일</span>
        <input type="email" value={f.form.email} onChange={(e) => f.setField("email", e.target.value)} className={inputCls} data-testid={`${T}-email-input`} />
      </label>
      <label className="block space-y-1.5">
        <span className="text-sm font-medium">
          메시지 <span className="font-normal text-muted-foreground">(선택)</span>
        </span>
        <textarea rows={3} value={f.form.message} onChange={(e) => f.setField("message", e.target.value)} className={cn(inputCls, "resize-none")} data-testid={`${T}-message-input`} />
      </label>
      <label className="flex gap-2.5 rounded-lg bg-muted/60 p-3 text-xs leading-relaxed text-foreground/80">
        <input
          type="checkbox"
          checked={f.form.consent}
          onChange={(e) => f.setField("consent", e.target.checked)}
          className="mt-0.5 size-4 shrink-0 accent-primary"
          data-testid={`${T}-consent-input`}
        />
        <span>
          <strong className="text-foreground">(필수) 개인정보 수집과 이용에 동의합니다.</strong> {CONSENT_DETAIL}{" "}
          <a href={BOOKING_TYPE.privacyUrl} target="_blank" rel="noopener noreferrer" className="text-primary underline" data-testid={`${T}-privacy-link`}>
            개인정보 처리방침
          </a>
        </span>
      </label>
      <button
        type="button"
        onClick={f.submit}
        disabled={!f.valid || f.submitting}
        data-testid={`${T}-submit-button`}
        className="rounded-full bg-primary px-7 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-40"
      >
        {f.submitting ? "처리 중…" : "예약하기"}
      </button>
    </div>
  )
}

function Done({ f }: { f: BookingFlow }) {
  return (
    <div className="mx-auto max-w-md px-6 py-14 text-center" data-testid={`${T}-done`}>
      <div className="mx-auto mb-4 grid size-14 place-items-center rounded-full bg-primary/10 text-primary">
        <CircleCheck className="size-7" />
      </div>
      <h1 className="text-xl font-bold">예약 완료</h1>
      <div className="mt-6 space-y-2.5 rounded-xl border p-4 text-left text-sm">
        <p className="font-semibold">{BOOKING_TYPE.title}</p>
        <p className="flex items-start gap-2 text-foreground/80">
          <CalendarCheck className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
          {f.slot && slotLabel(f.slot)}
        </p>
        <p className="flex items-center gap-2 text-foreground/80">
          <Globe className="size-4 text-muted-foreground" />
          {BOOKING_TYPE.timezone}
        </p>
        <p className="flex items-center gap-2 text-foreground/80">
          <Mail className="size-4 text-muted-foreground" />
          안내 메일 발송: {f.form.email}
        </p>
      </div>
      <p className="mt-4 text-xs text-muted-foreground">변경, 취소는 메일의 링크로</p>
    </div>
  )
}

/** 월 그리드: 일~토 */
export function MonthGrid({
  view,
  onView,
  canPrev,
  canNext,
  isAvailable,
  selected,
  onSelect,
  marked,
  testid,
  compact,
}: {
  view: Date
  onView: (d: Date) => void
  canPrev: boolean
  canNext: boolean
  isAvailable: (ymd: string) => boolean
  selected: string | null
  onSelect: (ymd: string) => void
  /** 현재 예약일 표시 */
  marked?: string
  testid: string
  compact?: boolean
}) {
  const cells = monthCells(view.getFullYear(), view.getMonth())
  const move = (n: number) => onView(new Date(view.getFullYear(), view.getMonth() + n, 1))
  return (
    <div>
      <div className="mb-3 flex items-center justify-center gap-4">
        <button
          type="button"
          onClick={() => move(-1)}
          disabled={!canPrev}
          aria-label="이전 달"
          data-testid={`${testid}-month-prev`}
          className="grid size-8 place-items-center rounded-full text-primary hover:bg-primary/10 disabled:text-muted-foreground/40 disabled:hover:bg-transparent"
        >
          <ChevronLeft className="size-4" />
        </button>
        <span className="min-w-24 text-center text-sm font-medium">
          {view.getFullYear()}년 {view.getMonth() + 1}월
        </span>
        <button
          type="button"
          onClick={() => move(1)}
          disabled={!canNext}
          aria-label="다음 달"
          data-testid={`${testid}-month-next`}
          className="grid size-8 place-items-center rounded-full text-primary hover:bg-primary/10 disabled:text-muted-foreground/40 disabled:hover:bg-transparent"
        >
          <ChevronRight className="size-4" />
        </button>
      </div>
      <div className="grid grid-cols-7 text-center text-[11px] font-medium text-muted-foreground">
        {WD.map((w) => (
          <span key={w} className="py-1.5">
            {w}
          </span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-y-1">
        {cells.map((c, i) => {
          if (!c) return <span key={i} />
          const ymd = ymdOf(c)
          const avail = isAvailable(ymd)
          const sel = ymd === selected
          return (
            <div key={ymd} className="grid place-items-center">
              <button
                type="button"
                disabled={!avail}
                onClick={() => onSelect(ymd)}
                data-testid={`${testid}-day-${ymd}`}
                className={cn(
                  "relative grid place-items-center rounded-full text-sm transition",
                  compact ? "size-9" : "size-11",
                  sel
                    ? "bg-primary font-semibold text-primary-foreground"
                    : avail
                      ? "bg-primary/10 font-semibold text-primary hover:bg-primary/20"
                      : "text-muted-foreground/50",
                  marked === ymd && !sel && "ring-2 ring-amber-400 dark:ring-amber-500",
                )}
              >
                {c.getDate()}
                {ymd === TODAY_YMD && <span className="absolute bottom-1 size-1 rounded-full bg-current" />}
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ---------- 일정 변경 모달 ----------

export function RescheduleA() {
  const r = useReschedule()
  const [view, setView] = useState(() => new Date(2026, 9, 1))
  const slots = r.slotsOf(r.day)
  const lastMonth = new Date(DAYS[DAYS.length - 1].date.getFullYear(), DAYS[DAYS.length - 1].date.getMonth(), 1)

  return (
    <div className="w-full max-w-[680px] overflow-hidden rounded-2xl bg-card shadow-2xl dark:ring-1 dark:ring-foreground/10">
      <header className="flex items-center justify-between border-b px-5 py-3.5">
        <h3 className="font-semibold">예약 시간 변경</h3>
        <button type="button" onClick={r.close} aria-label="닫기" data-testid={`${T}-resched-close-button`} className="rounded-md p-1.5 text-muted-foreground hover:bg-muted">
          <X className="size-4" />
        </button>
      </header>

      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 bg-muted/40 px-5 py-3 text-sm">
        <div>
          <p className="text-[11px] font-medium text-muted-foreground">현재</p>
          <p className={cn("font-medium", r.target && "text-muted-foreground line-through")}>{slotLabel(BOOKING.slotIso)}</p>
        </div>
        <ArrowRight className="size-4 text-muted-foreground" />
        <div>
          <p className="text-[11px] font-medium text-muted-foreground">변경</p>
          <p className={cn("font-medium", r.target ? "text-primary" : "text-muted-foreground")}>{r.target ? slotLabel(r.target) : "선택 안 함"}</p>
        </div>
        <p className="col-span-3 flex items-center gap-1.5 text-xs text-muted-foreground">
          <User className="size-3.5" />
          {BOOKING.customerName}, {BOOKING.customerEmail}
        </p>
      </div>

      <div className="grid gap-5 px-5 py-4 sm:grid-cols-[minmax(0,1fr)_180px]">
        <MonthGrid
          view={view}
          onView={setView}
          canPrev={view.getMonth() > 9 || view.getFullYear() > 2026}
          canNext={view.getTime() < lastMonth.getTime()}
          isAvailable={(ymd) => DAYS.some((d) => d.ymd === ymd && (r.force || d.open.length > 0))}
          selected={r.ymd}
          onSelect={r.setYmd}
          marked={ymdOf(new Date(BOOKING.slotIso))}
          testid={`${T}-resched`}
          compact
        />
        <div className="min-w-0">
          <p className="mb-2 text-sm font-medium">{r.day ? dayLabel(r.day.date) : ""}</p>
          <div className="max-h-[260px] space-y-1.5 overflow-y-auto pr-1">
            {slots.map((s) => {
              const current = s.iso === BOOKING.slotIso
              const sel = s.iso === r.target
              return (
                <button
                  key={s.iso}
                  type="button"
                  disabled={current}
                  onClick={() => r.setTarget(s.iso)}
                  data-testid={`${T}-resched-slot-${s.iso}`}
                  className={cn(
                    "flex w-full items-center justify-between rounded-lg border px-3 py-2 text-sm font-medium transition",
                    sel
                      ? "border-primary bg-primary text-primary-foreground"
                      : current
                        ? "border-dashed text-muted-foreground"
                        : s.open
                          ? "border-primary/40 text-primary hover:bg-primary/5"
                          : "border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300 dark:hover:bg-amber-950/70",
                  )}
                >
                  {timeLabel(s.iso)}
                  {current ? <span className="text-[11px]">현재</span> : !s.open && <span className="text-[11px]">마감</span>}
                </button>
              )
            })}
          </div>
          {r.force && (
            <label className="mt-3 block space-y-1">
              <span className="text-xs font-medium text-muted-foreground">직접 입력</span>
              <input
                type="datetime-local"
                value={r.target ? inputValue(r.target) : ""}
                onChange={(e) => e.target.value && r.setTarget(new Date(e.target.value).toISOString())}
                className={cn(inputCls, "px-2 py-1.5 text-xs")}
                data-testid={`${T}-resched-custom-input`}
              />
            </label>
          )}
        </div>
      </div>

      <div className="space-y-3 border-t px-5 py-4">
        <label className="block space-y-1.5">
          <span className="text-sm font-medium">메모</span>
          <textarea rows={2} value={r.memo} onChange={(e) => r.setMemo(e.target.value)} className={cn(inputCls, "resize-none")} data-testid={`${T}-resched-memo-input`} />
        </label>
        <div className="flex items-center justify-between gap-3 text-sm">
          <span>
            가용 시간 외 강제
            <span className="ml-2 text-xs text-muted-foreground">요일, 시간, 정원 검증 생략</span>
          </span>
          <Switch checked={r.force} onChange={r.setForce} label="가용 시간 외 강제" testid={`${T}-resched-force-switch`} />
        </div>
        <div className="flex items-center justify-between gap-3 text-sm">
          <span>고객에게 변경 안내 메일</span>
          <Switch checked={r.notify} onChange={r.setNotify} label="고객에게 변경 안내 메일" testid={`${T}-resched-notify-switch`} />
        </div>
      </div>

      <footer className="flex justify-end gap-2 border-t bg-muted/30 px-5 py-3">
        <button type="button" onClick={r.close} disabled={r.busy} data-testid={`${T}-resched-cancel-button`} className="rounded-lg px-3.5 py-2 text-sm text-muted-foreground hover:bg-muted">
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

export function RescheduleStageA() {
  return (
    <ModalStage>
      <RescheduleA />
    </ModalStage>
  )
}
