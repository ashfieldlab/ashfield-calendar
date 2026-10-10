"use client"

import { useEffect, useState } from "react"
import { useToast } from "@/components/ui-custom/use-toast"

import { useAppContext } from "@/components/providers/app-context"
import { WeeklyScheduleEditor } from "@/components/booking/weekly-schedule-editor"
import { useApiGet } from "@/lib/hooks/use-api"
import type { CalendarListResponse } from "@/lib/types/api"

interface CompanyMember {
  user_sub: string
  email: string | null
  name: string | null
  role: "admin" | "member"
}
interface CompanyMemberList {
  members: CompanyMember[]
}
import type {
  BookingTypeCreate,
  BookingTypeOwner,
  BookingTypeResponse,
  WeeklySchedule,
} from "@/lib/types/booking"

interface Props {
  /** 편집 모드면 초기값. 생성 모드면 undefined. */
  initial?: BookingTypeResponse
  /** 사용자가 저장 누르면 호출. body 는 BookingTypeCreate 호환. */
  onSubmit: (body: BookingTypeCreate) => Promise<void>
  busy?: boolean
  submitLabel?: string
}

function Row({
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

export function BookingTypeForm({
  initial,
  onSubmit,
  busy = false,
  submitLabel = "저장",
}: Props) {
  const { toast } = useToast()
  const { isCompanyAdmin, activeCompanyId } = useAppContext()
  const { data: calData } = useApiGet<CalendarListResponse>("/api/v1/calendars")
  const calendars = calData?.calendars ?? []
  // company-owned 일 때만 회사 멤버 fetch (다중 선택용).
  // GET /members 는 company admin 전용: 일반 사용자가 fetch 시도하면 403 야기.
  // UI 측에서 owner_type='company' 옵션도 admin 에게만 허용하므로 fetch 도 admin 일 때만.
  const { data: memberData } = useApiGet<CompanyMemberList>(
    isCompanyAdmin && activeCompanyId
      ? `/api/v1/companies/${encodeURIComponent(activeCompanyId)}/members`
      : null,
  )
  const companyMembers = memberData?.members ?? []

  const [ownerType, setOwnerType] = useState<BookingTypeOwner>(
    initial?.owner_type ?? "user",
  )
  const [title, setTitle] = useState(initial?.title ?? "")
  const [description, setDescription] = useState(initial?.description ?? "")
  const [privacyUrl, setPrivacyUrl] = useState(initial?.privacy_policy_url ?? "")
  const [duration, setDuration] = useState(initial?.duration_minutes ?? 30)
  const [timezone, setTimezone] = useState(initial?.timezone ?? "Asia/Seoul")
  const [weekly, setWeekly] = useState<WeeklySchedule>(
    initial?.weekly_schedule ?? {
      mon: [["09:00", "12:00"], ["13:00", "18:00"]],
      tue: [["09:00", "12:00"], ["13:00", "18:00"]],
      wed: [["09:00", "12:00"], ["13:00", "18:00"]],
      thu: [["09:00", "12:00"], ["13:00", "18:00"]],
      fri: [["09:00", "12:00"], ["13:00", "18:00"]],
    },
  )
  const [availableFrom, setAvailableFrom] = useState(initial?.available_from ?? "")
  const [availableTo, setAvailableTo] = useState(initial?.available_to ?? "")
  const [minimumNotice, setMinimumNotice] = useState(
    initial?.minimum_notice_minutes ?? 60 * 24,
  )
  const [lookaheadDays, setLookaheadDays] = useState(
    initial?.lookahead_days ?? 30,
  )
  const [capacity, setCapacity] = useState(initial?.capacity ?? 1)
  const [targetCalendarId, setTargetCalendarId] = useState(
    initial?.target_calendar_id ?? "",
  )
  const [blockingCalendarIds, setBlockingCalendarIds] = useState<string[]>(
    initial?.blocking_calendar_ids ?? [],
  )
  const [notifyUserSubs, setNotifyUserSubs] = useState<string[]>(
    initial?.notify_user_subs ?? [],
  )

  // calendars 가 도착하면 기본 target 자동 선택 (편집 모드는 건들지 않음)
  useEffect(() => {
    if (initial) return
    if (calendars.length > 0 && !targetCalendarId) {
      const firstUserCal = calendars.find(
        (c) =>
          (ownerType === "user" && c.scope === "personal") ||
          (ownerType === "company" && c.scope === "shared"),
      )
      if (firstUserCal) setTargetCalendarId(firstUserCal.id)
    }
  }, [calendars, ownerType, targetCalendarId, initial])

  function toggleBlocking(id: string) {
    setBlockingCalendarIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    )
  }

  // target 으로 선택 가능한 목록: ownerType 일치
  const targetCandidates = calendars.filter(
    (c) =>
      (ownerType === "user" && c.scope === "personal") ||
      (ownerType === "company" && c.scope === "shared"),
  )
  // blocking 후보: target 제외
  const blockingCandidates = calendars.filter(
    (c) => c.id !== targetCalendarId,
  )

  async function save() {
    if (!title.trim()) {
      toast.error("제목을 입력하세요")
      return
    }
    if (!targetCalendarId) {
      toast.error("예약이 들어갈 캘린더를 선택하세요")
      return
    }
    const body: BookingTypeCreate = {
      owner_type: ownerType,
      title: title.trim(),
      description: description.trim() || null,
      privacy_policy_url: privacyUrl.trim() || null,
      duration_minutes: duration,
      timezone,
      weekly_schedule: weekly,
      available_from: availableFrom || null,
      available_to: availableTo || null,
      minimum_notice_minutes: minimumNotice,
      lookahead_days: lookaheadDays,
      target_calendar_id: targetCalendarId,
      blocking_calendar_ids: blockingCalendarIds,
      capacity,
      notify_user_subs: notifyUserSubs,
    }
    await onSubmit(body)
  }

  return (
    <div className="space-y-4 rounded-lg border border-gray-200 bg-white p-6" data-testid="booking-type-form">
      {!initial && (
        <Row label="소유">
          <div className="flex gap-3 text-sm">
            <label className="inline-flex items-center gap-1">
              <input
                type="radio"
                checked={ownerType === "user"}
                onChange={() => setOwnerType("user")}
                data-testid="booking-type-form-owner-user"
              />
              개인
            </label>
            <label className="inline-flex items-center gap-1">
              <input
                type="radio"
                checked={ownerType === "company"}
                onChange={() => setOwnerType("company")}
                disabled={!isCompanyAdmin}
                data-testid="booking-type-form-owner-company"
              />
              회사 {!isCompanyAdmin && "(회사 관리자 필요)"}
            </label>
          </div>
        </Row>
      )}
      <Row label="제목">
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="예: 30분 상담"
          data-testid="booking-type-form-title"
          className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
        />
      </Row>
      <Row label="안내 문구">
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          data-testid="booking-type-form-description"
          className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
        />
      </Row>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Row label="슬롯 길이 (분)">
          <input
            type="number"
            min={5}
            max={1440}
            value={duration}
            onChange={(e) => setDuration(Number(e.target.value))}
            data-testid="booking-type-form-duration"
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
          />
        </Row>
        <Row label="정원">
          <input
            type="number"
            min={1}
            value={capacity}
            onChange={(e) => setCapacity(Number(e.target.value))}
            data-testid="booking-type-form-capacity"
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
          />
        </Row>
      </div>
      <Row label="가용 요일·시간">
        <WeeklyScheduleEditor value={weekly} onChange={setWeekly} />
      </Row>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Row label="시작 날짜">
          <input
            type="date"
            value={availableFrom}
            onChange={(e) => setAvailableFrom(e.target.value)}
            data-testid="booking-type-form-available-from"
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
          />
        </Row>
        <Row label="종료 날짜">
          <input
            type="date"
            value={availableTo}
            onChange={(e) => setAvailableTo(e.target.value)}
            data-testid="booking-type-form-available-to"
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
          />
        </Row>
        <Row label="최소 예약 전 (분)">
          <input
            type="number"
            min={0}
            value={minimumNotice}
            onChange={(e) => setMinimumNotice(Number(e.target.value))}
            data-testid="booking-type-form-min-notice"
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
          />
        </Row>
      </div>
      <Row label="공개 페이지 노출 기간 (일)">
        <input
          type="number"
          min={1}
          max={90}
          value={lookaheadDays}
          onChange={(e) => setLookaheadDays(Number(e.target.value))}
          data-testid="booking-type-form-lookahead-days"
          className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
        />
      </Row>
      <Row label="예약 들어갈 캘린더">
        <select
          value={targetCalendarId}
          onChange={(e) => setTargetCalendarId(e.target.value)}
          data-testid="booking-type-form-target-cal"
          className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
        >
          <option value="">선택</option>
          {targetCandidates.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name} ({c.scope})
            </option>
          ))}
        </select>
      </Row>
      <Row label="충돌 체크 캘린더" hint="겹치는 슬롯을 자동 제외">
        <div className="space-y-1 rounded border border-gray-200 bg-gray-50 p-2">
          {blockingCandidates.length === 0 ? (
            <p className="text-xs text-gray-500">사용 가능한 캘린더 없음</p>
          ) : (
            blockingCandidates.map((c) => (
              <label
                key={c.id}
                className="flex items-center gap-2 text-sm"
                data-testid={`booking-type-form-blocking-${c.id}`}
              >
                <input
                  type="checkbox"
                  checked={blockingCalendarIds.includes(c.id)}
                  onChange={() => toggleBlocking(c.id)}
                  data-testid={`booking-type-form-blocking-${c.id}-input`}
                />
                {c.name} ({c.scope})
              </label>
            ))
          )}
        </div>
      </Row>
      <Row label="예약 알림 받을 사람">
        {ownerType === "company" && companyMembers.length > 0 ? (
          <div className="space-y-1 rounded border border-gray-200 bg-gray-50 p-2">
            {companyMembers.map((m) => {
              const checked = notifyUserSubs.includes(m.user_sub)
              return (
                <label
                  key={m.user_sub}
                  className="flex items-center gap-2 text-sm"
                  data-testid={`booking-type-form-notify-${m.user_sub}`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() =>
                      setNotifyUserSubs((prev) =>
                        prev.includes(m.user_sub)
                          ? prev.filter((s) => s !== m.user_sub)
                          : [...prev, m.user_sub],
                      )
                    }
                    data-testid={`booking-type-form-notify-${m.user_sub}-input`}
                  />
                  <span className="text-gray-900">
                    {m.name ?? m.user_sub}
                  </span>
                  <span className="text-[11px] text-gray-500">{m.email ?? ""}</span>
                  {m.role === "admin" && (
                    <span className="rounded bg-blue-100 px-1 py-0.5 text-[10px] text-blue-800">
                      admin
                    </span>
                  )}
                </label>
              )
            })}
          </div>
        ) : (
          <p className="text-xs text-gray-500">
            {ownerType === "user"
              ? "본인이 받습니다 (개인 양식)."
              : "회사 멤버가 로그인 후 표시됩니다."}
          </p>
        )}
      </Row>
      <Row label="개인정보 처리방침 URL">
        <input
          type="url"
          value={privacyUrl}
          onChange={(e) => setPrivacyUrl(e.target.value)}
          placeholder="https://..."
          data-testid="booking-type-form-privacy-url"
          className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
        />
      </Row>
      <Row label="시간대">
        <input
          type="text"
          value={timezone}
          onChange={(e) => setTimezone(e.target.value)}
          data-testid="booking-type-form-timezone"
          className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
        />
      </Row>
      <div className="flex justify-end border-t border-gray-200 pt-4">
        <button
          onClick={save}
          disabled={busy}
          data-testid="booking-type-form-save"
          className="rounded bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
        >
          {submitLabel}
        </button>
      </div>
    </div>
  )
}
