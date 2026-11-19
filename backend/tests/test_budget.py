from datetime import datetime, timezone

from fastapi.testclient import TestClient
from sqlmodel import Session, select

from src.alerts import describe
from src.budget import MemoryBudget, current_limits, reset_budget, subnet_of
from src.db import get_engine
from src.main import app
from src.models_chat import LlmOutput
from src.models_events import EventType, LlmStatus, UsageEvent
from src.stats import POWER_USER_SHARE, summarize_day
from tests.conftest import TEST_ADMIN_PASSWORD

client = TestClient(app)
NOW = datetime(2026, 11, 10, 15, 4, 0)


def _limits(monkeypatch, *, daily: int = 100_000, hourly: int = 100, calls: int = 30) -> MemoryBudget:
    monkeypatch.setenv("GLOBAL_DAILY_TOKEN_LIMIT", str(daily))
    monkeypatch.setenv("GLOBAL_HOURLY_TOKEN_LIMIT", str(hourly))
    monkeypatch.setenv("GLOBAL_LLM_CALLS_PER_MINUTE", str(calls))
    monkeypatch.delenv("REDIS_URL", raising=False)
    reset_budget()
    book = MemoryBudget()
    return book


def test_subnet_is_a_slash_24_or_slash_48() -> None:
    assert subnet_of("10.1.2.9") == "10.1.2.0/24"
    assert subnet_of("2001:db8:abcd::1") == "2001:db8:abcd::/48"
    assert subnet_of("testclient") == "unknown"


def test_same_subnet_shares_ten_percent_of_the_hour(monkeypatch) -> None:
    book = _limits(monkeypatch, hourly=100)
    assert current_limits().hourly == 100
    first = book.try_reserve(ip="10.0.0.1", tokens=6, now=NOW, recent_user=False)
    second = book.try_reserve(ip="10.0.0.9", tokens=6, now=NOW, recent_user=False)
    other = book.try_reserve(ip="10.1.0.1", tokens=6, now=NOW, recent_user=False)
    assert first.ok is True
    assert second.ok is False
    assert second.code == "SUBNET_LIMIT"
    assert other.ok is True


def test_fresh_ip_stops_at_eighty_percent_of_the_hour(monkeypatch) -> None:
    book = _limits(monkeypatch, hourly=100)
    for index in range(8):
        reserved = book.try_reserve(ip=f"10.{index}.0.1", tokens=10, now=NOW, recent_user=False)
        assert reserved.ok is True
    blocked = book.try_reserve(ip="11.0.0.1", tokens=1, now=NOW, recent_user=False)
    allowed = book.try_reserve(ip="11.1.0.1", tokens=10, now=NOW, recent_user=True)
    overflow = book.try_reserve(ip="11.2.0.1", tokens=15, now=NOW, recent_user=True)
    assert blocked.code == "HOURLY_TIGHT"
    assert allowed.ok is True
    assert overflow.code == "GLOBAL_TOKEN_LIMIT"


def test_adjust_releases_the_unused_reserve(monkeypatch) -> None:
    book = _limits(monkeypatch, hourly=8000)
    reservation = book.try_reserve(ip="10.4.0.1", tokens=800, now=NOW, recent_user=False)
    book.adjust(reservation, 42)
    assert book.snapshot(NOW)["hourly_reserved"] == 42


def test_call_rate_counts_every_ip(monkeypatch) -> None:
    book = _limits(monkeypatch, calls=2, hourly=10_000)
    assert book.try_reserve(ip="10.5.0.1", tokens=10, now=NOW, recent_user=False).ok is True
    assert book.try_reserve(ip="10.6.0.1", tokens=10, now=NOW, recent_user=False).ok is True
    blocked = book.try_reserve(ip="10.7.0.1", tokens=10, now=NOW, recent_user=False)
    assert blocked.code == "CALL_RATE"


