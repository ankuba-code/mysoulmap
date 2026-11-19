from fastapi.testclient import TestClient
from sqlmodel import Session, select

from src.db import get_engine
from src.llm import LlmCallError
from src.main import app
from src.models_chat import LlmOutput
from src.models_events import EventType, UsageEvent
from src.rate_limit import LIMIT_ADMIN_LOGIN, LIMIT_ADMIN_STATS, LIMIT_ATLAS, LIMIT_CHAT, LIMIT_GO

client = TestClient(app)

CHAT_BODY = {
    "messages": [{"role": "user", "content": "Ich suche Erde"}],
    "shown_place_ids": [],
    "language": "de",
}


def test_limit_constants_match_spec() -> None:
    assert LIMIT_CHAT == "20/minute"
    assert LIMIT_ATLAS == "60/minute"
    assert LIMIT_GO == "30/minute"
    assert LIMIT_ADMIN_STATS == "10/minute"
    assert LIMIT_ADMIN_LOGIN == "5/minute"


def _rate_limited_count() -> int:
    with Session(get_engine()) as session:
        rows = session.exec(
            select(UsageEvent).where(UsageEvent.event_type == EventType.rate_limited)
        ).all()
    return len(rows)


def test_chat_returns_429_after_20_requests(monkeypatch) -> None:
    async def fake_llm(**_kwargs: object) -> LlmOutput:
        raise LlmCallError("OPENAI_TIMEOUT")

    monkeypatch.setattr("src.chat.complete_llm", fake_llm)
    before = _rate_limited_count()
    statuses = [client.post("/chat", json=CHAT_BODY).status_code for _ in range(20)]
    assert statuses == [200] * 20
    blocked = client.post("/chat", json=CHAT_BODY)
    assert blocked.status_code == 429
    assert blocked.headers.get("Retry-After") is not None
    body = blocked.json()
    assert body["error"]["code"] == "RATE_LIMITED"
    assert _rate_limited_count() == before + 1


def test_atlas_returns_429_after_60_requests() -> None:
    statuses = [client.get("/atlas/places").status_code for _ in range(60)]
    assert statuses == [200] * 60
    blocked = client.get("/atlas/places")
    assert blocked.status_code == 429
    assert blocked.headers.get("Retry-After") is not None
    assert blocked.json()["error"]["code"] == "RATE_LIMITED"


def test_atlas_list_and_id_share_one_budget() -> None:
    for _ in range(40):
        assert client.get("/atlas/places").status_code == 200
    for _ in range(20):
        assert client.get("/atlas/places/machu_picchu_pe").status_code == 200
    blocked = client.get("/atlas/places")
    assert blocked.status_code == 429


def test_go_returns_429_after_30_requests() -> None:
    statuses = [client.get("/go/machu_picchu_pe", follow_redirects=False).status_code for _ in range(30)]
    assert statuses == [302] * 30
    blocked = client.get("/go/machu_picchu_pe", follow_redirects=False)
    assert blocked.status_code == 429
    assert blocked.json()["error"]["code"] == "RATE_LIMITED"


def test_health_is_not_rate_limited() -> None:
    statuses = [client.get("/health").status_code for _ in range(70)]
    assert statuses == [200] * 70
