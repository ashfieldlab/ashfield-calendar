"""/api/v1/rooms: 회의실(Room) 관리 (ADR-0019).

- 목록(GET): 활성 워크스페이스 멤버 누구나 (이벤트 폼에서 방 선택용).
- 생성, 수정, 삭제: 워크스페이스 관리자만.
Room 은 Event 가 room_id 로 참조하는 경량 리소스. 삭제 시 events.room_id=SET NULL.
"""

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.context import UserContext
from app.auth.dependencies import get_current_user, require_active_workspace
from app.core.db import get_db
from app.models.room import Room
from app.models.user_workspace_membership import UserWorkspaceMembership
from app.services.rooms import (
    conflict_params,
    find_room_conflicts,
    get_room_or_404,
    new_room_id,
)

router = APIRouter(prefix="/rooms", tags=["rooms"])


class RoomCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    capacity: int | None = Field(default=None, ge=1, le=100000)


class RoomPatch(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    capacity: int | None = Field(default=None, ge=1, le=100000)


class RoomResponse(BaseModel):
    id: str
    name: str
    capacity: int | None
    created_at: datetime


class RoomListResponse(BaseModel):
    rooms: list[RoomResponse]


class RoomConflictsRequest(BaseModel):
    start_at: datetime
    end_at: datetime
    # 수정 중인 일정 자신은 겹침에서 뺀다
    exclude_event_id: str | None = None


class RoomConflict(BaseModel):
    room_id: str
    start_at: datetime
    end_at: datetime
    all_day: bool
    # 요청자가 읽을 수 있는 일정일 때만
    title: str | None = None


class RoomConflictsResponse(BaseModel):
    conflicts: list[RoomConflict]


async def _assert_workspace_admin(
    db: AsyncSession, user: UserContext, workspace_id: str
) -> None:
    """활성 워크스페이스의 관리자(role='admin' 또는 System Admin)만: 쓰기용. ADR-0010."""
    if user.is_system_admin:
        return
    m = await db.get(UserWorkspaceMembership, (user.sub, workspace_id))
    if m is None or m.role != "admin":
        raise HTTPException(status_code=403, detail="워크스페이스 관리자만 가능합니다")


@router.get("", response_model=RoomListResponse, summary="회의실 목록")
async def list_rooms(
    _user: UserContext = Depends(get_current_user),
    workspace_id: str = Depends(require_active_workspace),
    db: AsyncSession = Depends(get_db),
) -> RoomListResponse:
    rows = (
        await db.execute(
            select(Room).where(Room.workspace_id == workspace_id).order_by(Room.name)
        )
    ).scalars().all()
    return RoomListResponse(
        rooms=[RoomResponse.model_validate(r, from_attributes=True) for r in rows]
    )


@router.post(
    "/conflicts",
    response_model=RoomConflictsResponse,
    summary="[start, end) 에 사용 중인 회의실과 겹친 일정 (이벤트 폼 미리보기)",
)
async def room_conflicts(
    body: RoomConflictsRequest,
    user: UserContext = Depends(get_current_user),
    workspace_id: str = Depends(require_active_workspace),
    db: AsyncSession = Depends(get_db),
) -> RoomConflictsResponse:
    room_ids = list(
        (await db.execute(select(Room.id).where(Room.workspace_id == workspace_id))).scalars()
    )
    found = await find_room_conflicts(
        db,
        room_ids=room_ids,
        start_at=body.start_at,
        end_at=body.end_at,
        exclude_event_id=body.exclude_event_id,
    )
    conflicts = [
        RoomConflict.model_validate(
            {"room_id": rid, **await conflict_params(db, ev, user=user, workspace_id=workspace_id)}
        )
        for rid, ev in found.items()
    ]
    return RoomConflictsResponse(conflicts=conflicts)


@router.post("", response_model=RoomResponse, status_code=201, summary="회의실 생성")
async def create_room(
    body: RoomCreate,
    user: UserContext = Depends(get_current_user),
    workspace_id: str = Depends(require_active_workspace),
    db: AsyncSession = Depends(get_db),
) -> RoomResponse:
    await _assert_workspace_admin(db, user, workspace_id)
    room = Room(
        id=new_room_id(),
        workspace_id=workspace_id,
        name=body.name.strip(),
        capacity=body.capacity,
        created_by_sub=user.sub,
    )
    db.add(room)
    await db.commit()
    await db.refresh(room)
    return RoomResponse.model_validate(room, from_attributes=True)


@router.patch("/{room_id}", response_model=RoomResponse, summary="회의실 수정")
async def patch_room(
    room_id: str,
    body: RoomPatch,
    user: UserContext = Depends(get_current_user),
    workspace_id: str = Depends(require_active_workspace),
    db: AsyncSession = Depends(get_db),
) -> RoomResponse:
    await _assert_workspace_admin(db, user, workspace_id)
    room = await get_room_or_404(db, room_id=room_id, workspace_id=workspace_id)
    fields = body.model_dump(exclude_unset=True)
    if "name" in fields and fields["name"]:
        room.name = fields["name"].strip()
    if "capacity" in fields:
        room.capacity = fields["capacity"]
    await db.commit()
    await db.refresh(room)
    return RoomResponse.model_validate(room, from_attributes=True)


@router.delete("/{room_id}", status_code=204, summary="회의실 삭제")
async def delete_room(
    room_id: str,
    user: UserContext = Depends(get_current_user),
    workspace_id: str = Depends(require_active_workspace),
    db: AsyncSession = Depends(get_db),
) -> None:
    await _assert_workspace_admin(db, user, workspace_id)
    room = await get_room_or_404(db, room_id=room_id, workspace_id=workspace_id)
    # events.room_id 는 SET NULL: 참조 이벤트는 방만 해제되고 보존.
    await db.delete(room)
    await db.commit()
