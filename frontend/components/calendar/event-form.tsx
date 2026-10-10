"use client"

import { useEffect, useMemo, useState } from "react"
import DatePicker, { registerLocale } from "react-datepicker"
import { ArrowRight, Download, Users } from "lucide-react"
import { ko } from "date-fns/locale/ko"
import "react-datepicker/dist/react-datepicker.css"

import { Button } from "@/components/ui/button"
import { api, apiDownload } from "@/lib/api-client"
import { cn } from "@/lib/utils"
import { useConfirm } from "@/components/ui-custom/use-confirm"
import { InvitationsPanel } from "@/components/calendar/invitations-panel"
import { useToast } from "@/components/ui-custom/use-toast"
import { invalidateApi, useApiGet } from "@/lib/hooks/use-api"
import type {
  CalendarResponse,
  EventResponse,
  RoomListResponse,
} from "@/lib/types/api"

registerLocale("ko", ko)

interface Props {
  calendars: CalendarResponse[]
  initialStart: Date
  /** edit 모드: 기존 event 로딩한 데이터. null이면 create 모드. */
  editing?: EventResponse | null
  onClose: () => void
}

function endOfDayHour(d: Date, hourOffset = 1): Date {
  const e = new Date(d)
  e.setHours(d.getHours() + hourOffset, 0, 0, 0)
  return e
}

type RepeatPreset = "none" | "daily" | "weekly" | "monthly" | "yearly" | "custom"

const PRESET_TO_RRULE: Record<Exclude<RepeatPreset, "none" | "custom">, string> = {
  daily: "FREQ=DAILY",
  weekly: "FREQ=WEEKLY",
  monthly: "FREQ=MONTHLY",
  yearly: "FREQ=YEARLY",
}

function rruleToPreset(rule: string | null | undefined): RepeatPreset {
  if (!rule) return "none"
  const normalized = rule.trim().toUpperCase()
  for (const [key, value] of Object.entries(PRESET_TO_RRULE)) {
    if (normalized === value) return key as RepeatPreset
  }
  return "custom"
}

