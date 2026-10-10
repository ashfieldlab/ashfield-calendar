"use client"

import { useEffect, useMemo, useState } from "react"
import DatePicker, { registerLocale } from "react-datepicker"
import { ko } from "date-fns/locale/ko"
import "react-datepicker/dist/react-datepicker.css"

import { api, apiDownload } from "@/lib/api-client"
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

  return (
    <>
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30"
      onClick={onClose}
    >
      <div
        className="max-h-[90vh] w-[480px] space-y-3 overflow-y-auto rounded-lg bg-white p-6 shadow-lg"
        onClick={(e) => e.stopPropagation()}
        data-testid="event-form"
      >
        <div>
          <h3 className="text-base font-semibold text-gray-900">
            {readOnly ? "일정 상세" : editing ? "일정 수정" : "새 일정"}
          </h3>
          {readOnly && (
            <p className="mt-0.5 truncate text-xs text-gray-500">읽기 전용</p>
          )}
        </div>

        {editing?.rrule && !readOnly && (
          <div
            className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800"
            data-testid="event-form-recur-notice"
          >
            반복 일정입니다. 저장할 때 <b>이 회차만</b> 또는 <b>전체 회차</b>에
            적용할지 선택합니다.
          </div>
        )}

        <Field label="제목">
          <input
            autoFocus={!readOnly}
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            readOnly={readOnly}
            data-testid="event-form-title-input"
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none read-only:bg-gray-50"
          />
        </Field>

        <Field label="캘린더">
          {readOnly && editingCalendar ? (
            <p className="rounded border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700">
              {editingCalendar.scope === "shared" ? "[공유] " : ""}
              {editingCalendar.name}
            </p>
          ) : (
            <select
              value={calendarId}
              onChange={(e) => setCalendarId(e.target.value)}
              data-testid="event-form-calendar-select"
              disabled={!!editing}
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none disabled:bg-gray-50"
            >
              {writable.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.scope === "shared" ? "[공유] " : ""}
                  {c.name}
                </option>
              ))}
            </select>
          )}
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="시작">
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
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none disabled:bg-gray-50"
            />
          </Field>
          <Field label="종료">
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
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none disabled:bg-gray-50"
            />
          </Field>
        </div>

        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={allDay}
            onChange={(e) => setAllDay(e.target.checked)}
            disabled={readOnly}
            data-testid="event-form-allday-checkbox"
          />
          종일
        </label>

        {rooms.length > 0 && (!readOnly || roomId) && (
          <Field label="회의실">
            <select
              value={roomId}
              onChange={(e) => setRoomId(e.target.value)}
              disabled={readOnly}
              data-testid="event-form-room-select"
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none disabled:bg-gray-50"
            >
              <option value="">회의실 없음</option>
              {rooms.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                  {r.capacity != null ? ` (${r.capacity}인)` : ""}
                </option>
              ))}
            </select>
          </Field>
        )}

        {(!readOnly || location) && (
          <Field label="장소">
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              readOnly={readOnly}
              data-testid="event-form-location-input"
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none read-only:bg-gray-50"
            />
          </Field>
        )}

        {(!readOnly || description) && (
          <Field label="설명">
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              readOnly={readOnly}
              data-testid="event-form-description-input"
              rows={3}
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none read-only:bg-gray-50"
            />
          </Field>
        )}

        {editing && (
          <div className="flex justify-end">
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
              className="text-xs font-medium text-gray-600 hover:text-gray-900 hover:underline"
            >
              .ics 다운로드
            </button>
          </div>
        )}
        {editing && !readOnly && <InvitationsPanel event={editing} />}

        {(!readOnly || repeatPreset !== "none") && (
          <Field label="반복">
            <select
              value={repeatPreset}
              onChange={(e) => setRepeatPreset(e.target.value as RepeatPreset)}
              disabled={readOnly}
              data-testid="event-form-repeat-select"
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none disabled:bg-gray-50"
            >
              <option value="none">반복 없음</option>
              <option value="daily">매일</option>
              <option value="weekly">매주</option>
              <option value="monthly">매월</option>
              <option value="yearly">매년</option>
              <option value="custom">직접 입력 (RRULE)</option>
            </select>
          </Field>
        )}

        {repeatPreset === "custom" && (
          <Field label="RRULE (RFC 5545)" hint="예: FREQ=WEEKLY;BYDAY=MO,WE">
            <input
              type="text"
              value={customRrule}
              onChange={(e) => setCustomRrule(e.target.value)}
              readOnly={readOnly}
              placeholder="FREQ=WEEKLY;BYDAY=MO,WE"
              data-testid="event-form-rrule-input"
              className="w-full rounded border border-gray-300 px-3 py-2 font-mono text-xs focus:border-gray-500 focus:outline-none read-only:bg-gray-50"
            />
          </Field>
        )}

        {(!readOnly || reminderMinutes !== null) && (
          <Field label="알림">
            <select
              value={reminderMinutes === null ? "" : String(reminderMinutes)}
              onChange={(e) =>
                setReminderMinutes(e.target.value === "" ? null : Number(e.target.value))
              }
              disabled={readOnly}
              data-testid="event-form-reminder-select"
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none disabled:bg-gray-50"
            >
              <option value="">알림 없음</option>
              <option value="5">5분 전</option>
              <option value="15">15분 전</option>
              <option value="30">30분 전</option>
              <option value="60">1시간 전</option>
              <option value="1440">1일 전</option>
            </select>
          </Field>
        )}

        <div className="flex items-center justify-between pt-2">
          {editing && !readOnly ? (
            <button
              onClick={remove}
              disabled={busy}
              data-testid="event-form-delete-button"
              className="rounded px-3 py-1.5 text-sm font-medium text-rose-600 hover:bg-rose-50 disabled:opacity-50"
            >
              삭제
            </button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <button
              onClick={onClose}
              data-testid="event-form-cancel-button"
              className="rounded px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100"
            >
              {readOnly ? "닫기" : "취소"}
            </button>
            {!readOnly && (
              <button
                onClick={save}
                disabled={busy || !title.trim() || !calendarId}
                data-testid="event-form-save-button"
                className="rounded bg-gray-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
              >
                저장
              </button>
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
