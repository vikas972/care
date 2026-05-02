"""support phone OTP users + link Google calendar

Revision ID: 004
Revises: 003
Create Date: 2026-04-25

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "004"
down_revision: Union[str, None] = "003"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Allow users without Google login (phone OTP)
    op.alter_column("users", "email", existing_type=sa.String(length=320), nullable=True)
    op.alter_column(
        "users", "google_sub", existing_type=sa.String(length=255), nullable=True
    )

    op.add_column("users", sa.Column("firebase_uid", sa.String(length=255), nullable=True))
    op.create_index(op.f("ix_users_firebase_uid"), "users", ["firebase_uid"], unique=True)


def downgrade() -> None:
    op.drop_index(op.f("ix_users_firebase_uid"), table_name="users")
    op.drop_column("users", "firebase_uid")

    op.alter_column("users", "google_sub", existing_type=sa.String(length=255), nullable=False)
    op.alter_column("users", "email", existing_type=sa.String(length=320), nullable=False)

