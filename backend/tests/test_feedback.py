from fastapi.testclient import TestClient
from sqlmodel import Session, select

from src.db import get_engine
from src.main import app
from src.models_events import EventType, UsageEvent
from tests.conftest import TEST_ADMIN_PASSWORD

client = TestClient(app)


def test_feedback_is_stored_with_the_ip_and_shown_in_raw_stats() -> None:
    with Session(get_engine()) as session:
        for existing in session.exec(select(UsageEvent)).all():
            session.delete(existing)
        session.commit()
    response = client.post(
        "/feedback",
        json={"vote": "dislike", "text": "  zu knapp  "},
    )
    assert response.status_code == 200
    assert response.json() == {"ok": True}
    with Session(get_engine()) as session:
        event = session.exec(select(UsageEvent)).one()
    assert event.event_type == EventType.chat_feedback
    assert event.feedback_vote == "dislike"
    assert event.feedback_text == "zu knapp"
    assert event.ip_address
    login = client.post("/admin/login", json={"username": "aku", "password": TEST_ADMIN_PASSWORD})
    assert login.status_code == 200
    raw = client.get("/admin/stats", params={"raw": True})
    stored = next(item for item in raw.json()["events"] if item["event_type"] == "chat_feedback")
    assert stored["feedback_vote"] == "dislike"
    assert stored["feedback_text"] == "zu knapp"
    assert stored["ip_address"] == event.ip_address
    page = client.get("/admin?raw=true")
    assert "zu knapp" in page.text
    assert "dislike" in page.text


def test_feedback_rejects_an_unknown_vote() -> None:
    response = client.post("/feedback", json={"vote": "maybe", "text": ""})
    assert response.status_code == 422
