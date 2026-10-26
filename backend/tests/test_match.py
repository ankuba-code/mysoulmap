from fastapi.testclient import TestClient
from sqlmodel import Session, select

from src.atlas import PLACES
from src.db import get_engine
from src.main import app
from src.match import MatchAnswers, MatchRequest, derive_anima_card, match_places
from src.models_events import EventType, UsageEvent

client = TestClient(app)

ANSWERS = {
    "q0": 1,
    "q1": 0,
    "q2": 2,
    "q3": 2,
    "q4": 1,
    "q5": 1,
    "q6": "Stille",
    "q7": "Berg",
}


def _clear_events() -> None:
    with Session(get_engine()) as session:
        for event in session.exec(select(UsageEvent)).all():
            session.delete(event)
        session.commit()


def test_derive_card_uses_element_symbol_and_word() -> None:
    card = derive_anima_card(MatchAnswers.model_validate(ANSWERS))
    assert card.element == "earth"
    assert card.archetype_symbol == "triangle"
    assert card.inner_rhythm == "rise"
    assert card.dominant_frequency == "Stille"
    assert card.travel_direction == "outward"


def test_match_returns_three_atlas_places() -> None:
    response = match_places(PLACES, MatchRequest(answers=MatchAnswers.model_validate(ANSWERS)))
    assert len(response.matches) == 3
    known = {place.id for place in PLACES}
    assert {place.id for place in response.matches}.issubset(known)
    scores = [place.score for place in response.matches]
    assert scores == sorted(scores, reverse=True)


def test_match_endpoint_records_form_and_result() -> None:
    _clear_events()
    response = client.post("/match", json={"answers": ANSWERS, "language": "de"})
    assert response.status_code == 200
    body = response.json()
    assert body["anima_card"]["element"] == "earth"
    assert len(body["matches"]) == 3
    assert body["matches"][0]["booking_link"].startswith("/go/")
    with Session(get_engine()) as session:
        events = session.exec(select(UsageEvent)).all()
    types = sorted(event.event_type for event in events)
    assert types == [EventType.form_submission, EventType.result_view]
    result = next(event for event in events if event.event_type == EventType.result_view)
    assert result.llm_status is None
