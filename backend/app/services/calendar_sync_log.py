"""CalDAV sync REPORT (RFC 6578) 용 변경 로그: CalendarEvent ORM 이벤트 hook.

외부 캘린더 앱이 sync_token=N 이후 변경분만 받기 위해 호출하는 sync REPORT 에 응답
하려면, 우리 FastAPI 가 만든, 수정한, 삭제한 이벤트도 `calendar_object_changes` 에
기록돼야 한다 (ADR-0014).

Sabre PHP 측 mutation 은 자체 `recordChange` 가 처리. 이 모듈은 Python 측 ORM
mutation 만 hook.

동작:
  - after_insert: calendar_object_changes op=1 (added) + calendars.sync_token++
  - after_update: deleted_at 이 NULL → not NULL 인 경우 op=3 (deleted),
                  그 외엔 op=2 (modified)
  - after_delete: hard delete 는 거의 없지만 op=3 처리

같은 connection, 트랜잭션 안에서 raw SQL 로 실행 → atomicity 유지.
"""

from __future__ import annotations

from sqlalchemy import event, inspect, text

from app.models.calendar_event import CalendarEvent


def _uri_for(target: CalendarEvent) -> str:
    """외부 캘린더 앱에 노출되는 ICS URI. dav_uri 있으면 그대로, 없으면 fallback."""
    return target.dav_uri or f"{target.id}.ics"


def _record_change(connection, calendar_id: str, object_uri: str, operation: int) -> None:
    """calendars.sync_token 증가 + calendar_object_changes INSERT: 같은 트랜잭션."""
    result = connection.execute(
        text(
            "UPDATE calendars SET sync_token = sync_token + 1 "
            "WHERE id = :id RETURNING sync_token"
        ),
        {"id": calendar_id},
    )
    row = result.first()
    if row is None:
        # 캘린더가 삭제됐다면 row 없음. 정상: 더 이상 sync 대상 아님.
        return
    new_token = int(row[0])
    connection.execute(
        text(
            "INSERT INTO calendar_object_changes "
            "(calendar_id, object_uri, operation, sync_token) "
            "VALUES (:cid, :uri, :op, :tok)"
        ),
        {
            "cid": calendar_id,
            "uri": object_uri,
            "op": operation,
            "tok": new_token,
        },
    )


@event.listens_for(CalendarEvent, "after_insert")
def _on_event_insert(_mapper, connection, target: CalendarEvent) -> None:
    _record_change(connection, target.calendar_id, _uri_for(target), 1)


@event.listens_for(CalendarEvent, "after_update")
def _on_event_update(_mapper, connection, target: CalendarEvent) -> None:
    state = inspect(target)
    history = state.attrs.deleted_at.history
    # 옛 NULL → 새 not NULL = soft delete
    was_active = history.deleted == [None] or history.deleted == ()
    became_deleted = target.deleted_at is not None and history.added not in ((), [None])
    if was_active and became_deleted:
        _record_change(connection, target.calendar_id, _uri_for(target), 3)
        return
    # 이미 deleted 였으면 더 이상 sync 신호 보낼 의미 X
    if target.deleted_at is not None:
        return
    _record_change(connection, target.calendar_id, _uri_for(target), 2)


@event.listens_for(CalendarEvent, "after_delete")
def _on_event_hard_delete(_mapper, connection, target: CalendarEvent) -> None:
    """hard delete (DB DELETE) 는 거의 일어나지 않지만 안전망."""
    _record_change(connection, target.calendar_id, _uri_for(target), 3)
