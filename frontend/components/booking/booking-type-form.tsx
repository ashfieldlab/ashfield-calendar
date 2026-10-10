"use client"

// 예약 양식 만들기와 편집: 한 페이지 섹션형 (왼쪽 섹션 제목, 오른쪽 입력) + 하단 고정 저장 바.

import { useEffect, useMemo, useState } from "react"
import { Users } from "lucide-react"

import { useAppContext } from "@/components/providers/app-context"
import {
  ChipPicker,
  FieldLabel,
  Stepper,
  bookingInputCls as inputCls,
  durationText,
} from "@/components/booking/booking-controls"
import { WeeklyScheduleEditor } from "@/components/booking/weekly-schedule-editor"
import { useToast } from "@/components/ui-custom/use-toast"
import { useApiGet } from "@/lib/hooks/use-api"
import { cn } from "@/lib/utils"
import type { CalendarListResponse, CalendarResponse } from "@/lib/types/api"
import type {
  BookingTypeCreate,
  BookingTypeOwner,
  BookingTypeResponse,
  WeeklySchedule,
} from "@/lib/types/booking"

interface WorkspaceMember {
  user_sub: string
  email: string | null
  name: string | null
  role: "admin" | "member"
}
interface WorkspaceMemberList {
  members: WorkspaceMember[]
}

interface Props {
  /** 편집 모드면 초기값. 생성 모드면 undefined. */
  initial?: BookingTypeResponse
  /** 저장. 성공하면 true (저장 안 됨 표시를 지운다). */
  onSubmit: (body: BookingTypeCreate) => Promise<boolean>
  busy?: boolean
  submitLabel?: string
}

interface Draft {
  ownerType: BookingTypeOwner
  title: string
  description: string
  privacyUrl: string
  duration: number
  timezone: string
  weekly: WeeklySchedule
  availableFrom: string
  availableTo: string
  minimumNotice: number
  lookaheadDays: number
  capacity: number
  targetCalendarId: string
  blockingCalendarIds: string[]
  notifyUserSubs: string[]
}

const WORK: [string, string][] = [
  ["09:00", "12:00"],
  ["13:00", "18:00"],
]

const DURATIONS = [15, 30, 45, 60, 90]
const NOTICES: { v: number; label: string }[] = [
  { v: 0, label: "바로" },
  { v: 60, label: "1시간 전" },
  { v: 240, label: "4시간 전" },
  { v: 1440, label: "하루 전" },
  { v: 2880, label: "이틀 전" },
]
const LOOKAHEADS = [7, 14, 30, 60, 90]

function draftOf(bt?: BookingTypeResponse): Draft {
  return {
    ownerType: bt?.owner_type ?? "user",
    title: bt?.title ?? "",
    description: bt?.description ?? "",
    privacyUrl: bt?.privacy_policy_url ?? "",
    duration: bt?.duration_minutes ?? 30,
    timezone: bt?.timezone ?? "Asia/Seoul",
    weekly: bt?.weekly_schedule ?? { mon: WORK, tue: WORK, wed: WORK, thu: WORK, fri: WORK },
    availableFrom: bt?.available_from ?? "",
    availableTo: bt?.available_to ?? "",
    minimumNotice: bt?.minimum_notice_minutes ?? 60 * 24,
    lookaheadDays: bt?.lookahead_days ?? 30,
    capacity: bt?.capacity ?? 1,
    targetCalendarId: bt?.target_calendar_id ?? "",
    blockingCalendarIds: bt?.blocking_calendar_ids ?? [],
    notifyUserSubs: bt?.notify_user_subs ?? [],
  }
}

function validate(d: Draft): Partial<Record<keyof Draft, string>> {
  const e: Partial<Record<keyof Draft, string>> = {}
  if (!d.title.trim()) e.title = "제목을 입력하세요"
  if (!(d.duration >= 5 && d.duration <= 1440)) e.duration = "5분에서 1440분 사이"
  if (!(d.capacity >= 1)) e.capacity = "1명 이상"
  if (!Object.values(d.weekly).some((b) => b && b.length > 0)) e.weekly = "가능한 요일이 없습니다"
  if (d.availableFrom && d.availableTo && d.availableFrom > d.availableTo) e.availableTo = "시작 날짜보다 뒤여야 합니다"
  if (!(d.minimumNotice >= 0)) e.minimumNotice = "0분 이상"
  if (!(d.lookaheadDays >= 1 && d.lookaheadDays <= 90)) e.lookaheadDays = "1일에서 90일 사이"
  if (!d.targetCalendarId) e.targetCalendarId = "캘린더를 선택하세요"
  return e
}