def test_daily_trace_marks_power_users_and_keeps_the_hour() -> None:
    heavy = UsageEvent(
        event_type=EventType.result_view,
        occurred_at=NOW,
        ip_address="10.8.0.4",
        country_code="DE",
        llm_input_tokens=50,
        llm_output_tokens=0,
        llm_status=LlmStatus.success,
    )
    light = UsageEvent(
        event_type=EventType.result_view,
        occurred_at=NOW.replace(hour=9),
        ip_address="10.9.0.4",
        country_code="DE",
        llm_input_tokens=10,
        llm_output_tokens=0,
        llm_status=LlmStatus.success,
    )
    trace = summarize_day([heavy, light], NOW.replace(hour=0), daily_limit=1000)
    assert trace["tokens_used"] == 60
    assert trace["hours"][15]["tokens"] == 50
    assert trace["hours"][9]["tokens"] == 10
    assert trace["power_users"] == ["10.8.0.4"]
    assert trace["users"][0]["subnet"] == "10.8.0.0/24"
    assert trace["users"][0]["share"] >= POWER_USER_SHARE
    assert trace["users"][1]["power_user"] is False


def test_chat_uses_fallback_when_the_hour_cannot_hold_the_reserve(monkeypatch) -> None:
    called = {"llm": False}

    async def fake_llm(**_kwargs: object) -> LlmOutput:
        called["llm"] = True
        return LlmOutput(message="Nein.", place_ids=["machu_picchu_pe"])

    monkeypatch.setenv("GLOBAL_HOURLY_TOKEN_LIMIT", "10")
    monkeypatch.delenv("REDIS_URL", raising=False)
    reset_budget()
    monkeypatch.setattr("src.chat.complete_llm", fake_llm)
    response = client.post(
        "/chat",
        json={"messages": [{"role": "user", "content": "Meer"}], "language": "de"},
    )
    assert response.status_code == 200
    assert response.json()["source"] == "fallback"
    assert called["llm"] is False
    with Session(get_engine()) as session:
        event = session.exec(
            select(UsageEvent).where(UsageEvent.error_code == "GLOBAL_TOKEN_LIMIT")
        ).first()
    assert event is not None


def test_chat_keeps_only_the_tokens_the_model_reported(monkeypatch) -> None:
    async def fake_llm(**_kwargs: object) -> LlmOutput:
        return LlmOutput(message="Machu Picchu.", place_ids=["machu_picchu_pe"])

    monkeypatch.delenv("REDIS_URL", raising=False)
    reset_budget()
    monkeypatch.setattr("src.chat.complete_llm", fake_llm)
    monkeypatch.setattr(
        "src.chat.pop_llm_usage",
        lambda: {"input_tokens": 30, "output_tokens": 12},
    )
    response = client.post(
        "/chat",
        json={"messages": [{"role": "user", "content": "Meer"}], "language": "de"},
    )
    assert response.status_code == 200
    assert response.json()["source"] == "llm"
    from src.budget import get_book

    assert get_book().snapshot(datetime.now(timezone.utc).replace(tzinfo=None))["daily_reserved"] == 42


def test_admin_shows_the_daily_trace(monkeypatch) -> None:
    monkeypatch.setenv("GLOBAL_DAILY_TOKEN_LIMIT", "1000")
    now = datetime.now(timezone.utc).replace(tzinfo=None, microsecond=0)
    with Session(get_engine()) as session:
        for event in session.exec(select(UsageEvent)).all():
            session.delete(event)
        session.add(
            UsageEvent(
                event_type=EventType.result_view,
                occurred_at=now,
                ip_address="203.0.113.10",
                country_code="DE",
                llm_input_tokens=400,
                llm_output_tokens=0,
                llm_status=LlmStatus.success,
            )
        )
        session.commit()
    client.cookies.clear()
    assert client.post(
        "/admin/login",
        json={"username": "aku", "password": TEST_ADMIN_PASSWORD},
    ).status_code == 200
    page = client.get("/admin")
    body = client.get("/admin/stats").json()
    assert page.status_code == 200
    assert "Tagesbudget" in page.text
    assert "Power-User" in page.text
    assert "203.0.113.10" in page.text
    assert body["daily_trace"]["power_users"] == ["203.0.113.10"]
    assert body["daily_trace"]["hours"][now.hour]["tokens"] == 400


def test_budget_mail_names_the_reserved_share() -> None:
    text = describe(
        "hourly_tokens",
        {"budget": {"hourly_ratio": 0.8, "hourly_reserved": 80, "hourly_limit": 100}},
    )
    assert "80" in text
    assert "100" in text
