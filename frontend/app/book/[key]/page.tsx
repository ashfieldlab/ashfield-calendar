"use client"

// 공개 예약: 브랜드 색 머리띠 + 주간 슬롯 격자에서 날짜와 시간을 한 번에 고르고, 오른쪽 패널에서 바로 입력.
// 공개 라우트(비인증)라 BFF api() 대신 공개 API 를 직접 부른다 (ADR-0011).

import { use, useEffect, useMemo, useRef, useState } from "react"
import { CalendarX2, Check, Clock, Globe, Link2Off, Mail, User, Users, X } from "lucide-react"

import {
  EmptyCell,
  WD,
  WeekNav,
  WeekSlotGrid,
  addDays,
  gridShape,
  indexSlots,
  mondayOf,
  slotLabel,
  timeLabel,
  weekDays,
  ymdLocal,
} from "@/components/booking/week-slot-grid"
import { durationText } from "@/components/booking/booking-controls"
import { friendlyError } from "@/lib/errors"
import { cn } from "@/lib/utils"
import { DAYS_LATER } from "@/lib/utils/booking-format"

interface PublicBookingType {
  public_key: string
  title: string
  description: string | null
  duration_minutes: number
  timezone: string
  capacity: number
  minimum_notice_minutes: number
  lookahead_days: number
  privacy_policy_url: string | null
  organization_name: string
}

interface PublicSlot {
  start_at: string
  end_at: string
  remaining: number
}

interface SuccessState {
  cancel_token: string
  slot_start_at: string
  slot_end_at: string
  title: string
}

const API = "/api/public/v1/booking"
const T = "book-page"

const inputCls =
  "w-full rounded-lg border border-input bg-background px-3 py-2.5 text-base outline-none transition focus:border-primary focus:ring-3 focus:ring-primary/15 sm:text-sm"

const CONSENT_DETAIL =
  "수집 항목: 이름, 이메일, 메시지. 이용 목적: 예약 확정 안내, 변경과 취소 통지. 보관 기간: 예약 종료일로부터 30일 자동 삭제. 동의 거부 시 예약 접수가 불가합니다."