const calColor = (c: CalendarResponse) => c.color_override ?? c.color

function isTargetFor(c: CalendarResponse, owner: BookingTypeOwner) {
  if (c.managed || c.source !== "native") return false
  return owner === "user" ? c.scope === "personal" : c.scope === "shared"
}

function Section({ title, children, testId }: { title: string; children: React.ReactNode; testId: string }) {
  return (
    <section className="grid gap-4 py-7 md:grid-cols-[180px_1fr] md:gap-8" data-testid={testId}>
      <h2 className="text-sm font-semibold text-foreground">{title}</h2>
      <div className="min-w-0 space-y-5">{children}</div>
    </section>
  )
}

export function BookingTypeForm({ initial, onSubmit, busy = false, submitLabel = "저장" }: Props) {
  const { toast } = useToast()
  const { authUser, isWorkspaceAdmin, activeWorkspaceId } = useAppContext()
  const { data: calData } = useApiGet<CalendarListResponse>("/api/v1/calendars")
  const calendars = useMemo(() => calData?.calendars ?? [], [calData])
  // GET /members 는 workspace admin 전용: 워크스페이스 소유 양식은 admin 만 다루므로 admin 일 때만 부른다.
  const { data: memberData } = useApiGet<WorkspaceMemberList>(
    isWorkspaceAdmin && activeWorkspaceId
      ? `/api/v1/workspaces/${encodeURIComponent(activeWorkspaceId)}/members`
      : null,
  )
  const workspaceMembers = memberData?.members ?? []

  const isNew = !initial
  const [d, setD] = useState<Draft>(() => draftOf(initial))
  const [saved, setSaved] = useState<Draft>(() => draftOf(initial))
  const set = (p: Partial<Draft>) => setD((x) => ({ ...x, ...p }))
  const errors = validate(d)
  const dirty = JSON.stringify(d) !== JSON.stringify(saved)

  // 새 양식: 캘린더가 도착하면 기본 대상 캘린더 자동 선택 (기준값도 같이 맞춰 "저장 안 됨" 이 뜨지 않게)
  useEffect(() => {
    if (!isNew || d.targetCalendarId) return
    const first = calendars.find((c) => isTargetFor(c, d.ownerType))
    if (!first) return
    setD((x) => ({ ...x, targetCalendarId: first.id }))
    setSaved((x) => (x.targetCalendarId ? x : { ...x, targetCalendarId: first.id }))
  }, [calendars, d.ownerType, d.targetCalendarId, isNew])

  const targetCandidates = calendars.filter((c) => isTargetFor(c, d.ownerType))
  const blockingCandidates = calendars.filter((c) => c.id !== d.targetCalendarId)

  function changeOwner(o: BookingTypeOwner) {
    if (o === d.ownerType) return
    set({
      ownerType: o,
      targetCalendarId: calendars.find((c) => isTargetFor(c, o))?.id ?? "",
      notifyUserSubs: [],
    })
  }

  function toggleIn(list: string[], id: string) {
    return list.includes(id) ? list.filter((x) => x !== id) : [...list, id]
  }

  async function save() {
    const first = Object.values(errors)[0]
    if (first) {
      toast.error(first)
      return
    }
    const body: BookingTypeCreate = {
      owner_type: d.ownerType,
      title: d.title.trim(),
      description: d.description.trim() || null,
      privacy_policy_url: d.privacyUrl.trim() || null,
      duration_minutes: d.duration,
      timezone: d.timezone.trim() || "Asia/Seoul",
      weekly_schedule: d.weekly,
      available_from: d.availableFrom || null,
      available_to: d.availableTo || null,
      minimum_notice_minutes: d.minimumNotice,
      lookahead_days: d.lookaheadDays,
      target_calendar_id: d.targetCalendarId,
      blocking_calendar_ids: d.blockingCalendarIds,
      capacity: d.capacity,
      notify_user_subs: d.notifyUserSubs,
    }
    if (await onSubmit(body)) setSaved(d)
  }

  const meName = authUser?.name || authUser?.email || "본인"

  return (
    <div data-testid="booking-type-form">
      <div className="divide-y divide-border rounded-2xl border border-border bg-card px-4 sm:px-6">
        <Section title="기본" testId="booking-type-form-section-basic">
          {isNew && (
            <div>
              <FieldLabel>소유</FieldLabel>
              <div className="grid grid-cols-2 gap-2">
                {(["user", "workspace"] as const).map((o) => (
                  <button
                    key={o}
                    type="button"
                    disabled={o === "workspace" && !isWorkspaceAdmin}
                    title={o === "workspace" && !isWorkspaceAdmin ? "워크스페이스 관리자만" : undefined}
                    onClick={() => changeOwner(o)}
                    className={cn(
                      "flex items-center gap-2 rounded-lg border border-border px-3 py-2.5 text-left text-sm transition-colors disabled:opacity-50",
                      d.ownerType === o ? "border-primary bg-primary/5 ring-1 ring-primary" : "hover:bg-muted/50",
                    )}
                    data-testid={`booking-type-form-owner-${o}`}
                  >
                    {o === "user" ? (
                      <span className="size-2 rounded-full bg-primary" />
                    ) : (
                      <Users className="size-4 text-muted-foreground" />
                    )}
                    {o === "user" ? "개인" : "워크스페이스"}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div>
            <FieldLabel error={errors.title}>제목</FieldLabel>
            <input
              value={d.title}
              onChange={(e) => set({ title: e.target.value })}
              placeholder="예: 30분 상담"
              className={cn(inputCls, "text-base font-medium", errors.title && "border-rose-400 dark:border-rose-700")}
              data-testid="booking-type-form-title"
            />
          </div>
          <div>
            <FieldLabel>안내 문구</FieldLabel>
            <textarea
              value={d.description}
              onChange={(e) => set({ description: e.target.value })}
              rows={3}
              className={cn(inputCls, "resize-y")}
              data-testid="booking-type-form-description"
            />
          </div>
        </Section>

        <Section title="시간" testId="booking-type-form-section-time">
          <div>
            <FieldLabel error={errors.duration}>길이</FieldLabel>
            <ChipPicker
              value={d.duration}
              options={DURATIONS.map((v) => ({ v, label: durationText(v) }))}
              onChange={(v) => set({ duration: v })}
              suffix="분"
              min={5}
              max={1440}
              testId="booking-type-form-duration"
            />
          </div>
          <div>
            <FieldLabel error={errors.capacity}>정원</FieldLabel>
            <Stepper
              value={d.capacity}
              onChange={(v) => set({ capacity: v })}
              unit="명"
              testId="booking-type-form-capacity"
            />
          </div>
        </Section>

        <Section title="가능 시간" testId="booking-type-form-section-availability">
          <div>
            <FieldLabel error={errors.weekly}>요일과 시간</FieldLabel>
            <WeeklyScheduleEditor value={d.weekly} onChange={(w) => set({ weekly: w })} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <FieldLabel>시작 날짜</FieldLabel>
              <input
                type="date"
                value={d.availableFrom}
                onChange={(e) => set({ availableFrom: e.target.value })}
                className={inputCls}
                data-testid="booking-type-form-available-from"
              />
            </div>
            <div>
              <FieldLabel error={errors.availableTo}>종료 날짜</FieldLabel>
              <input
                type="date"
                value={d.availableTo}
                onChange={(e) => set({ availableTo: e.target.value })}
                className={inputCls}
                data-testid="booking-type-form-available-to"
              />
            </div>
          </div>
        </Section>

        <Section title="예약 규칙" testId="booking-type-form-section-rules">
          <div>
            <FieldLabel error={errors.minimumNotice}>최소 예약 시점</FieldLabel>
            <ChipPicker
              value={d.minimumNotice}
              options={NOTICES}
              onChange={(v) => set({ minimumNotice: v })}
              suffix="분 전"
              min={0}
              testId="booking-type-form-min-notice"
            />
          </div>
          <div>
            <FieldLabel error={errors.lookaheadDays}>미리 예약 기한</FieldLabel>
            <ChipPicker
              value={d.lookaheadDays}
              options={LOOKAHEADS.map((v) => ({ v, label: `${v}일` }))}
              onChange={(v) => set({ lookaheadDays: v })}
              suffix="일"
              min={1}
              max={90}
              testId="booking-type-form-lookahead-days"
            />
          </div>
        </Section>

        <Section title="캘린더" testId="booking-type-form-section-calendar">
          <div>
            <FieldLabel error={errors.targetCalendarId}>예약이 들어갈 캘린더</FieldLabel>
            {targetCandidates.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {d.ownerType === "user" ? "개인 캘린더가 없습니다" : "공유 캘린더가 없습니다"}
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {targetCandidates.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() =>
                      set({
                        targetCalendarId: c.id,
                        blockingCalendarIds: d.blockingCalendarIds.filter((x) => x !== c.id),
                      })
                    }
                    className={cn(
                      "inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm transition-colors",
                      d.targetCalendarId === c.id ? "border-primary bg-primary/5 ring-1 ring-primary" : "hover:bg-muted/50",
                    )}
                    data-testid={`booking-type-form-target-cal-${c.id}`}
                  >
                    <span className="size-2.5 rounded-full" style={{ backgroundColor: calColor(c) }} />
                    {c.name}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div>
            <FieldLabel>충돌 확인</FieldLabel>
            {blockingCandidates.length === 0 ? (
              <p className="text-sm text-muted-foreground">캘린더 없음</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {blockingCandidates.map((c) => {
                  const on = d.blockingCalendarIds.includes(c.id)
                  return (
                    <button
                      key={c.id}
                      type="button"
                      aria-pressed={on}
                      onClick={() => set({ blockingCalendarIds: toggleIn(d.blockingCalendarIds, c.id) })}
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1 text-xs transition-colors",
                        on ? "border-foreground/30 bg-foreground/5 font-medium" : "text-muted-foreground hover:bg-muted",
                      )}
                      data-testid={`booking-type-form-blocking-${c.id}`}
                    >
                      <span className={cn("size-2 rounded-full", !on && "opacity-40")} style={{ backgroundColor: calColor(c) }} />
                      {c.name}
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        </Section>

        <Section title="알림과 공개" testId="booking-type-form-section-notify">
          <div>
            <FieldLabel>알림 받을 사람</FieldLabel>
            {d.ownerType === "user" ? (
              <div className="inline-flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm">
                <span className="grid size-6 place-items-center rounded-full bg-primary text-[11px] font-medium text-primary-foreground">
                  {meName[0]}
                </span>
                본인
              </div>
            ) : workspaceMembers.length === 0 ? (
              <p className="text-sm text-muted-foreground">선택할 멤버가 없습니다</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {workspaceMembers.map((m) => {
                  const on = d.notifyUserSubs.includes(m.user_sub)
                  const label = m.name ?? m.email ?? m.user_sub
                  return (
                    <button
                      key={m.user_sub}
                      type="button"
                      aria-pressed={on}
                      title={m.email ?? undefined}
                      onClick={() => set({ notifyUserSubs: toggleIn(d.notifyUserSubs, m.user_sub) })}
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-full border border-border py-0.5 pr-2.5 pl-0.5 text-xs transition-colors",
                        on ? "border-primary bg-primary/5 font-medium" : "text-muted-foreground hover:bg-muted",
                      )}
                      data-testid={`booking-type-form-notify-${m.user_sub}`}
                    >
                      <span
                        className={cn(
                          "grid size-5 place-items-center rounded-full bg-primary text-[10px] font-medium text-primary-foreground",
                          !on && "opacity-40",
                        )}
                      >
                        {label[0]}
                      </span>
                      {label}
                    </button>
                  )
                })}
              </div>
            )}
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
                data-testid="booking-type-form-privacy-url"
              />
            </div>
            <div>
              <FieldLabel>시간대</FieldLabel>
              <input
                value={d.timezone}
                onChange={(e) => set({ timezone: e.target.value })}
                className={inputCls}
                data-testid="booking-type-form-timezone"
              />
            </div>
          </div>
        </Section>
      </div>

      <div className="sticky bottom-0 z-10 mt-4 pb-4">
        <div className="flex items-center justify-end gap-2 rounded-xl border border-border bg-card px-4 py-3 shadow-lg dark:ring-1 dark:ring-foreground/10">
          <span
            className={cn("mr-auto text-xs", dirty ? "text-amber-700 dark:text-amber-400" : "text-muted-foreground")}
            data-testid="booking-type-form-status"
          >
            {dirty ? "저장 안 됨" : isNew ? "" : "저장됨"}
          </span>
          <button
            type="button"
            onClick={() => setD(saved)}
            disabled={!dirty || busy}
            className="rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-40"
            data-testid="booking-type-form-reset"
          >
            되돌리기
          </button>
          <button
            type="button"
            onClick={save}
            disabled={busy || (!isNew && !dirty)}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            data-testid="booking-type-form-save"
          >
            {busy ? "저장 중…" : submitLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
