import logging
from datetime import datetime, timezone

from fastapi import Request
from sqlmodel import Session

from .db import get_engine
from .geoip import country_code_for_ip
from .models_chat import ChatRequest, ChatResponse
from .models_events import EventType, LlmStatus, UsageEvent

logger = logging.getLogger("soulmap.events")


def client_ip(request: Request) -> str:
    # Uvicorn übernimmt X-Forwarded-For nur von erlaubten Proxies
    # (--forwarded-allow-ips). Ein direkt gesetzter Header bleibt hier ungenutzt.
    if request.client and request.client.host:
        return request.client.host
    return "0.0.0.0"


def is_form_submission(body: ChatRequest) -> bool:
    if body.from_ritual:
        return False
    return not any(message.role == "assistant" for message in body.messages)


def _now() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def log_match_events(request: Request) -> None:
    ip_address = client_ip(request)
    country_code = country_code_for_ip(ip_address)
    write_event(
        event_type=EventType.form_submission,
        ip_address=ip_address,
        country_code=country_code,
    )
    write_event(
        event_type=EventType.result_view,
        ip_address=ip_address,
        country_code=country_code,
    )


def log_affiliate_click(request: Request, place_id: str) -> None:
    ip_address = client_ip(request)
    write_event(
        event_type=EventType.affiliate_click,
        ip_address=ip_address,
        country_code=country_code_for_ip(ip_address),
        place_id=place_id,
    )


def write_event(**kwargs: object) -> None:
    event = UsageEvent(occurred_at=_now(), **kwargs)
    try:
        with Session(get_engine()) as session:
            session.add(event)
            session.commit()
    except Exception:
        logger.exception("event_write_failed")


def log_chat_events(
    request: Request,
    body: ChatRequest,
    response: ChatResponse,
    *,
    error_code: str | None,
    latency_ms: int | None,
    input_tokens: int | None,
    output_tokens: int | None,
) -> None:
    ip_address = client_ip(request)
    country_code = country_code_for_ip(ip_address)
    if is_form_submission(body):
        write_event(
            event_type=EventType.form_submission,
            ip_address=ip_address,
            country_code=country_code,
        )

    has_place = bool(response.recommended_places)
    is_error_without_place = (
        not has_place and error_code is not None and response.source == "fallback"
    )
    if not has_place and not is_error_without_place:
        return

    if response.source == "llm":
        status = LlmStatus.success
        tokens_in = input_tokens
        tokens_out = output_tokens
        code = None
    elif has_place:
        status = LlmStatus.fallback
        tokens_in = None
        tokens_out = None
        code = error_code
    else:
        status = LlmStatus.error
        tokens_in = None
        tokens_out = None
        code = error_code

    write_event(
        event_type=EventType.result_view,
        ip_address=ip_address,
        country_code=country_code,
        llm_latency_ms=latency_ms,
        llm_input_tokens=tokens_in if status == LlmStatus.success else None,
        llm_output_tokens=tokens_out if status == LlmStatus.success else None,
        llm_status=status,
        error_code=code,
    )
