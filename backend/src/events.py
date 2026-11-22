import logging
import re
from datetime import datetime, timezone

from fastapi import Request
from sqlmodel import Session

from .db import get_engine
from .geoip import country_code_for_ip
from .models_chat import ChatRequest, ChatResponse
from .models_events import EventType, LlmStatus, UsageEvent

logger = logging.getLogger("soulmap.events")

PROMPT_EXCERPT_LENGTH = 500
_LANGUAGE = re.compile(r"^[A-Za-z]{2,3}$")
_REGION = re.compile(r"^[A-Za-z]{2}$")


def client_ip(request: Request) -> str:
    # Uvicorn übernimmt X-Forwarded-For nur von erlaubten Proxies
    # (--forwarded-allow-ips). Ein direkt gesetzter Header bleibt hier ungenutzt.
    if request.client and request.client.host:
        return request.client.host
    return "0.0.0.0"


UI_LANGUAGES = frozenset({"de", "en", "es", "ru"})


def ui_language_from_header(header: str | None) -> str:
    """Oberflächensprache aus der primären Systemsprache. Unbekannt bleibt Deutsch."""
    tag = os_language_from_header(header)
    if not tag:
        return "de"
    language = tag.split("-", 1)[0]
    if language in UI_LANGUAGES:
        return language
    return "de"


def os_language_from_header(header: str | None) -> str | None:
    """Primäre Sprache aus Accept-Language, zum Beispiel de-DE. Nicht der ganze Header."""
    if not header:
        return None
    primary = header.split(",", 1)[0].split(";", 1)[0].strip()
    if not primary or primary == "*":
        return None
    language: str | None = None
    region: str | None = None
    for subtag in primary.split("-"):
        if language is None:
            if not _LANGUAGE.fullmatch(subtag):
                return None
            language = subtag.lower()
            continue
        if _REGION.fullmatch(subtag) and region is None:
            region = subtag.upper()
            break
    if language is None:
        return None
    if region:
        return f"{language}-{region}"
    return language


def client_context(request: Request) -> dict[str, str | None]:
    ip_address = client_ip(request)
    return {
        "ip_address": ip_address,
        "country_code": country_code_for_ip(ip_address),
        "os_language": os_language_from_header(request.headers.get("accept-language")),
    }


def is_form_submission(body: ChatRequest) -> bool:
    if body.from_ritual:
        return False
    return not any(message.role == "assistant" for message in body.messages)


def prompt_excerpt(body: ChatRequest) -> str | None:
    """Letzte Nutzernachricht, gekürzt. Kein Verlauf und keine Assistentenantwort."""
    last = ""
    for message in body.messages:
        if message.role == "user":
            last = message.content.strip()
    if not last:
        return None
    return last[:PROMPT_EXCERPT_LENGTH]


def _now() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def log_match_events(request: Request) -> None:
    context = client_context(request)
    write_event(event_type=EventType.form_submission, **context)
    write_event(event_type=EventType.result_view, **context)


def log_affiliate_click(request: Request, place_id: str) -> None:
    write_event(
        event_type=EventType.affiliate_click,
        place_id=place_id,
        **client_context(request),
    )


def log_rate_limited(request: Request) -> None:
    write_event(
        event_type=EventType.rate_limited,
        error_code="RATE_LIMITED",
        **client_context(request),
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
    context = client_context(request)
    if is_form_submission(body):
        write_event(event_type=EventType.form_submission, **context)

    has_place = bool(response.recommended_places)
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
        llm_latency_ms=latency_ms,
        llm_input_tokens=tokens_in if status == LlmStatus.success else None,
        llm_output_tokens=tokens_out if status == LlmStatus.success else None,
        llm_status=status,
        error_code=code,
        user_prompt=prompt_excerpt(body),
        **context,
    )
