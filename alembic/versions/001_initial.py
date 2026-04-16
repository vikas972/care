"""initial schema

Revision ID: 001
Revises:
Create Date: 2026-04-12

Note: Do not call Enum.create() and also use the same Enum in create_table —
PostgreSQL would run CREATE TYPE twice and fail. Types are created when the
first table that references each ENUM is created.

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("email", sa.String(length=320), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=True),
        sa.Column("google_sub", sa.String(length=255), nullable=False),
        sa.Column("phone_number_encrypted", sa.Text(), nullable=True),
        sa.Column("google_refresh_token_encrypted", sa.Text(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_users_email"), "users", ["email"], unique=True)
    op.create_index(op.f("ix_users_google_sub"), "users", ["google_sub"], unique=True)

    reminder_status = postgresql.ENUM(
        "pending",
        "completed",
        "failed",
        "skipped",
        "cancelled",
        name="reminderstatus",
        create_type=True,
    )
    medicine_frequency = postgresql.ENUM("daily", "weekly", name="medicinefrequency", create_type=True)
    call_type = postgresql.ENUM("event", "medicine", name="calltype", create_type=True)

    op.create_table(
        "calendar_events",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("provider_event_id", sa.String(length=512), nullable=False),
        sa.Column("title", sa.String(length=1024), nullable=True),
        sa.Column("start_time", sa.DateTime(timezone=True), nullable=False),
        sa.Column("reminder_time", sa.DateTime(timezone=True), nullable=False),
        sa.Column("status", reminder_status, nullable=False),
        sa.Column("celery_task_id", sa.String(length=255), nullable=True),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "provider_event_id", name="uq_user_provider_event"),
    )
    op.create_index(op.f("ix_calendar_events_reminder_time"), "calendar_events", ["reminder_time"], unique=False)
    op.create_index(op.f("ix_calendar_events_status"), "calendar_events", ["status"], unique=False)
    op.create_index(op.f("ix_calendar_events_user_id"), "calendar_events", ["user_id"], unique=False)

    op.create_table(
        "medicine_reminders",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("medicine_name", sa.String(length=512), nullable=False),
        sa.Column("schedule_time", sa.Time(), nullable=False),
        sa.Column("frequency", medicine_frequency, nullable=False),
        sa.Column("day_of_week", sa.Integer(), nullable=True),
        sa.Column("target_phone_encrypted", sa.Text(), nullable=False),
        sa.Column("next_fire_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column("celery_task_id", sa.String(length=255), nullable=True),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_medicine_reminders_next_fire_at"), "medicine_reminders", ["next_fire_at"], unique=False)
    op.create_index(op.f("ix_medicine_reminders_status"), "medicine_reminders", ["status"], unique=False)
    op.create_index(op.f("ix_medicine_reminders_user_id"), "medicine_reminders", ["user_id"], unique=False)

    op.create_table(
        "call_logs",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("type", call_type, nullable=False),
        sa.Column("reference_id", sa.Integer(), nullable=False),
        sa.Column("provider", sa.String(length=64), nullable=False),
        sa.Column("provider_call_sid", sa.String(length=255), nullable=True),
        sa.Column("status", sa.String(length=64), nullable=False),
        sa.Column("retries", sa.Integer(), nullable=False),
        sa.Column("dtmf_digit", sa.String(length=8), nullable=True),
        sa.Column("raw_payload", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_call_logs_provider_call_sid"), "call_logs", ["provider_call_sid"], unique=False)
    op.create_index(op.f("ix_call_logs_user_id"), "call_logs", ["user_id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_call_logs_user_id"), table_name="call_logs")
    op.drop_index(op.f("ix_call_logs_provider_call_sid"), table_name="call_logs")
    op.drop_table("call_logs")
    op.drop_index(op.f("ix_medicine_reminders_user_id"), table_name="medicine_reminders")
    op.drop_index(op.f("ix_medicine_reminders_status"), table_name="medicine_reminders")
    op.drop_index(op.f("ix_medicine_reminders_next_fire_at"), table_name="medicine_reminders")
    op.drop_table("medicine_reminders")
    op.drop_index(op.f("ix_calendar_events_user_id"), table_name="calendar_events")
    op.drop_index(op.f("ix_calendar_events_status"), table_name="calendar_events")
    op.drop_index(op.f("ix_calendar_events_reminder_time"), table_name="calendar_events")
    op.drop_table("calendar_events")
    op.drop_index(op.f("ix_users_google_sub"), table_name="users")
    op.drop_index(op.f("ix_users_email"), table_name="users")
    op.drop_table("users")
    postgresql.ENUM(name="calltype").drop(op.get_bind(), checkfirst=True)
    postgresql.ENUM(name="medicinefrequency").drop(op.get_bind(), checkfirst=True)
    postgresql.ENUM(name="reminderstatus").drop(op.get_bind(), checkfirst=True)
