"use client"

import { memo, use, useEffect, useMemo, useState } from "react"
import { CalendarClock, CheckCircle2 } from "lucide-react"

import { friendlyError } from "@/lib/errors"
import { DAYS_LATER, formatLocal } from "@/lib/utils/booking-format"

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

export default function PublicBookPage({
  params,
}: {
  params: Promise<{ key: string }>
}) {
  const { key } = use(params)

  const [bt, setBt] = useState<PublicBookingType | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [slots, setSlots] = useState<PublicSlot[]>([])
  const [slotsLoading, setSlotsLoading] = useState(false)
  const [chosen, setChosen] = useState<string | null>(null) // slot start ISO

  // 폼
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [message, setMessage] = useState("")
  const [consent, setConsent] = useState(false)
  const [website, setWebsite] = useState("")  // honeypot
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [success, setSuccess] = useState<SuccessState | null>(null)

  // BookingType 정보 load
  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch(`${API}/${encodeURIComponent(key)}`)
        if (res.status === 404) {
          setLoadError("존재하지 않거나 종료된 예약입니다.")
          return
        }
        if (!res.ok) {
          setLoadError("불러오지 못했습니다. 잠시 후 다시 시도해주세요.")
          return
        }
        setBt(await res.json())
      } catch {
        setLoadError("불러오지 못했습니다. 잠시 후 다시 시도해주세요.")
      }
    })()
  }, [key])

  // 슬롯 load: 재로드 가능하게 함수 분리
  async function loadSlots(btCurrent: PublicBookingType) {
    setSlotsLoading(true)
    try {
      const from = new Date()
      const to = DAYS_LATER(btCurrent.lookahead_days || 30)
      const url = `${API}/${encodeURIComponent(key)}/slots?from=${encodeURIComponent(
        from.toISOString(),
      )}&to=${encodeURIComponent(to.toISOString())}`
      const res = await fetch(url)
      if (!res.ok) {
        setLoadError("예약 가능 시간을 불러오지 못했습니다.")
        return
      }
      const data = (await res.json()) as { slots: PublicSlot[] }
      setSlots(data.slots)
    } finally {
      setSlotsLoading(false)
    }
  }

  useEffect(() => {
    if (!bt) return
    void loadSlots(bt)
    // loadSlots 는 같은 render 안에서만 호출: eslint exhaustive-deps 무시
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bt, key])

  async function submit() {
    if (!chosen || !bt) return
    setSubmitting(true)
    setSubmitError(null)
    try {
      const res = await fetch(`${API}/${encodeURIComponent(key)}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slot_start_at: chosen,
          customer_name: name.trim(),
          customer_email: email.trim(),
          customer_message: message.trim() || null,
          consent,
          website,  // honeypot
        }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        const msg = friendlyError(body, res.status)
        setSubmitError(msg)
        // 슬롯 충돌·만석·가용외 → 선택 초기화 + 슬롯 재로드
        const slotRelated = [
          "BOOKING_SLOT_FULL",
          "BOOKING_SLOT_BLOCKED",
          "BOOKING_OFF_SCHEDULE",
        ]
        if (
          res.status === 409 ||
          (body?.code && slotRelated.includes(body.code))
        ) {
          setChosen(null)
          void loadSlots(bt)
        }
        return
      }
      setSuccess(await res.json())
    } catch (e) {
      setSubmitError((e as Error).message)
    } finally {
      setSubmitting(false)
    }
  }

  if (loadError) {
    return (
      <div
        className="rounded-lg border border-rose-200 bg-rose-50 p-6 text-sm text-rose-700"
        data-testid="book-page-error"
      >
        {loadError}
      </div>
    )
  }

  if (!bt) {
    return <p className="text-sm text-gray-500">불러오는 중…</p>
  }

  if (success) {
    return (
      <div
        className="space-y-4 rounded-lg border border-emerald-200 bg-emerald-50 p-6"
        data-testid="book-page-success"
      >
        <div className="flex items-center gap-2 text-emerald-800">
          <CheckCircle2 size={22} />
          <h1 className="text-lg font-semibold">예약 접수 완료</h1>
        </div>
        <p className="text-sm text-gray-700">
          <strong>{success.title}</strong> 예약이 정상 접수되었습니다.
          <br />
          일시: {formatLocal(success.slot_start_at)}
        </p>
        <p className="text-sm text-gray-700">
          입력하신 이메일로 안내 메일을 발송했습니다. 변경·취소가 필요하시면
          메일의 링크를 사용해주세요.
        </p>
        <p className="text-xs text-gray-500">감사합니다.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6" data-testid="book-page">
      <header className="space-y-1">
        <p className="text-xs uppercase tracking-wide text-gray-500">
          {bt.organization_name}
        </p>
        <div className="flex items-center gap-2">
          <CalendarClock size={20} className="text-gray-600" />
          <h1 className="break-words text-xl font-bold text-gray-900">{bt.title}</h1>
        </div>
        <p className="text-sm text-gray-600">{bt.duration_minutes}분 소요</p>
        {bt.description && (
          <p className="whitespace-pre-line pt-2 text-sm text-gray-700">
            {bt.description}
          </p>
        )}
      </header>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-gray-900">시간 선택</h2>
        {slotsLoading ? (
          <p className="text-sm text-gray-500">슬롯 조회 중…</p>
        ) : slots.length === 0 ? (
          <p
            className="rounded border border-dashed border-gray-300 p-6 text-center text-sm text-gray-500"
            data-testid="book-page-no-slots"
          >
            가능한 시간이 없습니다. 잠시 후 다시 시도해주세요.
          </p>
        ) : (
          <SlotGrid
            slots={slots}
            chosen={chosen}
            onChoose={setChosen}
          />
        )}
      </section>

      {chosen && (
        <section
          className="space-y-3 rounded-lg border border-gray-200 bg-white p-4"
          data-testid="book-page-form"
        >
          <h2 className="text-sm font-semibold text-gray-900">
            정보 입력 ({formatLocal(chosen)})
          </h2>
          <Field label="이름">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              data-testid="book-page-name"
              className="w-full rounded border border-gray-300 px-3 py-2.5 text-base"
              required
            />
          </Field>
          <Field label="이메일">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              data-testid="book-page-email"
              className="w-full rounded border border-gray-300 px-3 py-2.5 text-base"
              required
            />
          </Field>
          <Field label="메시지 (선택)" hint="미리 전달할 내용이 있다면 적어주세요">
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={3}
              data-testid="book-page-message"
              className="w-full rounded border border-gray-300 px-3 py-2.5 text-base"
            />
          </Field>

          {/* honeypot: 사람은 안 보임 */}
          <input
            type="text"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
            name="website"
            tabIndex={-1}
            autoComplete="off"
            data-testid="book-page-honeypot"
            style={{ position: "absolute", left: "-9999px", height: 0, width: 0 }}
            aria-hidden="true"
          />

          <ConsentBox
            agreed={consent}
            onChange={setConsent}
            privacyUrl={bt.privacy_policy_url}
          />

          {submitError && (
            <p className="rounded border border-rose-200 bg-rose-50 p-2 text-xs text-rose-700">
              {submitError}
            </p>
          )}
          <button
            onClick={submit}
            disabled={submitting || !name || !email || !consent}
            data-testid="book-page-submit"
            className="w-full rounded-md bg-gray-900 px-4 py-3 text-base font-medium text-white hover:bg-gray-800 active:bg-black disabled:opacity-50"
          >
            {submitting ? "처리 중…" : "예약하기"}
          </button>
        </section>
      )}
    </div>
  )
}

interface SlotGridProps {
  slots: PublicSlot[]
  chosen: string | null
  onChoose: (iso: string) => void
}

// 부모 리렌더 (폼 키 입력 등) 에도 props 변하지 않으면 재계산 skip.
// 30일 × 수십 슬롯 × toLocale 호출은 비싸서 keystroke 마다 하면 input 지연 체감.
interface DaySlot {
  iso: string
  time: string
  remaining: number
}

interface DayBucket {
  ymd: string // 'YYYY-MM-DD' (로컬 TZ)
  date: Date // 00:00 로컬
  items: DaySlot[]
}

/**
 * 캘린더 월 그리드 (데스크탑) / 가로 날짜 칩 (모바일) + 선택된 날짜의 시간 슬롯 패널.
 *
 * - slots 를 로컬 YYYY-MM-DD 로 그룹핑 → 가용 날짜 set
 * - 사용자가 선택한 날짜의 시간 슬롯만 우측·하단에 표시
 * - 캘린더는 월 단위 네비게이션, 가용한 달까지만 이동 가능
 */
const SlotGrid = memo(function SlotGrid({
  slots,
  chosen,
  onChoose,
}: SlotGridProps) {
  const buckets = useMemo<DayBucket[]>(() => {
    const byYmd = new Map<string, DayBucket>()
    for (const s of slots) {
      const d = new Date(s.start_at)
      const ymd = ymdLocal(d)
      let bucket = byYmd.get(ymd)
      if (!bucket) {
        const base = new Date(d.getFullYear(), d.getMonth(), d.getDate())
        bucket = { ymd, date: base, items: [] }
        byYmd.set(ymd, bucket)
      }
      bucket.items.push({
        iso: s.start_at,
        time: d.toLocaleTimeString("ko-KR", {
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        }),
        remaining: s.remaining,
      })
    }
    return [...byYmd.values()].sort((a, b) => a.ymd.localeCompare(b.ymd))
  }, [slots])

  const availableYmds = useMemo(
    () => new Set(buckets.map((b) => b.ymd)),
    [buckets],
  )

  // 선택된 날짜 (YYYY-MM-DD). 기본: 첫 가용 날짜. chosen 이 바뀌면 그 날짜로.
  const [selectedYmd, setSelectedYmd] = useState<string | null>(null)
  useEffect(() => {
    if (selectedYmd && availableYmds.has(selectedYmd)) return
    if (chosen) {
      const ymd = ymdLocal(new Date(chosen))
      if (availableYmds.has(ymd)) {
        setSelectedYmd(ymd)
        return
      }
    }
    setSelectedYmd(buckets[0]?.ymd ?? null)
  }, [buckets, availableYmds, chosen, selectedYmd])

  // 현재 표시 월 (캘린더 그리드)
  const [viewMonth, setViewMonth] = useState<Date>(() => {
    const first = buckets[0]?.date ?? new Date()
    return new Date(first.getFullYear(), first.getMonth(), 1)
  })
  useEffect(() => {
    if (!selectedYmd) return
    const d = parseYmd(selectedYmd)
    setViewMonth((v) =>
      v.getFullYear() === d.getFullYear() && v.getMonth() === d.getMonth()
        ? v
        : new Date(d.getFullYear(), d.getMonth(), 1),
    )
  }, [selectedYmd])

  // 가용 월 범위: 네비게이션 한계
  const monthRange = useMemo(() => {
    if (buckets.length === 0) return null
    const first = buckets[0].date
    const last = buckets[buckets.length - 1].date
    return {
      min: new Date(first.getFullYear(), first.getMonth(), 1),
      max: new Date(last.getFullYear(), last.getMonth(), 1),
    }
  }, [buckets])

  const canPrev =
    monthRange !== null && viewMonth.getTime() > monthRange.min.getTime()
  const canNext =
    monthRange !== null && viewMonth.getTime() < monthRange.max.getTime()

  const selectedBucket = buckets.find((b) => b.ymd === selectedYmd) ?? null

  return (
    <div className="space-y-4" data-testid="book-page-slots">
      {/* 데스크탑: 좌측 캘린더 + 우측 시간 / 모바일: 위에 가로 칩 + 아래 시간 */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-[320px_minmax(0,1fr)]">
        {/* 캘린더 (데스크탑 전용) */}
        <div className="hidden md:block">
          <MonthCalendar
            viewMonth={viewMonth}
            selectedYmd={selectedYmd}
            availableYmds={availableYmds}
            onPrev={
              canPrev
                ? () =>
                    setViewMonth(
                      new Date(
                        viewMonth.getFullYear(),
                        viewMonth.getMonth() - 1,
                        1,
                      ),
                    )
                : null
            }
            onNext={
              canNext
                ? () =>
                    setViewMonth(
                      new Date(
                        viewMonth.getFullYear(),
                        viewMonth.getMonth() + 1,
                        1,
                      ),
                    )
                : null
            }
            onSelect={setSelectedYmd}
          />
        </div>

        {/* 가로 날짜 칩 (모바일 전용) */}
        <div className="md:hidden">
          <DateChips
            buckets={buckets}
            selectedYmd={selectedYmd}
            onSelect={setSelectedYmd}
          />
        </div>

        {/* 시간 슬롯 패널: 양쪽 공용 (min-w-0: 그리드 1fr 컬럼의 자식 overflow 방어) */}
        <div className="min-w-0 space-y-2">
          {selectedBucket ? (
            <>
              <p className="text-sm font-semibold text-gray-700">
                {selectedBucket.date.toLocaleDateString("ko-KR", {
                  month: "long",
                  day: "numeric",
                  weekday: "long",
                })}
              </p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
                {selectedBucket.items.map((s) => {
                  const isChosen = chosen === s.iso
                  return (
                    <button
                      key={s.iso}
                      onClick={() => onChoose(s.iso)}
                      data-testid={`book-page-slot-${s.iso}`}
                      className={`rounded-md border px-2 py-3 text-sm font-medium transition ${
                        isChosen
                          ? "border-blue-600 bg-blue-600 text-white shadow-sm"
                          : "border-gray-300 bg-white text-gray-700 hover:border-gray-400 active:bg-gray-100"
                      }`}
                    >
                      {s.time}
                      {s.remaining > 1 && (
                        <span className="ml-1 text-[11px] opacity-70">
                          ({s.remaining})
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
            </>
          ) : (
            <p className="text-sm text-gray-500">날짜를 선택해주세요.</p>
          )}
        </div>
      </div>
    </div>
  )
})

function ymdLocal(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function parseYmd(ymd: string): Date {
  const [y, m, d] = ymd.split("-").map(Number)
  return new Date(y, m - 1, d)
}

/** 월 그리드: 7열, 일~토. 가용 날짜만 클릭 가능. */
function MonthCalendar({
  viewMonth,
  selectedYmd,
  availableYmds,
  onPrev,
  onNext,
  onSelect,
}: {
  viewMonth: Date
  selectedYmd: string | null
  availableYmds: Set<string>
  onPrev: (() => void) | null
  onNext: (() => void) | null
  onSelect: (ymd: string) => void
}) {
  const monthLabel = viewMonth.toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "long",
  })
  // 그리드 셀 = (이전 달 꼬리) + 이번 달 일수 + (다음 달 머리). 6주 max → 42셀.
  const firstDow = new Date(
    viewMonth.getFullYear(),
    viewMonth.getMonth(),
    1,
  ).getDay() // 0 = 일
  const daysInMonth = new Date(
    viewMonth.getFullYear(),
    viewMonth.getMonth() + 1,
    0,
  ).getDate()
  const cells: { ymd: string; day: number; inMonth: boolean }[] = []
  for (let i = 0; i < firstDow; i++) {
    cells.push({ ymd: "", day: 0, inMonth: false })
  }
  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), d)
    cells.push({ ymd: ymdLocal(date), day: d, inMonth: true })
  }
  while (cells.length % 7 !== 0) cells.push({ ymd: "", day: 0, inMonth: false })

  return (
    <div
      className="rounded-lg border border-gray-200 bg-white p-3"
      data-testid="book-page-calendar"
    >
      <div className="mb-2 flex items-center justify-between">
        <button
          onClick={onPrev ?? undefined}
          disabled={!onPrev}
          aria-label="이전 달"
          data-testid="book-page-calendar-prev"
          className="rounded p-1 text-gray-500 hover:bg-gray-100 disabled:opacity-30"
        >
          ‹
        </button>
        <span className="text-sm font-semibold text-gray-900">{monthLabel}</span>
        <button
          onClick={onNext ?? undefined}
          disabled={!onNext}
          aria-label="다음 달"
          data-testid="book-page-calendar-next"
          className="rounded p-1 text-gray-500 hover:bg-gray-100 disabled:opacity-30"
        >
          ›
        </button>
      </div>
      <div className="mb-1 grid grid-cols-7 gap-1 text-center text-[10px] font-medium text-gray-400">
        {["일", "월", "화", "수", "목", "금", "토"].map((d, i) => (
          <span
            key={d}
            className={
              i === 0 ? "text-rose-400" : i === 6 ? "text-blue-400" : ""
            }
          >
            {d}
          </span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((c, idx) => {
          if (!c.inMonth) return <div key={`pad-${idx}`} />
          const isAvail = availableYmds.has(c.ymd)
          const isSelected = c.ymd === selectedYmd
          return (
            <button
              key={c.ymd}
              onClick={() => isAvail && onSelect(c.ymd)}
              disabled={!isAvail}
              data-testid={`book-page-day-${c.ymd}`}
              className={`aspect-square rounded text-sm transition ${
                isSelected
                  ? "bg-gray-900 font-semibold text-white"
                  : isAvail
                    ? "bg-blue-50 font-medium text-blue-700 hover:bg-blue-100"
                    : "text-gray-300"
              }`}
            >
              {c.day}
            </button>
          )
        })}
      </div>
    </div>
  )
}

/** 모바일용 가로 날짜 칩: 가용한 날짜만 표시, 가로 스크롤. */
function DateChips({
  buckets,
  selectedYmd,
  onSelect,
}: {
  buckets: DayBucket[]
  selectedYmd: string | null
  onSelect: (ymd: string) => void
}) {
  return (
    <div
      className="flex snap-x snap-mandatory gap-2 overflow-x-auto pb-1"
      data-testid="book-page-date-chips"
    >
      {buckets.map((b) => {
        const isSelected = b.ymd === selectedYmd
        return (
          <button
            key={b.ymd}
            onClick={() => onSelect(b.ymd)}
            data-testid={`book-page-day-chip-${b.ymd}`}
            className={`flex shrink-0 snap-start flex-col items-center rounded-lg border px-3 py-2 text-center transition ${
              isSelected
                ? "border-gray-900 bg-gray-900 text-white"
                : "border-gray-200 bg-white text-gray-700 active:bg-gray-100"
            }`}
          >
            <span className="text-[10px] font-medium opacity-70">
              {b.date.toLocaleDateString("ko-KR", { weekday: "short" })}
            </span>
            <span className="text-base font-bold">{b.date.getDate()}</span>
            <span className="text-[10px] opacity-70">
              {b.date.toLocaleDateString("ko-KR", { month: "short" })}
            </span>
          </button>
        )
      })}
    </div>
  )
}

function ConsentBox({
  agreed,
  onChange,
  privacyUrl,
}: {
  agreed: boolean
  onChange: (v: boolean) => void
  privacyUrl: string | null
}) {
  return (
    <label
      className="flex gap-2 rounded border border-gray-200 bg-gray-50 p-3 text-xs text-gray-700"
      data-testid="book-page-consent-label"
    >
      <input
        type="checkbox"
        checked={agreed}
        onChange={(e) => onChange(e.target.checked)}
        data-testid="book-page-consent"
        className="mt-0.5 shrink-0"
      />
      <span>
        <strong>(필수)</strong> 개인정보 수집·이용에 동의합니다.
        <br />
        수집 항목: 이름, 이메일, 메시지 · 이용 목적: 예약 확정 안내, 변경·취소 통지
        · 보관 기간: 예약 종료일로부터 30일 자동 삭제. 동의 거부 시 예약 접수가 불가합니다.
        {privacyUrl && (
          <>
            {" "}
            <a
              href={privacyUrl}
              target="_blank"
              rel="noopener noreferrer"
              data-testid="book-page-privacy-link"
              className="text-blue-700 underline"
            >
              개인정보 처리방침
            </a>
          </>
        )}
      </span>
    </label>
  )
}

function Field({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-gray-600">
        {label}
        {hint && <span className="ml-2 text-gray-400">{hint}</span>}
      </label>
      {children}
    </div>
  )
}
