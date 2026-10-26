import asyncio
import logging
import os
import time
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from urllib.parse import parse_qs
from fastapi import FastAPI, Query, Request, Response
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, JSONResponse, RedirectResponse
from pydantic import BaseModel, ConfigDict, ValidationError
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
from .admin_pages import login_page, stats_page
from .atlas import PLACES, Place, filter_places, get_place_by_id
from .chat import run_chat
from .db import get_database_url, get_engine, init_db
from .booking import booking_search_url
from .events import log_affiliate_click, log_chat_events, log_match_events
from .match import MatchRequest, MatchResponse, match_places
from .logging_config import ACCESS_LOGGER, configure_logging
from .models_chat import ChatRequest, ChatResponse
from .models_events import UsageEvent  # noqa: F401
from .purge import run_purge
from .rate_limit import (
    LIMIT_ADMIN_LOGIN,
    LIMIT_ADMIN_STATS,
    LIMIT_CHAT,
    LIMIT_GO,
    LIMIT_MATCH,
    atlas_limit,
    limiter,
)
from .stats import aggregate_stats, default_period

configure_logging()
access_log = logging.getLogger(ACCESS_LOGGER)


@asynccontextmanager
async def lifespan(_app: FastAPI):
    init_db()
    task = None
    if not get_database_url().startswith("sqlite"):
        task = asyncio.create_task(_purge_loop())
    yield
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
    return {"status": "ok", "places_loaded": len(PLACES)}


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
    response = match_places(PLACES, body)
    log_match_events(request)
    return response


@app.post("/chat", response_model=ChatResponse)
@limiter.limit(LIMIT_CHAT)
async def chat(request: Request, body: ChatRequest) -> ChatResponse:
    response, trace = await run_chat(body, PLACES)
    log_chat_events(
        request,
        body,
        response,
        error_code=trace.error_code,
        latency_ms=trace.latency_ms,
        input_tokens=trace.input_tokens,
        output_tokens=trace.output_tokens,
    )
    return response


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
            return HTMLResponse(stats_page(aggregate_stats(session, start, end, raw=raw)))
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
        return aggregate_stats(session, start, end, raw=raw)