export function EventForm({ calendars, initialStart, editing, onClose }: Props) {
  const { toast } = useToast()
  const confirm = useConfirm()
  const writable = calendars.filter(
    (c) => !c.hidden && c.source === "native",
  )
  const editingCalendar = editing
    ? calendars.find((c) => c.id === editing.calendar_id)
    : null
  const readOnly = editingCalendar?.source === "external_ics"

  const initialEnd = useMemo(() => endOfDayHour(initialStart), [initialStart])

  const [calendarId, setCalendarId] = useState(
    editing?.calendar_id ?? writable[0]?.id ?? "",
  )
  const [title, setTitle] = useState(editing?.title ?? "")
  // 반복 일정 편집은 클릭한 "회차"의 시각을 보여줌(마스터 앵커 아님): 이 회차만
  // 수정 시 올바른 날짜에 분리되도록. 종료는 회차 시작 + 마스터 지속시간.
  const [startAt, setStartAt] = useState<Date>(() =>
    editing?.rrule
      ? initialStart
      : editing?.start_at
        ? new Date(editing.start_at)
        : initialStart,
  )
  const [endAt, setEndAt] = useState<Date>(() => {
    if (editing?.rrule && editing.start_at && editing.end_at) {
      const dur =
        new Date(editing.end_at).getTime() - new Date(editing.start_at).getTime()
      return new Date(initialStart.getTime() + dur)
    }
    return editing?.end_at ? new Date(editing.end_at) : initialEnd
  })
  const [allDay, setAllDay] = useState(editing?.all_day ?? false)
  const [location, setLocation] = useState(editing?.location ?? "")
  const [roomId, setRoomId] = useState(editing?.room_id ?? "")
  const { data: roomData } = useApiGet<RoomListResponse>("/api/v1/rooms")
  const rooms = roomData?.rooms ?? []
  const [description, setDescription] = useState(editing?.description ?? "")
  const [repeatPreset, setRepeatPreset] = useState<RepeatPreset>(
    rruleToPreset(editing?.rrule),
  )
  const [customRrule, setCustomRrule] = useState(
    rruleToPreset(editing?.rrule) === "custom" ? (editing?.rrule ?? "") : "",
  )
  // 알림: null = 꺼짐. 값(분) = 시작 N분 전 in-app 알림.
  const [reminderMinutes, setReminderMinutes] = useState<number | null>(
    editing?.reminder_minutes_before ?? null,
  )
  const [busy, setBusy] = useState(false)
  // 반복 일정 삭제 시 "이 일정만 / 전체" 선택 모달
  const [showRecurDelete, setShowRecurDelete] = useState(false)
  // 반복 일정 수정 시 "이 회차만 / 전체" 선택 모달
  const [showRecurEdit, setShowRecurEdit] = useState(false)

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [onClose])

  function buildStartEnd(): { start: Date; end: Date } {
    if (allDay) {
      const start = new Date(startAt)
      start.setHours(0, 0, 0, 0)
      const end = new Date(endAt)
      end.setHours(23, 59, 59, 0)
      return { start, end }
    }
    return { start: startAt, end: endAt }
  }

  function buildRrule(): string | null {
    if (repeatPreset === "none") return null
    if (repeatPreset === "custom") return customRrule.trim() || null
    return PRESET_TO_RRULE[repeatPreset]
  }

  function save() {
    if (!title.trim() || !calendarId) return
    // 반복 일정 수정은 "이 회차만 / 전체" 선택 후 진행.
    if (editing?.rrule) {
      setShowRecurEdit(true)
      return
    }
    void doSave("series")
  }

  // scope: 'occurrence'(이 회차만 분리 수정) | 'series'(전체/일반).
  async function doSave(scope: "occurrence" | "series") {
    if (!title.trim() || !calendarId) return
    const { start, end } = buildStartEnd()
    // 반복 일정 "전체 회차" 수정: 폼은 회차 시각을 보여주므로, 사용자가 준 시간
    // 변화(delta)를 마스터 앵커에 반영해야 앵커가 회차 날짜로 밀리지 않음.
    let startISO = start.toISOString()
    let endISO = end.toISOString()
    if (
      editing?.rrule &&
      scope === "series" &&
      editing.start_at &&
      editing.end_at
    ) {
      const masterDur =
        new Date(editing.end_at).getTime() - new Date(editing.start_at).getTime()
      const occStart = initialStart.getTime()
      const startDelta = start.getTime() - occStart
      const endDelta = end.getTime() - (occStart + masterDur)
      startISO = new Date(
        new Date(editing.start_at).getTime() + startDelta,
      ).toISOString()
      endISO = new Date(
        new Date(editing.end_at).getTime() + endDelta,
      ).toISOString()
    }
    setBusy(true)
    try {
      const body = {
        calendar_id: calendarId,
        title: title.trim(),
        description: description.trim() || null,
        location: location.trim() || null,
        start_at: startISO,
        end_at: endISO,
        all_day: allDay,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
        rrule: buildRrule(),
        reminder_minutes_before: reminderMinutes,
        room_id: roomId || null,
      }
      if (editing) {
        const { calendar_id: _cid, ...patch } = body
        void _cid
        const url =
          scope === "occurrence"
            ? `/api/v1/events/${editing.id}?occurrence=${encodeURIComponent(
                initialStart.toISOString(),
              )}`
            : `/api/v1/events/${editing.id}`
        await api(url, { method: "PATCH", body: patch })
        toast.success(
          scope === "occurrence" ? "이 회차를 수정했습니다" : "일정을 수정했습니다",
        )
      } else {
        await api("/api/v1/events", { method: "POST", body })
        toast.success("일정을 만들었습니다")
      }
      invalidateApi("/api/v1/events")
      onClose()
    } catch (e) {
      // 회의실 이중예약(409)은 메시지 그대로, 그 외는 "저장 실패:" 접두.
      const err = e as { code?: string; message: string }
      toast.error(
        err.code === "ROOM_CONFLICT" ? err.message : `저장 실패: ${err.message}`,
      )
    } finally {
      setBusy(false)
      setShowRecurEdit(false)
    }
  }

  // 실제 삭제: scope: 'occurrence'(이 회차만 EXDATE) | 'series'(전체)
  async function doDelete(scope: "occurrence" | "series") {
    if (!editing) return
    setBusy(true)
    try {
      const url =
        scope === "occurrence"
          ? `/api/v1/events/${editing.id}?occurrence=${encodeURIComponent(
              initialStart.toISOString(),
            )}`
          : `/api/v1/events/${editing.id}`
      await api(url, { method: "DELETE" })
      toast.success(
        scope === "occurrence"
          ? "이 일정을 삭제했습니다"
          : "반복 일정을 삭제했습니다",
      )
      invalidateApi("/api/v1/events")
      onClose()
    } catch (e) {
      toast.error(`삭제 실패: ${(e as Error).message}`)
    } finally {
      setBusy(false)
      setShowRecurDelete(false)
    }
  }

  async function remove() {
    if (!editing) return
    // 반복 일정이면 "이 일정만 / 전체" 선택: 안 그러면 회차 하나 지우려다 시리즈 통째 삭제됨
    if (editing.rrule) {
      setShowRecurDelete(true)
      return
    }
    if (!(await confirm({ title: "일정 삭제", description: `'${editing.title}' 일정을 삭제하시겠습니까?`, confirmText: "삭제", variant: "destructive" }))) return
    await doDelete("series")
  }

  const dateLabel = startAt.toLocaleDateString("ko-KR", { month: "long", day: "numeric", weekday: "short" })
  const pickerClass = cn(fieldClass, "w-full")
  const visibleCalendars = editing
    ? calendars.filter((c) => c.id === calendarId)
    : writable

  return (
    <>
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-[820px] flex-col overflow-hidden rounded-2xl border bg-background shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        data-testid="event-form"
        role="dialog"
        aria-modal="true"
        aria-label={readOnly ? "일정 상세" : editing ? "일정 수정" : "새 일정"}
      >
        <div className="grid min-h-0 flex-1 grid-cols-1 overflow-y-auto md:grid-cols-[1fr_260px]">
          <div className="space-y-6 p-7">
            <div className="space-y-2">
              <input
                autoFocus={!readOnly}
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                readOnly={readOnly}
                placeholder="제목"
                aria-label="제목"
                aria-required="true"
                data-testid="event-form-title-input"
                className="w-full border-b-2 border-input bg-transparent pb-2 text-2xl font-semibold outline-none transition placeholder:font-medium placeholder:text-muted-foreground/60 hover:border-ring/50 focus:border-primary read-only:border-transparent"
              />
              {(readOnly || (editing?.rrule && !readOnly)) && (
                <div className="flex gap-1.5">
                  {readOnly && <Badge>읽기 전용</Badge>}
                  {editing?.rrule && !readOnly && (
                    <Badge testid="event-form-recur-notice">반복 일정</Badge>
                  )}
                </div>
              )}
            </div>

            <div className="rounded-xl border bg-muted/30 p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold">{dateLabel}</p>
                {!readOnly && (
                  <div role="radiogroup" aria-label="시간" className="inline-flex rounded-lg bg-muted p-0.5 text-xs">
                    {([
                      [false, "시간 지정"],
                      [true, "종일"],
                    ] as const).map(([value, label]) => (
                      <button
                        key={label}
                        type="button"
                        role="radio"
                        aria-checked={allDay === value}
                        onClick={() => setAllDay(value)}
                        data-testid={value ? "event-form-allday-on" : "event-form-allday-off"}
                        className={cn(
                          "rounded-md px-2.5 py-1 font-medium transition",
                          allDay === value ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground",
                        )}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="mt-3 grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                <DatePicker
                  selected={startAt}
                  onChange={(d: Date | null) => {
                    if (!d) return
                    setStartAt(d)
                    if (endAt.getTime() <= d.getTime()) {
                      setEndAt(new Date(d.getTime() + 60 * 60 * 1000))
                    }
                  }}
                  showTimeSelect={!allDay}
                  timeIntervals={15}
                  dateFormat={allDay ? "yyyy-MM-dd" : "yyyy-MM-dd HH:mm"}
                  timeFormat="HH:mm"
                  locale="ko"
                  wrapperClassName="w-full"
                  disabled={readOnly}
                  className={pickerClass}
                />
                <ArrowRight className="size-4 text-muted-foreground" aria-hidden />
                <DatePicker
                  selected={endAt}
                  onChange={(d: Date | null) => {
                    if (!d) return
                    setEndAt(d)
                    if (startAt.getTime() >= d.getTime()) {
                      setStartAt(new Date(d.getTime() - 60 * 60 * 1000))
                    }
                  }}
                  showTimeSelect={!allDay}
                  timeIntervals={15}
                  dateFormat={allDay ? "yyyy-MM-dd" : "yyyy-MM-dd HH:mm"}
                  timeFormat="HH:mm"
                  locale="ko"
                  wrapperClassName="w-full"
                  disabled={readOnly}
                  className={pickerClass}
                />
              </div>
            </div>

            {(!readOnly || description) && (
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                readOnly={readOnly}
                placeholder="메모"
                rows={5}
                data-testid="event-form-description-input"
                className="w-full resize-none rounded-xl border border-input bg-background px-3.5 py-3 text-sm leading-relaxed outline-none transition placeholder:text-muted-foreground hover:border-ring/50 focus:border-ring focus:ring-3 focus:ring-ring/20 read-only:bg-muted/40"
              />
            )}

            {editing && !readOnly && <InvitationsPanel event={editing} />}
          </div>

          <aside className="space-y-5 border-t bg-muted/40 p-5 md:border-t-0 md:border-l">
            <Prop label="캘린더">
              <div role="radiogroup" aria-label="캘린더" className="space-y-1" data-testid="event-form-calendar-select">
                {(readOnly && editingCalendar ? [editingCalendar] : visibleCalendars).map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    role="radio"
                    aria-checked={calendarId === c.id}
                    disabled={readOnly || !!editing}
                    onClick={() => setCalendarId(c.id)}
                    data-testid={`event-form-calendar-${c.id}`}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition",
                      calendarId === c.id
                        ? "bg-background font-medium shadow-sm"
                        : "text-muted-foreground hover:bg-background/60",
                    )}
                  >
                    <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: c.color_override ?? c.color }} />
                    <span className="truncate">{c.name}</span>
                    {c.scope === "shared" && <Users className="ml-auto size-3.5 shrink-0 opacity-60" aria-label="워크스페이스" />}
                  </button>
                ))}
              </div>
            </Prop>

            {rooms.length > 0 && (!readOnly || roomId) && (
              <Prop label="회의실">
                <select
                  value={roomId}
                  onChange={(e) => setRoomId(e.target.value)}
                  disabled={readOnly}
                  data-testid="event-form-room-select"
                  className={cn(fieldClass, "w-full")}
                >
                  <option value="">없음</option>
                  {rooms.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                      {r.capacity != null ? ` (${r.capacity}인)` : ""}
                    </option>
                  ))}
                </select>
              </Prop>
            )}

            {(!readOnly || location) && (
              <Prop label="장소">
                <input
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  readOnly={readOnly}
                  data-testid="event-form-location-input"
                  className={cn(fieldClass, "w-full")}
                />
              </Prop>
            )}

            {(!readOnly || repeatPreset !== "none") && (
              <Prop label="반복">
                <select
                  value={repeatPreset}
                  onChange={(e) => setRepeatPreset(e.target.value as RepeatPreset)}
                  disabled={readOnly}
                  data-testid="event-form-repeat-select"
                  className={cn(fieldClass, "w-full")}
                >
                  <option value="none">반복 안 함</option>
                  <option value="daily">매일</option>
                  <option value="weekly">매주</option>
                  <option value="monthly">매월</option>
                  <option value="yearly">매년</option>
                  <option value="custom">직접 입력 (RRULE)</option>
                </select>
                {repeatPreset === "custom" && (
                  <input
                    type="text"
                    value={customRrule}
                    onChange={(e) => setCustomRrule(e.target.value)}
                    readOnly={readOnly}
                    placeholder="FREQ=WEEKLY;BYDAY=MO,WE"
                    data-testid="event-form-rrule-input"
                    className={cn(fieldClass, "mt-1.5 w-full font-mono text-xs")}
                  />
                )}
              </Prop>
            )}

            {(!readOnly || reminderMinutes !== null) && (
              <Prop label="알림">
                <select
                  value={reminderMinutes === null ? "" : String(reminderMinutes)}
                  onChange={(e) =>
                    setReminderMinutes(e.target.value === "" ? null : Number(e.target.value))
                  }
                  disabled={readOnly}
                  data-testid="event-form-reminder-select"
                  className={cn(fieldClass, "w-full")}
                >
                  <option value="">알림 없음</option>
                  <option value="5">5분 전</option>
                  <option value="15">15분 전</option>
                  <option value="30">30분 전</option>
                  <option value="60">1시간 전</option>
                  <option value="1440">1일 전</option>
                </select>
              </Prop>
            )}

            {editing && (
              <button
                type="button"
                onClick={async () => {
                  try {
                    await apiDownload(
                      `/api/v1/events/${editing.id}/ics`,
                      `${editing.title || "event"}.ics`,
                    )
                  } catch (e) {
                    toast.error(`다운로드 실패: ${(e as Error).message}`)
                  }
                }}
                data-testid="event-form-ics-download"
                className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
              >
                <Download className="size-3.5" />
                .ics 다운로드
              </button>
            )}
          </aside>
        </div>

        <div className="flex items-center justify-between gap-2 border-t px-6 py-3">
          {editing && !readOnly ? (
            <Button
              variant="ghost"
              onClick={remove}
              disabled={busy}
              data-testid="event-form-delete-button"
              className="text-destructive hover:bg-destructive/10 hover:text-destructive"
            >
              삭제
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onClose} data-testid="event-form-cancel-button">
              {readOnly ? "닫기" : "취소"}
            </Button>
            {!readOnly && (
              <Button
                onClick={save}
                disabled={busy || !title.trim() || !calendarId}
                data-testid="event-form-save-button"
              >
                저장
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
    {showRecurEdit && (
      <div
        className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40"
        onClick={() => !busy && setShowRecurEdit(false)}
      >
        <div
          className="w-80 space-y-3 rounded-lg bg-white p-5 shadow-lg"
          onClick={(e) => e.stopPropagation()}
          data-testid="event-recur-edit"
        >
          <h3 className="text-base font-semibold text-gray-900">반복 일정 수정</h3>
          <p className="text-sm text-gray-600">
            이 회차만 수정할까요, 전체 반복 일정을 수정할까요?
          </p>
          <div className="space-y-2 pt-1">
            <button
              onClick={() => doSave("occurrence")}
              disabled={busy}
              data-testid="event-recur-edit-one"
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm font-medium text-gray-800 hover:bg-gray-50 disabled:opacity-50"
            >
              이 회차만 수정
            </button>
            <button
              onClick={() => doSave("series")}
              disabled={busy}
              data-testid="event-recur-edit-series"
              className="w-full rounded bg-gray-900 px-3 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
            >
              전체 반복 일정 수정
            </button>
            <button
              onClick={() => setShowRecurEdit(false)}
              disabled={busy}
              data-testid="event-recur-edit-cancel"
              className="w-full rounded px-3 py-2 text-sm text-gray-600 hover:bg-gray-100 disabled:opacity-50"
            >
              취소
            </button>
          </div>
        </div>
      </div>
    )}

    {showRecurDelete && (
      <div
        className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40"
        onClick={() => !busy && setShowRecurDelete(false)}
      >
        <div
          className="w-80 space-y-3 rounded-lg bg-white p-5 shadow-lg"
          onClick={(e) => e.stopPropagation()}
          data-testid="event-recur-delete"
        >
          <h3 className="text-base font-semibold text-gray-900">반복 일정 삭제</h3>
          <p className="text-sm text-gray-600">
            이 일정만 삭제할까요, 전체 반복 일정을 삭제할까요?
          </p>
          <div className="space-y-2 pt-1">
            <button
              onClick={() => doDelete("occurrence")}
              disabled={busy}
              data-testid="event-recur-delete-one"
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm font-medium text-gray-800 hover:bg-gray-50 disabled:opacity-50"
            >
              이 일정만 삭제
            </button>
            <button
              onClick={() => doDelete("series")}
              disabled={busy}
              data-testid="event-recur-delete-series"
              className="w-full rounded bg-rose-600 px-3 py-2 text-sm font-medium text-white hover:bg-rose-700 disabled:opacity-50"
            >
              전체 반복 일정 삭제
            </button>
            <button
              onClick={() => setShowRecurDelete(false)}
              disabled={busy}
              data-testid="event-recur-delete-cancel"
              className="w-full rounded px-3 py-2 text-sm text-gray-600 hover:bg-gray-100 disabled:opacity-50"
            >
              취소
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  )
}

const fieldClass =
  "h-9 rounded-lg border border-input bg-background px-2.5 text-sm outline-none transition focus:border-ring focus:ring-3 focus:ring-ring/20 disabled:opacity-70 read-only:bg-muted/50"

function Prop({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <p className="text-[11px] font-semibold tracking-wide text-muted-foreground">{label}</p>
      {children}
    </div>
  )
}

function Badge({ children, testid }: { children: React.ReactNode; testid?: string }) {
  return (
    <span
      data-testid={testid}
      className="inline-flex items-center rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground"
    >
      {children}
    </span>
  )
}
