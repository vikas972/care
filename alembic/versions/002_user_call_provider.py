"""user call_provider for Exotel vs Twilio

Revision ID: 002
Revises: 001
Create Date: 2026-04-13

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "002"
down_revision: Union[str, None] = "001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("call_provider", sa.String(length=32), nullable=False, server_default="exotel"),
    )
    op.alter_column("users", "call_provider", server_default=None)


def downgrade() -> None:
    op.drop_column("users", "call_provider")
