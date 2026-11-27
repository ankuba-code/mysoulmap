import asyncio
import logging
import os
import secrets
import time
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from urllib.parse import parse_qs
from typing import Literal

from fastapi import FastAPI, Query, Request, Response
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, JSONResponse, RedirectResponse
from pydantic import BaseModel, ConfigDict, Field, ValidationError, field_validator
from slowapi.errors import RateLimitExceeded
from sqlmodel import Session

from .envfile import load_local_env

load_local_env()

from .admin_auth import (
    COOKIE_NAME,
    COOKIE_PATH,
    SESSION_MAX_AGE,
    AdminNotConfiguredError,
    create_session_token,
    is_admin_session,
    verify_admin,
)
from .admin_charts import attach_charts
from .admin_pages import login_page, stats_page
from .atlas import PLACES, Place, filter_places, get_place_by_id
from .budget import attach_budget_signal, estimate_chat_tokens, get_book
from .chat import fallback_response, run_chat
from .chat_model import CHAT_MODELS, active_chat_model, set_chat_model
from .model_status import model_reachable
from .llm import flush_langfuse, langfuse_project_url
from .langfuse_metrics import fetch_langfuse_widgets
from .db import database_ok, get_database_url, get_engine, init_db
from .booking import booking_search_url
from .events import (
    client_ip,
    log_affiliate_click,
    log_chat_events,
    log_feedback,
    log_match_events,
    log_rate_limited,
    ui_language_from_header,
)
from .geocode import locate_text
from .geoip import lookup_ip
from .match import MatchRequest, MatchResponse, match_places, q7_lookup_query
from .logging_config import ACCESS_LOGGER, configure_logging
from .models_chat import ChatRequest, ChatResponse
from .models_events import UsageEvent  # noqa: F401
from .models_settings import AppSetting  # noqa: F401
from .purge import run_purge
from .rate_limit import (
    LIMIT_ADMIN_LOGIN,
    LIMIT_ADMIN_STATS,
    LIMIT_CHAT,
    LIMIT_FEEDBACK,
    LIMIT_GEO,
    LIMIT_GO,
    LIMIT_MATCH,
    atlas_limit,
    limiter,
)
from .stats import aggregate_stats, chat_window, default_period, had_recent_llm_success
from .token_limit import token_limit_reached, token_notice_for, tokens_used

configure_logging()
access_log = logging.getLogger(ACCESS_LOGGER)


@asynccontextmanager
async def lifespan(_app: FastAPI):
    init_db()
    task = None
    if not get_database_url().startswith("sqlite"):
        task = asyncio.create_task(_purge_loop())
    yield
    flush_langfuse()
    if task is not None:
        task.cancel()


async def _purge_loop() -> None:
    while True:
        await asyncio.sleep(24 * 60 * 60)
        run_purge()


app = FastAPI(title="Soulmap API", lifespan=lifespan)
app.state.limiter = limiter

def _cors_origins() -> list[str]:
    raw = os.environ.get("CORS_ORIGIN", "https://app.mithertz.online")
    return [origin.strip() for origin in raw.split(",") if origin.strip()]


app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins(),
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)


class AdminLoginRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    username: str
    password: str


def error_payload(code: str, message: str, details: dict | None = None) -> dict:
    return {
        "error": {
            "code": code,
            "message": message,
            "details": details or {},
        }
    }


@app.exception_handler(RequestValidationError)
async def validation_error_handler(_request: Request, exc: RequestValidationError):
    return JSONResponse(
        status_code=422,
        content=error_payload(
            "VALIDATION_ERROR",
            "Die Anfrage ist ungültig.",
            {
                "errors": [
                    {"loc": list(item["loc"]), "type": item["type"]}
                    for item in exc.errors()
                ]
            },
        ),
    )


