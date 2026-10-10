"use client"

// 플레이그라운드: 공개 예약 페이지와 일정 변경 모달. 가짜 슬롯만 쓴다.

import { useState } from "react"

import { useToast } from "@/components/ui-custom/use-toast"
import { cn } from "@/lib/utils"

import { formatTime } from "../_mock"

// ---------- 예약 양식 ----------

export const BOOKING_TYPE = {
  title: "도입 상담",
  organization: "Ashfield Lab",
  description: "Ashfield 캘린더 도입 전 궁금한 점을 함께 정리합니다.\n화상 회의 링크는 예약 확정 메일로 보내드립니다.",
  durationMinutes: 30,
  timezone: "Asia/Seoul",
  privacyUrl: "https://example.com/privacy",
}

export const CONSENT_DETAIL =
  "수집 항목: 이름, 이메일, 메시지. 이용 목적: 예약 확정 안내, 변경과 취소 통지. 보관 기간: 예약 종료일로부터 30일 자동 삭제. 동의 거부 시 예약 접수가 불가합니다."

// ---------- 슬롯 ----------

export interface Slot {
  iso: string
  ymd: string
  /** 공개 API 는 open 만 돌려준다. full 은 운영자 강제 변경용 */
  open: boolean
}

export interface Day {
  ymd: string
  date: Date
  slots: Slot[]
  open: Slot[]
}

const TIMES = ["10:00", "10:30", "11:00", "11:30", "13:00", "13:30", "14:00", "14:30", "15:00", "15:30", "16:00", "16:30"]
/** 하루 종일 마감인 날 (10월 기준 일자) */
const FULL_DAYS = new Set([14, 23])

