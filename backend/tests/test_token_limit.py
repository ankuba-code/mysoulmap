from datetime import datetime, timedelta

from fastapi.testclient import TestClient
from sqlmodel import Session, select

from src.db import get_engine
from src.main import app
from src.models_chat import LlmOutput
from src.models_events import EventType, LlmStatus, UsageEvent
from src.stats import rank_topics, summarize_month
from src.token_limit import TOKEN_LIMIT

client = TestClient(app)


def _clear_events() -> None:
    with Session(get_engine()) as session:
        for event in session.exec(select(UsageEvent)).all():
            session.delete(event)
        session.commit()


def _seed_usage(tokens: int, ip_address: str = "testclient") -> None:
    _clear_events()
    with Session(get_engine()) as session:
        session.add(
            UsageEvent(
                event_type=EventType.result_view,
                occurred_at=datetime.utcnow(),
                ip_address=ip_address,
                country_code="DE",
                llm_input_tokens=tokens,
                llm_output_tokens=0,
                llm_status=LlmStatus.success,
            )
        )
        session.commit()


def test_chat_blocks_before_the_model_when_the_token_limit_is_reached(monkeypatch) -> None:
    called = {"llm": False}

    async def fake_llm(**_kwargs: object) -> LlmOutput:
        called["llm"] = True
        return LlmOutput(message="Nein.", place_ids=["machu_picchu_pe"])

    monkeypatch.setattr("src.chat.complete_llm", fake_llm)
    _seed_usage(TOKEN_LIMIT)
    response = client.post(
        "/chat",
        json={"messages": [{"role": "user", "content": "Noch eine Frage"}], "language": "de"},
    )
    assert response.status_code == 429
    assert response.json()["error"]["code"] == "TOKEN_LIMIT"
    assert called["llm"] is False
    _clear_events()


def test_chat_sets_approaching_notice_at_ninety_percent(monkeypatch) -> None:
    async def fake_llm(**_kwargs: object) -> LlmOutput:
        return LlmOutput(message="Machu Picchu.", place_ids=["machu_picchu_pe"])

    monkeypatch.setattr("src.chat.complete_llm", fake_llm)
    monkeypatch.setattr(
        "src.chat.pop_llm_usage",
        lambda: {"input_tokens": 100, "output_tokens": 0},
    )
    _seed_usage(int(TOKEN_LIMIT * 0.9) - 100)
    response = client.post(
        "/chat",
        json={"messages": [{"role": "user", "content": "Meer"}], "language": "de"},
    )
    assert response.status_code == 200
    assert response.json()["token_notice"] == "approaching"
    _clear_events()


def test_chat_omits_notice_below_ninety_percent(monkeypatch) -> None:
    async def fake_llm(**_kwargs: object) -> LlmOutput:
        return LlmOutput(message="Machu Picchu.", place_ids=["machu_picchu_pe"])

    monkeypatch.setattr("src.chat.complete_llm", fake_llm)
    _seed_usage(100)
    response = client.post(
        "/chat",
        json={"messages": [{"role": "user", "content": "Meer"}], "language": "de"},
    )
    assert response.status_code == 200
    assert response.json()["token_notice"] is None
    _clear_events()


def test_rank_topics_merges_near_duplicates() -> None:
    ranked = rank_topics(
        [
            "Wochenende am Meer",
            "wochenende   am meer",
            "kurzer Trip ans Meer",
            "Hohe Berge im Winter",
        ]
    )
    by_count = {item["count"]: item["label"] for item in ranked}
    assert by_count[3] == "Wochenende am Meer"
    assert by_count[1] == "Hohe Berge im Winter"


def test_summarize_month_reports_time_tokens_and_hints() -> None:
    start = datetime(2026, 11, 5, 12, 0, 0)
    prompts = [
        UsageEvent(
            event_type=EventType.result_view,
            occurred_at=start + timedelta(seconds=offset),
            ip_address="1.1.1.1",
            country_code="DE",
            llm_input_tokens=15_000 if offset == 0 else 0,
            llm_output_tokens=0,
            llm_status=LlmStatus.success,
            user_prompt="Wochenende am Meer",
        )
        for offset in (0, 1, 2)
    ]
    limits = [
        UsageEvent(
            event_type=EventType.rate_limited,
            occurred_at=start + timedelta(seconds=3 + offset),
            ip_address="1.1.1.1",
            country_code="DE",
            error_code="RATE_LIMITED",
        )
        for offset in range(5)
    ]
    report = summarize_month(prompts + limits, start)
    assert report["month"] == "2026-11"
    assert report["token_limit"] == TOKEN_LIMIT
    user = report["users"][0]
    assert user["tokens_used"] == 15_000
    assert user["active_seconds"] == 7
    assert user["rate_limited"] == 5
    assert user["short_gaps"] >= 3
    assert user["identical_prompt_share"] == 1
    assert "rate_limited" in user["hints"]
    assert "short_intervals" in user["hints"]
    assert "identical_prompts" in user["hints"]
    assert "token_ratio" not in user["hints"]
    assert report["topics"] == [{"label": "Wochenende am Meer", "count": 3}]
