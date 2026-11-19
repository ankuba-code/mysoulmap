from datetime import datetime

from fastapi.testclient import TestClient

from src.alerts import AlertBook, Mail, firing_keys
from src.mail import send_mail
from src.main import app
from src.models_events import EventType, LlmStatus, UsageEvent
from src.stats import summarize_window
from src.watchdog import WatchSettings, probe_once

client = TestClient(app)


def _view(status: LlmStatus | None, code: str | None = None) -> UsageEvent:
    return UsageEvent(
        event_type=EventType.result_view,
        occurred_at=datetime.utcnow(),
        ip_address="1.1.1.1",
        country_code="DE",
        llm_status=status,
        error_code=code,
    )


def test_window_stays_quiet_below_three_chat_turns() -> None:
    report = summarize_window(
        [_view(LlmStatus.fallback, "OPENAI_TIMEOUT"), _view(LlmStatus.fallback, "OPENAI_TIMEOUT")]
    )
    assert report["status"] == "ok"
    assert report["chat_turns"] == 2
    assert report["reasons"] == []


def test_window_flags_fallback_rate_and_ignores_match_views() -> None:
    events = [_view(LlmStatus.fallback, "OPENAI_TIMEOUT") for _ in range(3)]
    events.append(_view(None))
    report = summarize_window(events)
    assert report["chat_turns"] == 3
    assert report["status"] == "degraded"
    assert report["reasons"] == ["fallback_rate"]
    assert report["fallback_by_code"] == {"OPENAI_TIMEOUT": 3}


def test_window_flags_rate_limit_burst() -> None:
    events = [
        UsageEvent(
            event_type=EventType.rate_limited,
            occurred_at=datetime.utcnow(),
            ip_address="1.1.1.1",
            country_code="DE",
            error_code="RATE_LIMITED",
        )
        for _ in range(50)
    ]
    report = summarize_window(events)
    assert report["reasons"] == ["rate_limited"]


def test_health_degraded_when_database_is_down(monkeypatch) -> None:
    monkeypatch.setattr("src.main.database_ok", lambda: False)
    response = client.get("/health")
    assert response.status_code == 503
    assert response.json()["database"] == "down"


def test_signals_require_monitor_token(monkeypatch) -> None:
    monkeypatch.delenv("MONITOR_TOKEN", raising=False)
    missing = client.get("/health/signals")
    assert missing.status_code == 503
    assert missing.json()["error"]["code"] == "MONITOR_NOT_CONFIGURED"

    monkeypatch.setenv("MONITOR_TOKEN", "monitor-test-token")
    rejected = client.get("/health/signals", headers={"X-Monitor-Token": "falsch"})
    assert rejected.status_code == 401
    opened = client.get("/health/signals", headers={"X-Monitor-Token": "monitor-test-token"})
    assert opened.status_code == 200
    assert opened.json()["window_minutes"] == 15
    assert "messages" not in opened.json()


def test_probe_sends_fallback_once_then_recovery() -> None:
    signals = {
        "status": "degraded",
        "window_minutes": 15,
        "chat_turns": 4,
        "fallback_count": 3,
        "fallback_rate": 0.75,
        "error_count": 0,
        "error_rate": 0.0,
        "rate_limited": 0,
        "reasons": ["fallback_rate"],
        "fallback_by_code": {"OPENAI_TIMEOUT": 3},
        "errors_by_code": {},
    }
    sent: list[Mail] = []

    def fetch(url: str, token: str | None = None) -> tuple[int, dict | None]:
        if url.endswith("/health"):
            return 200, {"status": "ok", "places_loaded": 40, "database": "ok"}
        assert token == "monitor-test-token"
        return 200, signals

    settings = WatchSettings(
        health_url="http://api/health",
        signals_url="http://api/health/signals",
        web_url="",
        token="monitor-test-token",
        interval_seconds=60,
        grace_seconds=0,
        cooldown_seconds=3600,
        failure_limit=3,
    )
    book = AlertBook()
    probe_once(
        health_failures=0,
        web_failures=0,
        signals_failures=0,
        book=book,
        now=100,
        started=0,
        settings=settings,
        fetch=fetch,
        send=lambda mail: sent.append(mail) or True,
    )
    assert [mail.key for mail in sent] == ["fallback_rate"]
    assert "OPENAI_TIMEOUT" in sent[0].body
    sent.clear()
    probe_once(
        health_failures=0,
        web_failures=0,
        signals_failures=0,
        book=book,
        now=200,
        started=0,
        settings=settings,
        fetch=fetch,
        send=lambda mail: sent.append(mail) or True,
    )
    assert sent == []

    healthy = {**signals, "status": "ok", "reasons": [], "fallback_count": 0, "fallback_rate": 0.0}

    def fetch_ok(url: str, token: str | None = None) -> tuple[int, dict | None]:
        if url.endswith("/health"):
            return 200, {"status": "ok", "places_loaded": 40}
        return 200, healthy

    probe_once(
        health_failures=0,
        web_failures=0,
        signals_failures=0,
        book=book,
        now=300,
        started=0,
        settings=settings,
        fetch=fetch_ok,
        send=lambda mail: sent.append(mail) or True,
    )
    assert [mail.recovery for mail in sent] == [True]