export function ymdOf(d: Date) {
  const p = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

export function parseYmd(ymd: string) {
  const [y, m, d] = ymd.split("-").map(Number)
  return new Date(y, m - 1, d)
}

function buildDays(): Day[] {
  const out: Day[] = []
  for (let i = 2; i <= 30; i++) {
    const date = new Date(2026, 9, 10 + i)
    const dow = date.getDay()
    if (dow === 0 || dow === 6) continue
    const ymd = ymdOf(date)
    const dayNum = date.getMonth() === 9 ? date.getDate() : 0
    const slots = TIMES.map((t, idx) => {
      const [h, m] = t.split(":").map(Number)
      const s = new Date(date.getFullYear(), date.getMonth(), date.getDate(), h, m)
      const open = !FULL_DAYS.has(dayNum) && (date.getDate() * 7 + idx * 3) % 5 !== 0
      return { iso: s.toISOString(), ymd, open }
    })
    out.push({ ymd, date, slots, open: slots.filter((s) => s.open) })
  }
  return out
}

export const DAYS = buildDays()
export const OPEN_DAYS = DAYS.filter((d) => d.open.length > 0)
export const dayOf = (ymd: string | null) => DAYS.find((d) => d.ymd === ymd) ?? null

export const slotEnd = (iso: string) =>
  new Date(new Date(iso).getTime() + BOOKING_TYPE.durationMinutes * 60000).toISOString()

// ---------- 표시 ----------

export const WD = ["일", "월", "화", "수", "목", "금", "토"]

/** 10월 12일 (월) */
export const dayLabel = (d: Date) => `${d.getMonth() + 1}월 ${d.getDate()}일 (${WD[d.getDay()]})`
/** 10월 12일 월요일 */
export const longDayLabel = (d: Date) => `${d.getMonth() + 1}월 ${d.getDate()}일 ${WD[d.getDay()]}요일`
/** 오전 10:00 */
export const timeLabel = (iso: string) => formatTime(iso)
/** 10:00 */
export const hm = (iso: string) => {
  const d = new Date(iso)
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`
}
/** 10월 12일 (월) 오전 10:00 ~ 오전 10:30 */
export const slotLabel = (iso: string) => `${dayLabel(new Date(iso))} ${timeLabel(iso)} ~ ${timeLabel(slotEnd(iso))}`

export const isAm = (iso: string) => new Date(iso).getHours() < 12

/** 월 그리드 셀. 앞쪽 빈칸은 null. */
export function monthCells(year: number, month: number): (Date | null)[] {
  const first = new Date(year, month, 1).getDay()
  const days = new Date(year, month + 1, 0).getDate()
  const cells: (Date | null)[] = Array.from({ length: first }, () => null)
  for (let d = 1; d <= days; d++) cells.push(new Date(year, month, d))
  while (cells.length % 7 !== 0) cells.push(null)
  return cells
}

/** 월요일 시작 주 묶음 */
export function weeksOf(days: Day[]): Day[][] {
  const map = new Map<string, Day[]>()
  for (const d of days) {
    const mon = new Date(d.date)
    mon.setDate(mon.getDate() - ((mon.getDay() + 6) % 7))
    const k = ymdOf(mon)
    map.set(k, [...(map.get(k) ?? []), d])
  }
  return [...map.values()]
}

export const TODAY_YMD = "2026-10-10"

// ---------- 예약 흐름 ----------

export type Step = "date" | "time" | "form" | "done"
export type Scenario = "ok" | "empty" | "error"

export interface BookingForm {
  name: string
  email: string
  message: string
  consent: boolean
}

export function useBookingFlow(scenario: Scenario) {
  const [step, setStep] = useState<Step>("date")
  const [ymd, setYmd] = useState<string | null>(null)
  const [slot, setSlot] = useState<string | null>(null)
  const [form, setForm] = useState<BookingForm>({ name: "", email: "", message: "", consent: false })
  const [submitting, setSubmitting] = useState(false)

  const days = scenario === "empty" ? [] : OPEN_DAYS
  const valid = form.name.trim().length > 0 && /^\S+@\S+\.\S+$/.test(form.email.trim()) && form.consent

  return {
    step,
    goto: setStep,
    days,
    ymd,
    day: dayOf(ymd),
    slot,
    form,
    submitting,
    valid,
    setField: <K extends keyof BookingForm>(k: K, v: BookingForm[K]) => setForm((f) => ({ ...f, [k]: v })),
    pickDate: (v: string) => {
      setYmd(v)
      setSlot(null)
      setStep("time")
    },
    /** 시간만 고르고 단계는 그대로 */
    selectSlot: setSlot,
    pickSlot: (iso: string) => {
      setSlot(iso)
      setStep("form")
    },
    back: () => setStep((s) => (s === "form" ? "time" : "date")),
    submit: () => {
      if (!slot || !valid || submitting) return
      setSubmitting(true)
      window.setTimeout(() => {
        setSubmitting(false)
        setStep("done")
      }, 700)
    },
  }
}

export type BookingFlow = ReturnType<typeof useBookingFlow>

// ---------- 일정 변경 (운영자) ----------

export const BOOKING = {
  customerName: "윤가람",
  customerEmail: "garam@hanbit.example.com",
  slotIso: new Date(2026, 9, 16, 11, 0).toISOString(),
  message: "팀 12명 기준 도입 일정 문의드립니다.",
}

/** "YYYY-MM-DDTHH:MM" (datetime-local) */
export function inputValue(iso: string) {
  const d = new Date(iso)
  return `${ymdOf(d)}T${hm(iso)}`
}

export function useReschedule() {
  const { toast } = useToast()
  const [ymd, setYmd] = useState<string>(ymdOf(new Date(BOOKING.slotIso)))
  const [target, setTarget] = useState<string | null>(null)
  const [memo, setMemo] = useState(BOOKING.message)
  const [force, setForce] = useState(false)
  const [notify, setNotify] = useState(true)
  const [busy, setBusy] = useState(false)

  return {
    ymd,
    setYmd,
    day: dayOf(ymd),
    target,
    setTarget,
    memo,
    setMemo,
    force,
    setForce: (v: boolean) => {
      setForce(v)
      if (!v && target) {
        const s = DAYS.flatMap((d) => d.slots).find((x) => x.iso === target)
        if (!s?.open) setTarget(null)
      }
    },
    notify,
    setNotify,
    busy,
    /** 고를 수 있는 슬롯: 강제면 마감도 포함 */
    slotsOf: (d: Day | null) => (d ? (force ? d.slots : d.open) : []),
    close: () => toast.info("닫기"),
    submit: () => {
      if (!target || busy) return
      setBusy(true)
      window.setTimeout(() => {
        setBusy(false)
        toast.success(`예약 시간 변경 완료: ${slotLabel(target)}${notify ? ", 안내 메일 발송" : ""}`)
      }, 600)
    },
  }
}

export type RescheduleState = ReturnType<typeof useReschedule>

// ---------- 공용 부품 ----------

export function Switch({
  checked,
  onChange,
  testid,
  label,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  testid: string
  label: string
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      data-testid={testid}
      className={cn(
        "relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors",
        checked ? "bg-primary" : "bg-muted-foreground/30",
      )}
    >
      <span
        className={cn(
          "inline-block size-4 rounded-full bg-background shadow transition-transform",
          checked ? "translate-x-[18px]" : "translate-x-0.5",
        )}
      />
    </button>
  )
}

export const inputCls =
  "w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm outline-none transition focus:border-primary focus:ring-3 focus:ring-primary/15"

/** 플레이그라운드 조작용 작은 전환기 (페이지 밖) */
export function DemoSeg<T extends string>({
  value,
  options,
  onChange,
  testid,
}: {
  value: T
  options: { key: T; name: string }[]
  onChange: (v: T) => void
  testid: string
}) {
  return (
    <div className="inline-flex flex-wrap items-center gap-0.5 rounded-full border border-dashed border-muted-foreground/40 p-0.5 text-xs">
      {options.map((o) => (
        <button
          key={o.key}
          type="button"
          onClick={() => onChange(o.key)}
          data-testid={`${testid}-${o.key}`}
          className={cn(
            "rounded-full px-2.5 py-1 font-medium transition",
            value === o.key ? "bg-foreground text-background" : "text-muted-foreground hover:bg-muted hover:text-foreground",
          )}
        >
          {o.name}
        </button>
      ))}
    </div>
  )
}

/** 공개 페이지 바탕. 앱 셸 없이 단독 페이지처럼 */
export function PublicCanvas({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("relative min-h-[700px] overflow-hidden rounded-xl border bg-background", className)}>{children}</div>
}

/** 운영자 화면 위 모달 무대 */
export function ModalStage({ children }: { children: React.ReactNode }) {
  return <div className="grid min-h-[700px] place-items-center rounded-xl bg-black/40 p-6">{children}</div>
}
