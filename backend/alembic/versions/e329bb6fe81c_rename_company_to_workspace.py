"""rename company to workspace

테넌트 이름을 company 에서 workspace 로 바꾼다. autogenerate 는 이름 변경을 감지하지 못해
손으로 쓴 마이그레이션이다 (op.rename_table / alter_column / RENAME CONSTRAINT / RENAME INDEX).

Revision ID: e329bb6fe81c
Revises: 7254d9dda1a5
Create Date: 2026-10-10 14:12:58.627217

"""
from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op


# revision identifiers, used by Alembic.
revision: str = 'e329bb6fe81c'
down_revision: str | Sequence[str] | None = '7254d9dda1a5'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


TABLES = [
    "companies",
    "company_email_templates",
    "company_smtp_overrides",
    "user_company_memberships",
]

# (옛 테이블 이름, 옛 컬럼 이름)
COLUMNS = [
    ("audit_logs", "company_id"),
    ("booking_types", "owner_company_id"),
    ("caldav_tokens", "company_id"),
    ("calendars", "company_id"),
    ("company_email_templates", "company_id"),
    ("company_smtp_overrides", "company_id"),
    ("notifications", "company_id"),
    ("rooms", "company_id"),
    ("user_company_memberships", "company_id"),
    ("webhook_endpoints", "company_id"),
]

# (옛 테이블 이름, 옛 제약 이름)
CONSTRAINTS = [
    ("companies", "companies_pkey"),
    ("company_email_templates", "company_email_templates_pkey"),
    ("company_smtp_overrides", "company_smtp_overrides_pkey"),
    ("user_company_memberships", "user_company_memberships_pkey"),
    ("audit_logs", "audit_logs_company_id_fkey"),
    ("booking_types", "booking_types_owner_company_id_fkey"),
    ("caldav_tokens", "caldav_tokens_company_id_fkey"),
    ("calendars", "calendars_company_id_fkey"),
    ("company_email_templates", "company_email_templates_company_id_fkey"),
    ("company_smtp_overrides", "company_smtp_overrides_company_id_fkey"),
    ("notifications", "notifications_company_id_fkey"),
    ("rooms", "rooms_company_id_fkey"),
    ("user_company_memberships", "user_company_memberships_company_id_fkey"),
    ("user_company_memberships", "user_company_memberships_user_sub_fkey"),
    ("webhook_endpoints", "webhook_endpoints_company_id_fkey"),
]

INDEXES = [
    "ix_audit_company_created",
    "ix_audit_logs_company_id",
    "ix_calendars_company_id",
    "ix_calendars_company_scope",
    "ix_companies_account_workspace_id",
    "ix_rooms_company_id",
    "ix_webhook_endpoints_company_id",
]

# (옛 테이블 이름, 컬럼, 옛 값)
VALUES = [
    ("booking_types", "owner_type", "company"),
    ("audit_logs", "entity_type", "company_membership"),
]


def _new(name: str) -> str:
    return name.replace("companies", "workspaces").replace("company", "workspace")


def _rename(direction: str) -> None:
    fwd = direction == "up"

    def pair(old: str) -> tuple[str, str]:
        return (old, _new(old)) if fwd else (_new(old), old)

    # 1. 테이블 (행 타입도 같이 바뀐다)
    tables = TABLES if fwd else list(reversed(TABLES))
    for old in tables:
        src, dst = pair(old)
        op.rename_table(src, dst)

    # 2. 컬럼 (테이블은 이미 목표 이름)
    for table, col in COLUMNS:
        t = _new(table) if fwd else table
        src, dst = pair(col)
        op.alter_column(t, src, new_column_name=dst)

    # 3. 제약 (PK 는 같은 이름의 인덱스도 같이 바뀐다)
    for table, con in CONSTRAINTS:
        t = _new(table) if fwd else table
        src, dst = pair(con)
        op.execute(f'ALTER TABLE "{t}" RENAME CONSTRAINT "{src}" TO "{dst}"')

    # 4. 인덱스
    for idx in INDEXES:
        src, dst = pair(idx)
        op.execute(f'ALTER INDEX "{src}" RENAME TO "{dst}"')

    # 5. 문자열로 저장된 값
    for table, col, old in VALUES:
        t = _new(table) if fwd else table
        src, dst = pair(old)
        op.execute(sa.text(f'UPDATE "{t}" SET "{col}" = :dst WHERE "{col}" = :src').bindparams(src=src, dst=dst))


def upgrade() -> None:
    """companies → workspaces 이름 변경 (테이블·컬럼·제약·인덱스·저장값)."""
    _rename("up")


def downgrade() -> None:
    """workspaces → companies 로 되돌림."""
    _rename("down")