def test_health_alert_waits_for_grace_and_repeated_failures() -> None:
    sent: list[str] = []

    def fetch(_url: str, _token: str | None = None) -> tuple[int, dict | None]:
        return 0, None

    settings = WatchSettings(
        health_url="http://api/health",
        signals_url="http://api/health/signals",
        web_url="",
        token="",
        interval_seconds=60,
        grace_seconds=120,
        cooldown_seconds=3600,
        failure_limit=3,
    )
    book = AlertBook()
    failures, _web, _signals = probe_once(
        health_failures=2,
        web_failures=0,
        signals_failures=0,
        book=book,
        now=60,
        started=0,
        settings=settings,
        fetch=fetch,
        send=lambda mail: sent.append(mail.key) or True,
    )
    assert failures == 3
    assert sent == []
    probe_once(
        health_failures=failures,
        web_failures=0,
        signals_failures=0,
        book=book,
        now=180,
        started=0,
        settings=settings,
        fetch=fetch,
        send=lambda mail: sent.append(mail.key) or True,
    )
    assert sent == ["health"]


def test_send_mail_defaults_to_alert_inbox(monkeypatch) -> None:
    monkeypatch.setenv("SMTP_HOST", "smtp.example")
    monkeypatch.setenv("SMTP_USER", "alerts@example.com")
    monkeypatch.setenv("SMTP_PASSWORD", "app-password")
    monkeypatch.setenv("ALERT_EMAIL", "alerts@example.com")
    monkeypatch.delenv("SMTP_FROM", raising=False)
    captured: dict[str, str] = {}

    class FakeSMTP:
        def __init__(self, host: str, port: int, timeout: float = 20) -> None:
            captured["host"] = host
            captured["port"] = str(port)

        def __enter__(self) -> "FakeSMTP":
            return self

        def __exit__(self, *_args: object) -> bool:
            return False

        def starttls(self, context: object = None) -> None:
            return None

        def login(self, user: str, password: str) -> None:
            captured["user"] = user
            return None

        def send_message(self, message: object) -> None:
            captured["to"] = message["To"]  # type: ignore[index]
            captured["body"] = message.get_content()  # type: ignore[attr-defined]

    monkeypatch.setattr("src.mail.smtplib.SMTP", FakeSMTP)
    assert send_mail(Mail(key="health", subject="Soulmap", body="API down", recovery=False))
    assert captured["to"] == "alerts@example.com"
    assert captured["host"] == "smtp.example"
    assert "app-password" not in captured["body"]


def test_send_mail_skips_without_password(monkeypatch) -> None:
    monkeypatch.setenv("SMTP_HOST", "smtp.gmail.com")
    monkeypatch.setenv("SMTP_USER", "alerts@example.com")
    monkeypatch.setenv("SMTP_PASSWORD", "")
    assert send_mail(Mail(key="health", subject="s", body="b", recovery=False)) is False


def test_firing_keys_prefers_health_outage() -> None:
    keys = firing_keys(
        health_failures=3,
        web_failures=3,
        signals_failures=2,
        failure_limit=3,
        signals={"reasons": ["fallback_rate"]},
        signals_error="signals_unreachable",
    )
    assert list(keys) == ["health"]
