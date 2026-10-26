"""create usage_events

Revision ID: 0001
Revises:
Create Date: 2026-09-25

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "usage_events",
        sa.Column("id", sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column(
            "event_type",
            sa.Enum("form_submission", "result_view", "affiliate_click", name="eventtype"),
            nullable=False,
        ),
        sa.Column("occurred_at", sa.DateTime(), nullable=False),
        sa.Column("ip_address", sa.String(length=45), nullable=False),
        sa.Column("country_code", sa.CHAR(length=2), nullable=False),
        sa.Column("place_id", sa.String(length=20), nullable=True),
        sa.Column("llm_latency_ms", sa.Integer(), nullable=True),
        sa.Column("llm_input_tokens", sa.Integer(), nullable=True),
        sa.Column("llm_output_tokens", sa.Integer(), nullable=True),
        sa.Column(
            "llm_status",
            sa.Enum("success", "error", "fallback", name="llmstatus"),
            nullable=True,
        ),
        sa.Column("error_code", sa.String(length=50), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_usage_events_occurred_at", "usage_events", ["occurred_at"])
    op.create_index("ix_usage_events_event_type", "usage_events", ["event_type"])
    op.create_index("ix_usage_events_country_code", "usage_events", ["country_code"])
    op.create_index("ix_usage_events_place_id", "usage_events", ["place_id"])
    op.create_index("ix_usage_events_llm_status", "usage_events", ["llm_status"])


def downgrade() -> None:
    op.drop_index("ix_usage_events_llm_status", table_name="usage_events")
    op.drop_index("ix_usage_events_place_id", table_name="usage_events")
    op.drop_index("ix_usage_events_country_code", table_name="usage_events")
    op.drop_index("ix_usage_events_event_type", table_name="usage_events")
    op.drop_index("ix_usage_events_occurred_at", table_name="usage_events")
    op.drop_table("usage_events")
    sa.Enum(name="eventtype").drop(op.get_bind(), checkfirst=True)
    sa.Enum(name="llmstatus").drop(op.get_bind(), checkfirst=True)
