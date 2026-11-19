from datetime import datetime

from fastapi.testclient import TestClient
from sqlmodel import Session, select

from src.db import get_engine
from starlette.requests import Request

from src.events import client_ip, is_form_submission, os_language_from_header
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


def test_os_language_keeps_primary_tag() -> None:
    assert os_language_from_header("de-DE,de;q=0.9,en-US;q=0.8") == "de-DE"
    assert os_language_from_header("en") == "en"
    assert os_language_from_header("zh-Hans-CN,zh;q=0.9") == "zh-CN"
    assert os_language_from_header("*") is None
    assert os_language_from_header(None) is None


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
        return LlmOutput(message="Machu Picchu.", place_ids=["machu_picchu_pe"])

    monkeypatch.setattr("src.chat.complete_llm", fake_llm)
    response = client.post(
        "/chat",
        headers={"Accept-Language": "de-DE,de;q=0.9,en;q=0.8"},
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
    assert result.os_language == "de-DE"
    assert result.user_prompt == "Anden"
    assert "Anden" not in (result.os_language or "")


def test_result_view_keeps_only_the_latest_user_excerpt(monkeypatch) -> None:
    _clear_events()

    async def fake_llm(**_kwargs: object) -> LlmOutput:
        return LlmOutput(message="Geheim.", place_ids=["machu_picchu_pe"])

    monkeypatch.setattr("src.chat.complete_llm", fake_llm)
    long_text = "Berg" * 200
    response = client.post(
        "/chat",
        json={
            "messages": [
                {"role": "user", "content": long_text},
                {"role": "assistant", "content": "Geheim."},
                {"role": "user", "content": "Nur diese Frage"},
            ],
            "shown_place_ids": ["machu_picchu_pe"],
            "language": "de",
        },
    )
    assert response.status_code == 200
    with Session(get_engine()) as session:
        views = session.exec(
            select(UsageEvent).where(UsageEvent.event_type == EventType.result_view)
        ).all()
    assert len(views) == 1
    assert views[0].user_prompt == "Nur diese Frage"
    assert "Geheim" not in (views[0].user_prompt or "")
    assert len(long_text) > 500


def test_result_view_truncates_prompt_to_500_characters(monkeypatch) -> None:
    _clear_events()

    async def fake_llm(**_kwargs: object) -> LlmOutput:
        return LlmOutput(message="Machu Picchu.", place_ids=["machu_picchu_pe"])

    monkeypatch.setattr("src.chat.complete_llm", fake_llm)
    text = "a" * 600
    response = client.post(
        "/chat",
        json={
            "messages": [{"role": "user", "content": text}],
            "shown_place_ids": [],
            "language": "de",
        },
    )
    assert response.status_code == 200
    with Session(get_engine()) as session:
        view = session.exec(
            select(UsageEvent).where(UsageEvent.event_type == EventType.result_view)
        ).one()
    assert view.user_prompt == "a" * 500


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


def test_llm_without_places_still_writes_result_view(monkeypatch) -> None:
    _clear_events()

    async def fake_llm(**_kwargs: object) -> LlmOutput:
        return LlmOutput(message="Im Atlas bleibt es still.", place_ids=[])

    monkeypatch.setattr("src.chat.complete_llm", fake_llm)
    response = client.post(
        "/chat",
        json={
            "messages": [{"role": "user", "content": "irgendwo hin"}],
            "shown_place_ids": [],
            "language": "de",
        },
    )
    assert response.status_code == 200
    assert response.json()["source"] == "llm"
    with Session(get_engine()) as session:
        views = session.exec(
            select(UsageEvent).where(UsageEvent.event_type == EventType.result_view)
        ).all()
    assert len(views) == 1
    assert views[0].llm_status == LlmStatus.success
