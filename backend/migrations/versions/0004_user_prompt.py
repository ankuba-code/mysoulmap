"""add user_prompt excerpt to usage_events

Revision ID: 0004
Revises: 0003
Create Date: 2026-11-05

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0004"
down_revision: Union[str, None] = "0003"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("usage_events", sa.Column("user_prompt", sa.String(length=500), nullable=True))


def downgrade() -> None:
    op.drop_column("usage_events", "user_prompt")
