import json
import logging
import os
import time
import urllib.error
import urllib.request
from collections.abc import Callable
from dataclasses import dataclass

from .alerts import (
    HEALTH_FAILURES_BEFORE_ALERT,
    SUPPRESSED_DURING_GRACE,
    AlertBook,
    Mail,
    firing_keys,
)
from .envfile import load_local_env
from .logging_config import configure_logging
from .mail import send_mail

logger = logging.getLogger("soulmap.watch")

Fetch = Callable[[str, str | None], tuple[int, dict | None]]
Send = Callable[[Mail], bool]


@dataclass(frozen=True)
class WatchSettings:
    health_url: str
    signals_url: str
    web_url: str
    token: str
    interval_seconds: float
    grace_seconds: float
    cooldown_seconds: float
    failure_limit: int

    @classmethod
    def from_env(cls) -> "WatchSettings":
        return cls(
            health_url=os.getenv("HEALTH_URL", "http://127.0.0.1:8000/health"),
            signals_url=os.getenv("SIGNALS_URL", "http://127.0.0.1:8000/health/signals"),
            web_url=os.getenv("WEB_URL", ""),
            token=os.getenv("MONITOR_TOKEN", ""),
            interval_seconds=float(os.getenv("WATCH_INTERVAL_SECONDS", "60") or "60"),
            grace_seconds=float(os.getenv("WATCH_GRACE_SECONDS", "120") or "120"),
            cooldown_seconds=float(os.getenv("ALERT_COOLDOWN_SECONDS", "3600") or "3600"),
            failure_limit=HEALTH_FAILURES_BEFORE_ALERT,
        )


def fetch_url(url: str, token: str | None = None, timeout: float = 5) -> tuple[int, dict | None]:
    request = urllib.request.Request(url)
    if token:
        request.add_header("X-Monitor-Token", token)
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            return response.status, _json_dict(response.read())
    except urllib.error.HTTPError as exc:
        return exc.code, _json_dict(exc.read())
    except Exception as exc:
        logger.error("watch_fetch_failed url=%s error=%s", url, type(exc).__name__)
        return 0, None


def _json_dict(raw: bytes) -> dict | None:
    try:
        payload = json.loads(raw.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError):
        return None
    if isinstance(payload, dict):
        return payload
    return None


def _health_ok(status: int, body: dict | None) -> bool:
    if status != 200 or not body:
        return False
    return body.get("status") == "ok" and int(body.get("places_loaded") or 0) > 0


def probe_once(
    *,
    health_failures: int,
    web_failures: int,
    signals_failures: int,
    book: AlertBook,
    now: float,
    started: float,
    settings: WatchSettings,
    fetch: Fetch,
    send: Send,
) -> tuple[int, int, int]:
    status, body = fetch(settings.health_url, None)
    health_ok = _health_ok(status, body)
    health_failures = 0 if health_ok else health_failures + 1

    web_ok = True
    if settings.web_url:
        web_status, _web_body = fetch(settings.web_url, None)
        web_ok = web_status == 200
    web_failures = 0 if web_ok else web_failures + 1

    signals: dict | None = None
    signals_error: str | None = None
    if health_ok:
        sig_status, sig_body = fetch(settings.signals_url, settings.token or None)
        if sig_status == 200 and sig_body is not None:
            signals = sig_body
            signals_failures = 0
        else:
            signals_failures += 1
            if sig_status == 503:
                signals_error = "monitor_not_configured"
            elif sig_status == 401:
                signals_error = "monitor_unauthorized"
            else:
                signals_error = "signals_unreachable"
    else:
        signals_failures = 0

    firing = firing_keys(
        health_failures=health_failures,
        web_failures=web_failures,
        signals_failures=signals_failures,
        failure_limit=settings.failure_limit,
        signals=signals,
        signals_error=signals_error,
    )
    if now - started < settings.grace_seconds:
        firing = {key: text for key, text in firing.items() if key not in SUPPRESSED_DURING_GRACE}

    signal_state = "down" if not health_ok else (signals.get("status") if signals else signals_error)
    logger.info(
        "watch_probe health_ok=%s web_ok=%s signals=%s",
        health_ok,
        web_ok,
        signal_state,
    )
    for mail in book.plan(firing, now, settings.cooldown_seconds):
        if send(mail):
            book.commit(mail, now)
    return health_failures, web_failures, signals_failures


def main() -> None:
    load_local_env()
    configure_logging()
    settings = WatchSettings.from_env()
    book = AlertBook()
    started = time.monotonic()
    health_failures = 0
    web_failures = 0
    signals_failures = 0
    logger.info("watch_started")
    while True:
        health_failures, web_failures, signals_failures = probe_once(
            health_failures=health_failures,
            web_failures=web_failures,
            signals_failures=signals_failures,
            book=book,
            now=time.monotonic(),
            started=started,
            settings=settings,
            fetch=fetch_url,
            send=send_mail,
        )
        time.sleep(settings.interval_seconds)


if __name__ == "__main__":
    main()