@app.exception_handler(RateLimitExceeded)
async def rate_limit_handler(request: Request, exc: RateLimitExceeded):
    retry_after = getattr(exc, "retry_after", None) or 60
    access_log.info(
        "rate_limited",
        extra={"method": request.method, "path": request.url.path, "status": 429},
    )
    log_rate_limited(request)
    return JSONResponse(
        status_code=429,
        headers={"Retry-After": str(int(retry_after))},
        content=error_payload(
            "RATE_LIMITED",
            "Zu viele Anfragen. Bitte warte einen Moment.",
        ),
    )


@app.middleware("http")
async def log_request(request: Request, call_next):
    started = time.perf_counter()
    response = await call_next(request)
    access_log.info(
        "request",
        extra={
            "method": request.method,
            "path": request.url.path,
            "status": response.status_code,
            "duration_ms": int((time.perf_counter() - started) * 1000),
        },
    )
    return response


@app.get("/health")
def health():
    db_ok = database_ok()
    places = len(PLACES)
    ok = db_ok and places > 0
    payload = {
        "status": "ok" if ok else "degraded",
        "places_loaded": places,
        "database": "ok" if db_ok else "down",
    }
    if ok:
        return payload
    return JSONResponse(status_code=503, content=payload)


@app.get("/health/signals")
def health_signals(request: Request):
    expected = os.getenv("MONITOR_TOKEN", "")
    provided = request.headers.get("x-monitor-token", "")
    if not expected:
        return JSONResponse(
            status_code=503,
            content=error_payload("MONITOR_NOT_CONFIGURED", "MONITOR_TOKEN fehlt."),
        )
    if not provided or not secrets.compare_digest(provided, expected):
        return JSONResponse(
            status_code=401,
            content=error_payload("UNAUTHORIZED", "Monitoring-Token ungültig."),
        )
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    with Session(get_engine()) as session:
        return attach_budget_signal(chat_window(session, now), now)


@app.get("/geo")
@limiter.limit(LIMIT_GEO)
def geo(request: Request) -> dict[str, str | float | int | None]:
    return lookup_ip(client_ip(request))


@app.get("/language")
@limiter.limit(LIMIT_GEO)
def language(request: Request) -> dict[str, str]:
    # Accept-Language kommt vom Browser und spiegelt die Systemsprache.
    return {"language": ui_language_from_header(request.headers.get("accept-language"))}


@app.get("/atlas/places")
@atlas_limit
def list_places(
    request: Request,
    element: str | None = Query(default=None),
    archetyp: str | None = Query(default=None),
    keyword: str | None = Query(default=None),
) -> dict[str, list[Place]]:
    return {
        "places": filter_places(
            PLACES,
            element=element,
            archetyp=archetyp,
            keyword=keyword,
        )
    }


@app.get("/atlas/places/{place_id}", response_model=Place)
@atlas_limit
def get_place(request: Request, place_id: str):
    place = get_place_by_id(PLACES, place_id)
    if place is None:
        return JSONResponse(
            status_code=404,
            content=error_payload(
                "PLACE_NOT_FOUND",
                "Der angeforderte Atlas-Ort existiert nicht.",
                {"id": place_id},
            ),
        )
    return place


@app.get("/go/{place_id}")
@limiter.limit(LIMIT_GO)
def go_place(request: Request, place_id: str, lang: str | None = Query(default=None)):
    place = get_place_by_id(PLACES, place_id)
    if place is None:
        return JSONResponse(
            status_code=404,
            content=error_payload(
                "PLACE_NOT_FOUND",
                "Der angeforderte Atlas-Ort existiert nicht.",
                {"id": place_id},
            ),
        )
    log_affiliate_click(request, place.id)
    return RedirectResponse(booking_search_url(place, lang), status_code=302)


@app.post("/match", response_model=MatchResponse)
@limiter.limit(LIMIT_MATCH)
def match(request: Request, body: MatchRequest) -> MatchResponse:
    query = q7_lookup_query(body.answers.q7, PLACES)
    located = locate_text(query, language=body.language) if query else None
    response = match_places(PLACES, body, located=located)
    log_match_events(request)
    return response


class FeedbackRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    vote: Literal["like", "dislike"]
    text: str = Field(default="", max_length=500)

    @field_validator("text")
    @classmethod
    def clip_text(cls, value: str) -> str:
        return value.strip()


@app.post("/feedback")
@limiter.limit(LIMIT_FEEDBACK)
def feedback(request: Request, body: FeedbackRequest) -> dict[str, bool]:
    log_feedback(request, body.vote, body.text)
    return {"ok": True}


@app.post("/chat", response_model=ChatResponse)
@limiter.limit(LIMIT_CHAT)
async def chat(request: Request, body: ChatRequest) -> ChatResponse:
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    ip_address = client_ip(request)
    with Session(get_engine()) as session:
        used = tokens_used(session, ip_address, now)
    if token_limit_reached(used):
        return JSONResponse(
            status_code=429,
            content=error_payload(
                "TOKEN_LIMIT",
                "Deine Tokens für SoulMap sind aufgebraucht.",
            ),
        )
    with Session(get_engine()) as session:
        recent_user = had_recent_llm_success(session, ip_address, now)
    reservation = get_book().try_reserve(
        ip=ip_address,
        tokens=estimate_chat_tokens(body),
        now=now,
        recent_user=recent_user,
    )
    if not reservation.ok:
        response = fallback_response(body, PLACES)
        log_chat_events(
            request,
            body,
            response,
            error_code=reservation.code,
            latency_ms=0,
            input_tokens=None,
            output_tokens=None,
        )
        return response
    response, trace = await run_chat(body, PLACES)
    actual = reservation.reserved
    if trace.input_tokens is not None or trace.output_tokens is not None:
        actual = (trace.input_tokens or 0) + (trace.output_tokens or 0)
    get_book().adjust(reservation, actual)
    log_chat_events(
        request,
        body,
        response,
        error_code=trace.error_code,
        latency_ms=trace.latency_ms,
        input_tokens=trace.input_tokens,
        output_tokens=trace.output_tokens,
    )
    added = 0
    if response.source == "llm":
        added = (trace.input_tokens or 0) + (trace.output_tokens or 0)
    response.token_notice = token_notice_for(used + added)
    return response


def _with_langfuse(payload: dict) -> dict:
    url = langfuse_project_url()
    if url:
        payload["langfuse_url"] = url
    widgets = fetch_langfuse_widgets(datetime.now(timezone.utc))
    if widgets is not None:
        payload["langfuse"] = widgets
    return payload


def _is_form_request(request: Request) -> bool:
    content_type = request.headers.get("content-type", "")
    return content_type.startswith("application/x-www-form-urlencoded") or content_type.startswith(
        "multipart/form-data"
    )


def _set_admin_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        COOKIE_NAME,
        token,
        max_age=SESSION_MAX_AGE,
        httponly=True,
        samesite="strict",
        path=COOKIE_PATH,
    )


async def _login_body(request: Request) -> tuple[AdminLoginRequest, bool]:
    if _is_form_request(request):
        parsed = parse_qs((await request.body()).decode("utf-8"), keep_blank_values=True)
        return (
            AdminLoginRequest(
                username=(parsed.get("username") or [""])[0],
                password=(parsed.get("password") or [""])[0],
            ),
            True,
        )
    return AdminLoginRequest.model_validate(await request.json()), False


@app.get("/admin")
@app.get("/admin/login")
def admin_page(request: Request, raw: bool = False):
    if request.url.path == "/admin" and is_admin_session(request.cookies.get(COOKIE_NAME)):
        start, end = default_period(datetime.now(timezone.utc).replace(tzinfo=None))
        with Session(get_engine()) as session:
            payload = _with_langfuse(attach_charts(aggregate_stats(session, start, end, raw=raw)))
            payload["chat_model"] = active_chat_model(session)
            payload["chat_model_reachable"] = model_reachable(payload["chat_model"])
            return HTMLResponse(stats_page(payload))
    return HTMLResponse(login_page())


