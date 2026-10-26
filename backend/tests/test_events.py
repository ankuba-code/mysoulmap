from datetime import datetime

from fastapi.testclient import TestClient
from sqlmodel import Session, select

from src.db import get_engine
from starlette.requests import Request

from src.events import client_ip, is_form_submission
from src.llm import LlmCallError
from src.main import app
from src.models_chat import ChatRequest
from src.models_chat import LlmOutput
from src.models_events import EventType, LlmStatus, UsageEvent

client = TestClient(app)


def _clear_events() -> None:
    with Session(get_engine()) as session:
        for event in session.exec(select(UsageEvent)).all():
            session.delete(event)
        session.commit()


def test_client_ip_ignores_spoofed_forwarded_header() -> None:
    request = Request(
        {
            "type": "http",
            "asgi": {"version": "3.0"},
            "http_version": "1.1",
            "method": "GET",
            "scheme": "http",
            "path": "/",
            "raw_path": b"/",
            "query_string": b"",
            "headers": [(b"x-forwarded-for", b"1.2.3.4")],
            "client": ("10.0.0.8", 1234),
            "server": ("test", 80),
        }
    )
    assert client_ip(request) == "10.0.0.8"


def test_form_submission_detects_first_turn() -> None:
    first = ChatRequest(messages=[{"role": "user", "content": "Hallo"}])
    follow = ChatRequest(
        messages=[
            {"role": "user", "content": "Hallo"},
            {"role": "assistant", "content": "Antwort"},
            {"role": "user", "content": "Mehr"},
        ]
    )
    assert is_form_submission(first) is True
    assert is_form_submission(follow) is False


def test_chat_writes_form_submission_and_result_view(monkeypatch) -> None:
    _clear_events()

    async def fake_llm(**_kwargs: object) -> LlmOutput:
        return LlmOutput(message="Machu Picchu.", place_ids=["mp"])

    monkeypatch.setattr("src.chat.complete_llm", fake_llm)
    response = client.post(
        "/chat",
        json={
            "messages": [{"role": "user", "content": "Anden"}],
            "shown_place_ids": [],
            "language": "de",
        },
    )
    assert response.status_code == 200
    with Session(get_engine()) as session:
        events = session.exec(select(UsageEvent)).all()
    types = sorted(event.event_type.value for event in events)
    assert types == ["form_submission", "result_view"]
    result = next(event for event in events if event.event_type == EventType.result_view)
    assert result.llm_status == LlmStatus.success
    assert result.ip_address
    assert len(result.country_code) == 2


def test_fallback_result_view_stores_error_code(monkeypatch) -> None:
    _clear_events()

    async def fake_llm(**_kwargs: object) -> LlmOutput:
        raise LlmCallError("OPENAI_TIMEOUT")

    monkeypatch.setattr("src.chat.complete_llm", fake_llm)
    response = client.post(
        "/chat",
        json={
            "messages": [{"role": "user", "content": "Anden Inka"}],
            "shown_place_ids": [],
            "language": "de",
        },
    )
    assert response.status_code == 200
    assert response.json()["source"] == "fallback"
    with Session(get_engine()) as session:
        views = session.exec(
            select(UsageEvent).where(UsageEvent.event_type == EventType.result_view)
        ).all()
    assert views
    assert views[0].llm_status == LlmStatus.fallback
    assert views[0].error_code == "OPENAI_TIMEOUT"
    assert views[0].occurred_at <= datetime.utcnow()
