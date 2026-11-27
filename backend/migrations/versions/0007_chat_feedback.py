"""add chat feedback to usage_events

Revision ID: 0007
Revises: 0006
Create Date: 2026-11-27

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0007"
down_revision: Union[str, None] = "0006"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("usage_events", sa.Column("feedback_vote", sa.String(length=8), nullable=True))
    op.add_column("usage_events", sa.Column("feedback_text", sa.String(length=500), nullable=True))
    op.execute(
        "ALTER TABLE usage_events MODIFY event_type "
        "ENUM('form_submission', 'result_view', 'affiliate_click', 'rate_limited', 'chat_feedback') NOT NULL"
    )


def downgrade() -> None:
    op.execute(
        "ALTER TABLE usage_events MODIFY event_type "
        "ENUM('form_submission', 'result_view', 'affiliate_click', 'rate_limited') NOT NULL"
    )
    op.drop_column("usage_events", "feedback_text")
    op.drop_column("usage_events", "feedback_vote")
