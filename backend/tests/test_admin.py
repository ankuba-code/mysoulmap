from datetime import datetime, timedelta

from fastapi.testclient import TestClient
from sqlmodel import Session, select

from src.admin_auth import decode_password_hash
from src.db import get_engine
from src.main import app
from src.models_events import EventType, LlmStatus, UsageEvent
from src.stats import purge_old_events
from tests.conftest import TEST_ADMIN_PASSWORD

client = TestClient(app)


def _login(password: str = TEST_ADMIN_PASSWORD):
    return client.post(
        "/admin/login",
        json={"username": "aku", "password": password},
    )


def _seed_events() -> None:
    now = datetime.utcnow()
    rows = [
        UsageEvent(
            event_type=EventType.form_submission,
            occurred_at=now,
            ip_address="1.1.1.1",
            country_code="DE",
        ),
        UsageEvent(
            event_type=EventType.result_view,
            occurred_at=now,
            ip_address="1.1.1.1",
            country_code="DE",
            llm_latency_ms=1200,
            llm_input_tokens=10,
            llm_output_tokens=20,
            llm_status=LlmStatus.success,
        ),
        UsageEvent(
            event_type=EventType.result_view,
            occurred_at=now,
            ip_address="2.2.2.2",
            country_code="AT",
            llm_status=LlmStatus.fallback,
            error_code="OPENAI_TIMEOUT",
        ),
        UsageEvent(
            event_type=EventType.affiliate_click,
            occurred_at=now,
            ip_address="1.1.1.1",
            country_code="DE",
            place_id="mp",
        ),
    ]
    with Session(get_engine()) as session:
        for existing in session.exec(select(UsageEvent)).all():
            session.delete(existing)
        for event in rows:
            session.add(event)
        session.commit()


def test_decode_password_hash_accepts_hex() -> None:
    raw = b"$2b$12$abcdefghijklmnopqrstuv"
    encoded = raw.hex()
    assert "$" not in encoded
    assert "." not in encoded
    assert decode_password_hash(encoded) == raw
    assert decode_password_hash(raw.decode()) == raw


def test_login_aku_sets_httponly_cookie() -> None:
    response = _login()
    assert response.status_code == 200
    assert response.json() == {"ok": True}
    cookie = response.cookies.get("soulmap_admin")
    assert cookie
    header = response.headers.get("set-cookie", "")
    assert "HttpOnly" in header or "httponly" in header.lower()


def test_login_rejects_wrong_password() -> None:
    response = _login("falsch")
    assert response.status_code == 401
    assert response.json()["error"]["code"] == "UNAUTHORIZED"


def test_browser_login_page_accepts_get() -> None:
    client.cookies.clear()
    response = client.get("/admin/login")
    assert response.status_code == 200
    assert "text/html" in response.headers.get("content-type", "")
    assert 'name="password"' in response.text
    assert client.get("/admin").status_code == 200


def test_form_login_opens_dashboard() -> None:
    client.cookies.clear()
    response = client.post(
        "/admin/login",
        data={"username": "aku", "password": TEST_ADMIN_PASSWORD},
        follow_redirects=False,
    )
    assert response.status_code == 303
    assert response.headers.get("location") == "/admin"
    dashboard = client.get("/admin")
    assert dashboard.status_code == 200
    assert "Statistik" in dashboard.text
    assert "15 Minuten" in dashboard.text


def test_stats_requires_session() -> None:
    client.cookies.clear()
    response = client.get("/admin/stats")
    assert response.status_code == 401


def test_stats_returns_aggregates_and_fallback_rate() -> None:
    client.cookies.clear()
    assert _login().status_code == 200
    _seed_events()
    response = client.get("/admin/stats")
    assert response.status_code == 200
    body = response.json()
    assert body["form_submissions"] == 1
    assert body["result_views"] == 2
    assert body["affiliate_clicks"] == 1
    assert body["llm_monitoring"]["fallback_rate"] == 0.5
    assert body["llm_monitoring"]["fallback_by_code"] == {"OPENAI_TIMEOUT": 1}
    assert body["llm_monitoring"]["window_15m"]["chat_turns"] == 2
    assert body["llm_monitoring"]["window_15m"]["status"] == "ok"
    assert body["top_clicked_places"] == [{"place_id": "mp", "clicks": 1}]
    assert body["daily"]
    assert body["daily"][0]["form_submissions"] == 1
    assert "events" not in body
    report = body["monthly_report"]
    assert report["token_limit"] == 50000
    user = next(item for item in report["users"] if item["ip_address"] == "1.1.1.1")
    assert user["tokens_used"] == 30
    page = client.get("/admin")
    assert "Monatsreport" in page.text
    assert "Themen" in page.text
    assert body["charts"]["world"].startswith("data:image/png;base64,")
    assert "Weltkarte" in page.text
    assert page.text.count("<img") >= 4


def test_stats_raw_includes_ip() -> None:
    client.cookies.clear()
    assert _login().status_code == 200
    _seed_events()
    response = client.get("/admin/stats", params={"raw": True})
    assert response.status_code == 200
    events = response.json()["events"]
    assert events
    assert any(item["ip_address"] == "1.1.1.1" for item in events)
    assert all("user_prompt" in item for item in events)


def test_admin_switches_chat_model() -> None:
    client.cookies.clear()
    denied = client.post("/admin/model", json={"model": "claude-haiku-5-5"})
    assert denied.status_code == 401
    assert _login().status_code == 200
    switched = client.post("/admin/model", json={"model": "claude-haiku-5-5"})
    assert switched.status_code == 200
    assert switched.json()["model"] == "claude-haiku-5-5"
    assert switched.json()["reachable"] is False
    stats = client.get("/admin/stats")
    assert stats.json()["chat_model"] == "claude-haiku-5-5"
    page = client.get("/admin")
    assert "Claude Haiku 5.5" in page.text
    assert 'title="nicht erreichbar"' in page.text
    assert stats.json()["chat_model_reachable"] is False
    assert 'value="gpt-5-mini"' in page.text
    unknown = client.post("/admin/model", json={"model": "other"})
    assert unknown.status_code == 422
    client.post("/admin/model", json={"model": "gpt-5-mini"})


def test_logout_invalidates_session() -> None:
    assert _login().status_code == 200
    assert client.post("/admin/logout").status_code == 200
    client.cookies.clear()
    assert client.get("/admin/stats").status_code == 401


def test_purge_deletes_events_older_than_six_months() -> None:
    now = datetime.utcnow()
    with Session(get_engine()) as session:
        session.add(
            UsageEvent(
                event_type=EventType.form_submission,
                occurred_at=now - timedelta(days=200),
                ip_address="9.9.9.9",
                country_code="DE",
            )
        )
        session.add(
            UsageEvent(
                event_type=EventType.form_submission,
                occurred_at=now,
                ip_address="8.8.8.8",
                country_code="DE",
            )
        )
        session.add(
            UsageEvent(
                event_type=EventType.result_view,
                occurred_at=now - timedelta(days=200),
                ip_address="9.9.9.9",
                country_code="DE",
                user_prompt="alter prompt",
            )
        )
        session.commit()
        deleted = purge_old_events(session, now)
        leftover = session.exec(select(UsageEvent).where(UsageEvent.ip_address == "9.9.9.9")).all()
    assert deleted >= 1
    assert leftover == []
