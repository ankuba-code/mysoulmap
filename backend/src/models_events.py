import enum
from datetime import datetime

from sqlalchemy import Column, DateTime, Enum, Index
from sqlmodel import Field, SQLModel


class EventType(str, enum.Enum):
    form_submission = "form_submission"
    result_view = "result_view"
    affiliate_click = "affiliate_click"


class LlmStatus(str, enum.Enum):
    success = "success"
    error = "error"
    fallback = "fallback"


class UsageEvent(SQLModel, table=True):
    __tablename__ = "usage_events"
    __table_args__ = (
        Index("ix_usage_events_occurred_at", "occurred_at"),
        Index("ix_usage_events_event_type", "event_type"),
        Index("ix_usage_events_country_code", "country_code"),
        Index("ix_usage_events_place_id", "place_id"),
        Index("ix_usage_events_llm_status", "llm_status"),
    )

    id: int | None = Field(default=None, primary_key=True)
    event_type: EventType = Field(sa_column=Column(Enum(EventType), nullable=False))
    occurred_at: datetime = Field(sa_column=Column(DateTime(timezone=False), nullable=False))
    ip_address: str = Field(max_length=45)
    country_code: str = Field(max_length=2)
    place_id: str | None = Field(default=None, max_length=20)
    llm_latency_ms: int | None = None
    llm_input_tokens: int | None = None
    llm_output_tokens: int | None = None
    llm_status: LlmStatus | None = Field(
        default=None,
        sa_column=Column(Enum(LlmStatus), nullable=True),
    )
    error_code: str | None = Field(default=None, max_length=50)
