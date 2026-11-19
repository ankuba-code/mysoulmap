"""widen usage_events.place_id for slug ids

Revision ID: 0005
Revises: 0004
Create Date: 2026-11-06

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0005"
down_revision: Union[str, None] = "0004"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table("usage_events") as batch:
        batch.alter_column(
            "place_id",
            existing_type=sa.String(length=20),
            type_=sa.String(length=40),
            existing_nullable=True,
        )


def downgrade() -> None:
    with op.batch_alter_table("usage_events") as batch:
        batch.alter_column(
            "place_id",
            existing_type=sa.String(length=40),
            type_=sa.String(length=20),
            existing_nullable=True,
        )
