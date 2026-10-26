from urllib.parse import parse_qs, urlparse

from fastapi.testclient import TestClient
from sqlmodel import Session, select

from src.db import get_engine
from src.main import app
from src.models_events import EventType, UsageEvent

client = TestClient(app)


def test_go_redirects_to_booking_and_logs_click(monkeypatch) -> None:
    monkeypatch.setenv("BOOKING_AFFILIATE_ID", "123456")
    response = client.get("/go/mp", params={"lang": "en"}, follow_redirects=False)
    assert response.status_code == 302
    location = response.headers["location"]
    parsed = urlparse(location)
    assert parsed.path == "/searchresults.en.html"
    assert parse_qs(parsed.query)["ss"] == ["Machu Picchu, Peru"]
    with Session(get_engine()) as session:
        events = session.exec(select(UsageEvent).where(UsageEvent.event_type == EventType.affiliate_click)).all()
    assert any(event.place_id == "mp" for event in events)


def test_go_unknown_place_is_404() -> None:
    with Session(get_engine()) as session:
        before = len(session.exec(select(UsageEvent).where(UsageEvent.event_type == EventType.affiliate_click)).all())
    response = client.get("/go/gibt-es-nicht", follow_redirects=False)
    assert response.status_code == 404
    assert response.json()["error"]["code"] == "PLACE_NOT_FOUND"
    with Session(get_engine()) as session:
        after = len(session.exec(select(UsageEvent).where(UsageEvent.event_type == EventType.affiliate_click)).all())
    assert after == before
