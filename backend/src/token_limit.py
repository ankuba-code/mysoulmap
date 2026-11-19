from datetime import datetime, timedelta

from sqlalchemy import func
from sqlmodel import Session, select

from .models_events import UsageEvent

TOKEN_LIMIT = 50_000
TOKEN_WINDOW_DAYS = 30
TOKEN_NOTICE_RATIO = 0.9


def tokens_used(session: Session, ip_address: str, now: datetime) -> int:
    start = now - timedelta(days=TOKEN_WINDOW_DAYS)
    incoming = _column_sum(session, UsageEvent.llm_input_tokens, ip_address, start, now)
    outgoing = _column_sum(session, UsageEvent.llm_output_tokens, ip_address, start, now)
    return incoming + outgoing


def token_limit_reached(used: int) -> bool:
    return used >= TOKEN_LIMIT


def token_notice_for(used: int) -> str | None:
    if used >= int(TOKEN_LIMIT * TOKEN_NOTICE_RATIO):
        return "approaching"
    return None


def _column_sum(session: Session, column, ip_address: str, start: datetime, now: datetime) -> int:
    statement = select(func.coalesce(func.sum(column), 0)).where(
        UsageEvent.ip_address == ip_address,
        UsageEvent.occurred_at >= start,
        UsageEvent.occurred_at <= now,
    )
    value = session.exec(statement).one()
    if isinstance(value, tuple):
        value = value[0]
    return int(value or 0)