export default function PublicBookPage({ params }: { params: Promise<{ key: string }> }) {
  const { key } = use(params)

  const [bt, setBt] = useState<PublicBookingType | null>(null)
  const [loadError, setLoadError] = useState<{ notFound: boolean; message: string } | null>(null)
  const [slots, setSlots] = useState<PublicSlot[] | null>(null)
  const [slotsError, setSlotsError] = useState<string | null>(null)
  const [chosen, setChosen] = useState<PublicSlot | null>(null)

  // 폼
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [message, setMessage] = useState("")
  const [consent, setConsent] = useState(false)
  const [website, setWebsite] = useState("") // honeypot
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [success, setSuccess] = useState<SuccessState | null>(null)

  const panelRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch(`${API}/${encodeURIComponent(key)}`)
        if (res.status === 404) {
          setLoadError({ notFound: true, message: "존재하지 않거나 종료된 예약입니다" })
          return
        }
        if (!res.ok) {
          setLoadError({ notFound: false, message: "불러오지 못했습니다. 잠시 후 다시 시도해주세요" })
          return
        }
        setBt(await res.json())
      } catch {
        setLoadError({ notFound: false, message: "불러오지 못했습니다. 잠시 후 다시 시도해주세요" })
      }
    })()
  }, [key])

  async function loadSlots(current: PublicBookingType) {
    setSlotsError(null)
    try {
      const from = new Date()
      const to = DAYS_LATER(current.lookahead_days || 30)
      const url = `${API}/${encodeURIComponent(key)}/slots?from=${encodeURIComponent(
        from.toISOString(),
      )}&to=${encodeURIComponent(to.toISOString())}`
      const res = await fetch(url)
      if (!res.ok) {
        setSlotsError("예약 가능 시간을 불러오지 못했습니다")
        setSlots([])
        return
      }
      const data = (await res.json()) as { slots: PublicSlot[] }
      setSlots(data.slots)
    } catch {
      setSlotsError("예약 가능 시간을 불러오지 못했습니다")
      setSlots([])
    }
  }

  useEffect(() => {
    if (!bt) return
    void loadSlots(bt)
    // loadSlots 는 bt, key 로만 동작
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bt, key])

  function choose(s: PublicSlot) {
    setChosen(s)
    setSubmitError(null)
    // 좁은 화면: 격자 아래 입력 패널로 내려준다
    if (typeof window !== "undefined" && window.matchMedia("(max-width: 1023px)").matches) {
      requestAnimationFrame(() => panelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }))
    }
  }

  const valid = !!chosen && name.trim().length > 0 && /^\S+@\S+\.\S+$/.test(email.trim()) && consent

  async function submit() {
    if (!chosen || !bt || !valid || submitting) return
    setSubmitting(true)
    setSubmitError(null)
    try {
      const res = await fetch(`${API}/${encodeURIComponent(key)}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slot_start_at: chosen.start_at,
          customer_name: name.trim(),
          customer_email: email.trim(),
          customer_message: message.trim() || null,
          consent,
          website, // honeypot
        }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        setSubmitError(friendlyError(body, res.status))
        // 슬롯 충돌, 만석, 가용 외 → 선택 해제 + 슬롯 다시 받기
        const slotRelated = ["BOOKING_SLOT_FULL", "BOOKING_SLOT_BLOCKED", "BOOKING_OFF_SCHEDULE"]
        if (res.status === 409 || (body?.code && slotRelated.includes(body.code))) {
          setChosen(null)
          void loadSlots(bt)
        }
        return
      }
      setSuccess(await res.json())
    } catch (e) {
      setSubmitError(friendlyError(e))
    } finally {
      setSubmitting(false)
    }
  }

  if (loadError) {
    return (
      <div className="bg-primary text-primary-foreground" data-testid={`${T}-error`}>
        <div className="mx-auto max-w-5xl px-4 py-12 sm:px-8">
          <Link2Off className="mb-3 size-7 opacity-80" />
          <h1 className="text-2xl font-bold">{loadError.message}</h1>
        </div>
      </div>
    )
  }

  if (!bt) {
    return (
      <div className="bg-primary">
        <div className="mx-auto h-48 max-w-5xl animate-pulse px-4 sm:px-8" />
      </div>
    )
  }

  return (
    <div data-testid={T}>
      <header className="bg-primary text-primary-foreground">
        <div className="mx-auto max-w-5xl px-4 pt-8 pb-14 sm:px-8">
          <p className="text-sm opacity-75">{bt.organization_name}</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight break-words sm:text-3xl">{bt.title}</h1>
          <div className="mt-3 flex flex-wrap gap-2 text-xs">
            <span className="flex items-center gap-1 rounded-full bg-primary-foreground/15 px-2.5 py-1">
              <Clock className="size-3.5" />
              {durationText(bt.duration_minutes)}
            </span>
            {bt.capacity > 1 && (
              <span className="flex items-center gap-1 rounded-full bg-primary-foreground/15 px-2.5 py-1">
                <Users className="size-3.5" />
                {bt.capacity}명
              </span>
            )}
            <span className="flex items-center gap-1 rounded-full bg-primary-foreground/15 px-2.5 py-1">
              <Globe className="size-3.5" />
              {bt.timezone}
            </span>
          </div>
          {bt.description && (
            <p className="mt-4 max-w-2xl text-sm leading-relaxed whitespace-pre-line opacity-85">{bt.description}</p>
          )}
        </div>
      </header>

      <div className="relative mx-auto -mt-8 max-w-5xl px-3 pb-10 sm:px-6">
        {success ? (
          <Ticket bt={bt} success={success} name={name} email={email} />
        ) : (
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
            <WeekGrid slots={slots} error={slotsError} chosen={chosen} onChoose={choose} />
            <aside
              ref={panelRef}
              className="h-fit scroll-mt-4 space-y-3 rounded-2xl border border-border bg-card p-4 shadow-sm lg:sticky lg:top-4"
              data-testid={`${T}-form`}
            >
              <div
                className={cn(
                  "rounded-xl border-2 border-dashed px-3 py-2.5 text-sm",
                  chosen ? "border-primary/50 bg-primary/5" : "border-border text-muted-foreground",
                )}
              >
                {chosen ? (
                  <div className="flex items-start gap-2">
                    <p className="flex-1 font-semibold text-primary" data-testid={`${T}-chosen`}>
                      {slotLabel(chosen.start_at, chosen.end_at)}
                    </p>
                    <button
                      type="button"
                      onClick={() => setChosen(null)}
                      aria-label="선택 해제"
                      data-testid={`${T}-clear`}
                      className="rounded p-0.5 text-muted-foreground hover:bg-muted"
                    >
                      <X className="size-4" />
                    </button>
                  </div>
                ) : (
                  "시간 선택 안 함"
                )}
              </div>
              <fieldset disabled={!chosen} className="space-y-3 disabled:opacity-50">
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="이름"
                  autoComplete="name"
                  className={inputCls}
                  data-testid={`${T}-name`}
                />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="이메일"
                  autoComplete="email"
                  className={inputCls}
                  data-testid={`${T}-email`}
                />
                <textarea
                  rows={3}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="메시지 (선택)"
                  className={cn(inputCls, "resize-none")}
                  data-testid={`${T}-message`}
                />
                {/* honeypot: 사람에게는 안 보임 */}
                <input
                  type="text"
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                  name="website"
                  tabIndex={-1}
                  autoComplete="off"
                  data-testid={`${T}-honeypot`}
                  style={{ position: "absolute", left: "-9999px", height: 0, width: 0 }}
                  aria-hidden="true"
                />
                <label className="flex gap-2 text-xs leading-relaxed text-muted-foreground" data-testid={`${T}-consent-label`}>
                  <input
                    type="checkbox"
                    checked={consent}
                    onChange={(e) => setConsent(e.target.checked)}
                    className="mt-0.5 size-4 shrink-0 accent-primary"
                    data-testid={`${T}-consent`}
                  />
                  <span>
                    <strong className="text-foreground">(필수) 개인정보 수집과 이용 동의.</strong> {CONSENT_DETAIL}
                    {bt.privacy_policy_url && (
                      <>
                        {" "}
                        <a
                          href={bt.privacy_policy_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary underline"
                          data-testid={`${T}-privacy-link`}
                        >
                          처리방침
                        </a>
                      </>
                    )}
                  </span>
                </label>
                {submitError && chosen && (
                  <p
                    className="rounded-lg border border-rose-200 bg-rose-50 p-2.5 text-xs text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300"
                    data-testid={`${T}-submit-error`}
                  >
                    {submitError}
                  </p>
                )}
                <button
                  type="button"
                  onClick={submit}
                  disabled={!valid || submitting}
                  data-testid={`${T}-submit`}
                  className="w-full rounded-lg bg-primary py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-40 sm:py-2.5"
                >
                  {submitting ? "처리 중…" : "예약하기"}
                </button>
              </fieldset>
              {!chosen && submitError && (
                <p
                  className="rounded-lg border border-rose-200 bg-rose-50 p-2.5 text-xs text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300"
                  data-testid={`${T}-conflict-error`}
                >
                  {submitError}
                </p>
              )}
            </aside>
          </div>
        )}
      </div>
    </div>
  )
}

function WeekGrid({
  slots,
  error,
  chosen,
  onChoose,
}: {
  slots: PublicSlot[] | null
  error: string | null
  chosen: PublicSlot | null
  onChoose: (s: PublicSlot) => void
}) {
  const list = useMemo(() => slots ?? [], [slots])
  const shape = useMemo(() => gridShape(list), [list])
  const idx = useMemo(() => indexSlots(list), [list])
  const daysWithSlots = useMemo(() => new Set(list.map((s) => ymdLocal(new Date(s.start_at)))), [list])

  const firstMonday = list.length ? mondayOf(new Date(list[0].start_at)) : mondayOf(new Date())
  const lastMonday = list.length ? mondayOf(new Date(list[list.length - 1].start_at)) : firstMonday
  const [offset, setOffset] = useState(0)
  // 슬롯이 다시 들어오면(충돌 후 재조회) 범위를 벗어난 주 보정
  const maxOffset = Math.round((lastMonday.getTime() - firstMonday.getTime()) / (7 * 86400000))
  const week = Math.min(offset, maxOffset)
  const monday = addDays(firstMonday, week * 7)
  const days = weekDays(monday, shape.weekend)
  const empty = slots !== null && list.length === 0
  // 빈 상태에서도 격자 모양은 보여준다
  const rows = shape.rows.length ? shape.rows : ["10:00", "11:00", "13:00", "14:00", "15:00", "16:00"]

  return (
    <div className="min-w-0 rounded-2xl border border-border bg-card p-3 shadow-sm sm:p-4" data-testid={`${T}-slots`}>
      <WeekNav
        days={days}
        canPrev={week > 0}
        canNext={week < maxOffset}
        onPrev={() => setOffset(week - 1)}
        onNext={() => setOffset(week + 1)}
        testid={T}
      />
      <div className="relative overflow-x-auto">
        {slots === null ? (
          <div className="h-72 animate-pulse rounded-lg bg-muted" />
        ) : (
          <WeekSlotGrid
            days={days}
            rows={rows}
            testid={`${T}-grid`}
            dimDay={(d) => empty || !daysWithSlots.has(ymdLocal(d))}
            renderCell={(_d, ymd, row) => {
              const s = empty ? undefined : idx.get(`${ymd} ${row}`)
              if (!s) return <EmptyCell />
              const sel = chosen?.start_at === s.start_at
              return (
                <button
                  type="button"
                  onClick={() => onChoose(s)}
                  aria-pressed={sel}
                  title={s.remaining > 1 ? `${s.remaining}자리` : undefined}
                  data-testid={`${T}-slot-${s.start_at}`}
                  className={cn(
                    "relative h-9 w-full rounded-lg text-xs font-semibold tabular-nums transition",
                    sel ? "bg-primary text-primary-foreground shadow-sm" : "bg-primary/10 text-primary hover:bg-primary/20",
                  )}
                >
                  {row}
                </button>
              )
            }}
          />
        )}
        {empty && (
          <div className="absolute inset-0 grid place-items-center bg-card/70" data-testid={`${T}-no-slots`}>
            <p className="flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-sm text-muted-foreground shadow-sm">
              <CalendarX2 className="size-4" />
              {error ?? "가능한 시간이 없습니다"}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

function Ticket({
  bt,
  success,
  name,
  email,
}: {
  bt: PublicBookingType
  success: SuccessState
  name: string
  email: string
}) {
  const d = new Date(success.slot_start_at)
  return (
    <div
      className="mx-auto flex max-w-2xl flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-sm sm:flex-row"
      data-testid={`${T}-success`}
    >
      <div className="flex shrink-0 flex-row items-center justify-center gap-3 border-b-2 border-dashed border-border bg-primary/10 py-4 text-primary sm:w-32 sm:flex-col sm:gap-0 sm:border-r-2 sm:border-b-0 sm:py-6">
        <p className="text-sm font-medium">{d.getMonth() + 1}월</p>
        <p className="text-5xl leading-none font-bold">{d.getDate()}</p>
        <p className="text-sm sm:mt-1">{WD[d.getDay()]}요일</p>
      </div>
      <div className="flex-1 space-y-3 p-6">
        <p className="flex items-center gap-1.5 text-sm font-semibold text-emerald-700 dark:text-emerald-400">
          <Check className="size-4" strokeWidth={3} />
          예약 완료
        </p>
        <h2 className="text-xl font-bold break-words">{success.title || bt.title}</h2>
        <p className="text-sm text-foreground/80">
          {timeLabel(d)} ~ {timeLabel(new Date(success.slot_end_at))}, {bt.timezone}
        </p>
        <div className="space-y-1 border-t border-border pt-3 text-sm text-muted-foreground">
          <p className="flex items-center gap-2">
            <User className="size-4 shrink-0" />
            {name}
          </p>
          <p className="flex items-start gap-2">
            <Mail className="mt-0.5 size-4 shrink-0" />
            <span className="break-all">{email}: 안내 메일 발송, 변경과 취소 링크 포함</span>
          </p>
        </div>
      </div>
    </div>
  )
}
