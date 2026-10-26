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
    assert body["top_clicked_places"] == [{"place_id": "mp", "clicks": 1}]
    assert body["daily"]
    assert body["daily"][0]["form_submissions"] == 1
    assert "events" not in body


def test_stats_raw_includes_ip() -> None:
    client.cookies.clear()
    assert _login().status_code == 200
    _seed_events()
    response = client.get("/admin/stats", params={"raw": True})
    assert response.status_code == 200
    events = response.json()["events"]
    assert events
    assert any(item["ip_address"] == "1.1.1.1" for item in events)


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
        session.commit()
        deleted = purge_old_events(session, now)
    assert deleted >= 1
