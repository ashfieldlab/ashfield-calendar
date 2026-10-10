"""모든 라우터 등록: main.py가 한 번에 include."""

from fastapi import APIRouter

from app.api.v1 import (
    activity,
    admin_jobs,
    admin_smtp,
    admin_workspaces,
    audit,
    booking_types,
    caldav_tokens,
    calendars,
    email_templates,
    events,
    me,
    notifications,
    rooms,
    search,
    webhooks,
    workspace,
    workspace_members,
    workspace_profile,
    workspace_smtp,
)

api_router = APIRouter(prefix="/api/v1")
api_router.include_router(me.router, tags=["auth"])
api_router.include_router(calendars.router)
api_router.include_router(events.router)
api_router.include_router(audit.router)
api_router.include_router(notifications.router)
api_router.include_router(webhooks.router)
api_router.include_router(search.router)
api_router.include_router(activity.router)
api_router.include_router(workspace.router)
api_router.include_router(admin_workspaces.router)
api_router.include_router(admin_jobs.router)
api_router.include_router(admin_smtp.router)
api_router.include_router(workspace_smtp.router)
api_router.include_router(workspace_profile.router)
api_router.include_router(workspace_members.router)
api_router.include_router(booking_types.router)
api_router.include_router(email_templates.router)
api_router.include_router(caldav_tokens.router)
api_router.include_router(rooms.router)
