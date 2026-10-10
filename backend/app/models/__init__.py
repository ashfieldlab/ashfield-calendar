"""모델 패키지: Alembic autogenerate가 이 Base.metadata를 읽음."""

from app.models.audit_log import AuditLog
from app.models.base import Base
from app.models.booking import Booking
from app.models.booking_type import BookingType
from app.models.caldav_token import CalDavToken
from app.models.calendar import Calendar
from app.models.calendar_event import CalendarEvent
from app.models.calendar_event_invitation import CalendarEventInvitation
from app.models.calendar_event_reminder_dispatch import CalendarEventReminderDispatch
from app.models.calendar_object_change import CalendarObjectChange
from app.models.email_template import WorkspaceEmailTemplate
from app.models.job_run import JobRun
from app.models.notification import Notification
from app.models.room import Room
from app.models.smtp_config import SystemSmtpConfig, WorkspaceSmtpOverride
from app.models.user import User
from app.models.user_calendar_preference import UserCalendarPreference
from app.models.user_notification_preference import UserNotificationPreference
from app.models.user_workspace_membership import UserWorkspaceMembership
from app.models.webhook import WebhookDelivery, WebhookEndpoint
from app.models.workspace import Workspace

__all__ = [
    "AuditLog",
    "Base",
    "Booking",
    "BookingType",
    "Calendar",
    "CalendarEvent",
    "CalendarEventInvitation",
    "CalendarEventReminderDispatch",
    "CalendarObjectChange",
    "CalDavToken",
    "Workspace",
    "WorkspaceEmailTemplate",
    "JobRun",
    "Notification",
    "Room",
    "SystemSmtpConfig",
    "WorkspaceSmtpOverride",
    "User",
    "UserCalendarPreference",
    "UserWorkspaceMembership",
    "UserNotificationPreference",
    "WebhookDelivery",
    "WebhookEndpoint",
]