@app.post("/admin/login")
@limiter.limit(LIMIT_ADMIN_LOGIN)
async def admin_login(request: Request, response: Response):
    html_mode = _is_form_request(request)
    try:
        body, html_mode = await _login_body(request)
    except ValidationError:
        if html_mode:
            return HTMLResponse(login_page("Die Anfrage ist ungültig."), status_code=422)
        return JSONResponse(
            status_code=422,
            content=error_payload("VALIDATION_ERROR", "Die Anfrage ist ungültig."),
        )
    if not verify_admin(body.username, body.password):
        if html_mode:
            return HTMLResponse(login_page("Anmeldung fehlgeschlagen."), status_code=401)
        return JSONResponse(
            status_code=401,
            content=error_payload("UNAUTHORIZED", "Anmeldung fehlgeschlagen."),
        )
    try:
        token = create_session_token()
    except AdminNotConfiguredError:
        if html_mode:
            return HTMLResponse(login_page("Admin ist nicht konfiguriert."), status_code=503)
        return JSONResponse(
            status_code=503,
            content=error_payload("UNAUTHORIZED", "Admin ist nicht konfiguriert."),
        )
    if html_mode:
        redirect = RedirectResponse("/admin", status_code=303)
        _set_admin_cookie(redirect, token)
        return redirect
    _set_admin_cookie(response, token)
    return {"ok": True}


@app.post("/admin/logout")
async def admin_logout(request: Request, response: Response):
    if _is_form_request(request):
        redirect = RedirectResponse("/admin/login", status_code=303)
        redirect.delete_cookie(COOKIE_NAME, path=COOKIE_PATH)
        return redirect
    response.delete_cookie(COOKIE_NAME, path=COOKIE_PATH)
    return {"ok": True}


@app.post("/admin/model")
@limiter.limit(LIMIT_ADMIN_STATS)
async def admin_model(request: Request):
    token = request.cookies.get(COOKIE_NAME)
    if not is_admin_session(token):
        if _is_form_request(request):
            return RedirectResponse("/admin/login", status_code=303)
        return JSONResponse(
            status_code=401,
            content=error_payload("UNAUTHORIZED", "Admin-Anmeldung erforderlich."),
        )
    model_id: str | None
    if _is_form_request(request):
        parsed = parse_qs((await request.body()).decode("utf-8"), keep_blank_values=True)
        model_id = (parsed.get("model") or [""])[0]
        html_mode = True
    else:
        try:
            body = await request.json()
        except Exception:
            body = {}
        raw_model = body.get("model") if isinstance(body, dict) else None
        model_id = raw_model if isinstance(raw_model, str) else None
        html_mode = False
    if model_id not in CHAT_MODELS:
        if html_mode:
            return RedirectResponse("/admin", status_code=303)
        return JSONResponse(
            status_code=422,
            content=error_payload("VALIDATION_ERROR", "Unbekanntes Chat-Modell."),
        )
    with Session(get_engine()) as session:
        selected = set_chat_model(session, model_id)
    reachable = model_reachable(selected)
    if html_mode:
        return RedirectResponse("/admin", status_code=303)
    return {"model": selected, "reachable": reachable}


@app.get("/admin/stats")
@limiter.limit(LIMIT_ADMIN_STATS)
def admin_stats(
    request: Request,
    raw: bool = False,
):
    token = request.cookies.get(COOKIE_NAME)
    if not is_admin_session(token):
        return JSONResponse(
            status_code=401,
            content=error_payload("UNAUTHORIZED", "Admin-Anmeldung erforderlich."),
        )
    start, end = default_period(datetime.now(timezone.utc).replace(tzinfo=None))
    with Session(get_engine()) as session:
        payload = _with_langfuse(attach_charts(aggregate_stats(session, start, end, raw=raw)))
        payload["chat_model"] = active_chat_model(session)
        payload["chat_model_reachable"] = model_reachable(payload["chat_model"])
        return payload
