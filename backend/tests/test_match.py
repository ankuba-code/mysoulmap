from fastapi.testclient import TestClient
from sqlmodel import Session, select

from src.atlas import PLACES, Coordinates
from src.db import get_engine
from src.facets import FACETS
from src.main import app
from src.match import (
    ELEMENTS,
    LANDSCAPES,
    MOODS,
    MOTIONS,
    RHYTHMS,
    SYMBOLS,
    MatchAnswers,
    MatchRequest,
    derive_anima_card,
    match_places,
    q7_lookup_query,
)
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


def _answers(**overrides: object) -> MatchAnswers:
    payload = {
        "q0": 1,
        "q1": 0,
        "q2": 4,
        "q3": 0,
        "q4": 1,
        "q5": 1,
        "q6": "Aufbruch",
        "q7": "Island, Vulkane",
    }
    payload.update(overrides)
    return MatchAnswers.model_validate(payload)


def _ids(**overrides: object) -> list[str]:
    response = match_places(PLACES, MatchRequest(answers=_answers(**overrides)))
    return [place.id for place in response.matches]


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


def test_named_place_and_landscape_change_the_ranking() -> None:
    volcano = _ids(q7="zz")
    forest = _ids(q0=2, q1=1, q2=2, q3=0, q4=4, q5=0, q6="Tiefe", q7="Dschungel")
    assert volcano[0] == "mount_etna_it"
    assert forest[0] == "tikal_gt"
    assert volcano != forest
    assert _ids(q7="Island")[0] == "reykjavik_is"


def test_every_place_leads_its_own_answers() -> None:
    assert set(FACETS) == {place.id for place in PLACES}
    for place in PLACES:
        facet = FACETS[place.id]
        ids = _ids(
            q0=LANDSCAPES.index(facet["landscape"]),
            q1=RHYTHMS.index(facet["rhythm"]),
            q2=MOODS.index(facet["mood"]),
            q3=ELEMENTS.index(place.element),
            q4=SYMBOLS.index(facet["symbol"]),
            q5=MOTIONS.index(facet["motion"]),
            q6="qqqq",
            q7="zz",
        )
        assert ids[0] == place.id


def test_each_answer_keeps_its_own_place() -> None:
    forest = _ids(q0=2, q1=0, q2=2, q3=2, q4=1, q5=1, q7="zz")
    plain = _ids(q0=0, q1=4, q2=3, q3=2, q4=0, q5=3, q7="zz")
    coast = _ids(q0=3, q1=3, q2=2, q3=1, q4=1, q5=2, q7="zz")
    city = _ids(q0=4, q1=3, q2=0, q3=3, q4=2, q5=0, q7="zz")
    aether = _ids(q0=1, q1=2, q2=2, q3=4, q4=0, q5=0, q7="zz")
    assert forest[0] == "sigiriya_lk"
    assert plain[0] == "uluru_au"
    assert coast[0] == "mont_saint_michel_fr"
    assert city[0] == "istanbul_tr"
    assert aether[0] == "mount_kailash_cn"
    assert forest != plain


def test_one_foreign_landscape_stays_inside_the_element() -> None:
    ids = _ids(q0=2, q1=0, q2=4, q3=0, q4=1, q5=1, q7="zz")
    assert ids[0] == "mount_etna_it"


def test_named_atlas_place_leads_the_matches() -> None:
    response = match_places(PLACES, MatchRequest(answers=_answers(q7="Kyoto")))
    assert response.matches[0].id == "kyoto_jp"
    assert response.matches[0].reasons[0].dimension == "proximity"
    assert q7_lookup_query("Kyoto", PLACES) is None


def test_country_with_several_places_uses_the_nearest() -> None:
    near_fuji = Coordinates(lat=35.36, lng=138.73)
    near_kyoto = Coordinates(lat=35.01, lng=135.77)
    fuji = match_places(PLACES, MatchRequest(answers=_answers(q7="Japan")), located=near_fuji)
    kyoto = match_places(PLACES, MatchRequest(answers=_answers(q7="Japan")), located=near_kyoto)
    assert fuji.matches[0].id == "mount_fuji_jp"
    assert kyoto.matches[0].id == "kyoto_jp"
    assert q7_lookup_query("Japan", PLACES) == "Japan"


def test_unknown_place_uses_geocoded_neighbour() -> None:
    paris = Coordinates(lat=48.8566, lng=2.3522)
    response = match_places(PLACES, MatchRequest(answers=_answers(q7="Paris")), located=paris)
    assert response.matches[0].id == "mont_saint_michel_fr"
    assert response.matches[0].country == "France"
    assert q7_lookup_query("Paris", PLACES) == "Paris"
    assert q7_lookup_query("Berg", PLACES) is None
    assert q7_lookup_query("Licht", PLACES) is None


def test_cardinal_direction_fills_all_three_matches() -> None:
    north = match_places(PLACES, MatchRequest(answers=_answers(q7="im hohen Norden")))
    south = match_places(PLACES, MatchRequest(answers=_answers(q7="Süden")))
    east = match_places(PLACES, MatchRequest(answers=_answers(q7="Osten")))
    west = match_places(PLACES, MatchRequest(answers=_answers(q7="Westen")))
    assert q7_lookup_query("Norden", PLACES) is None
    assert len(north.matches) == 3
    assert all(place.coordinates.lat >= 50 for place in north.matches)
    assert all(place.reasons[0].dimension == "direction" for place in north.matches)
    assert all(place.coordinates.lat <= -10 for place in south.matches)
    assert all(place.coordinates.lng >= 60 for place in east.matches)
    assert all(place.coordinates.lng <= -30 for place in west.matches)


def test_match_geocodes_only_when_the_atlas_cannot_place_the_text(monkeypatch) -> None:
    calls: list[str] = []

    def _locate(query: str, *, language: str) -> Coordinates:
        calls.append(query)
        assert language == "de"
        return Coordinates(lat=48.8566, lng=2.3522)

    monkeypatch.setattr("src.main.locate_text", _locate)
    north = client.post("/match", json={"answers": _answers(q7="Norden").model_dump(), "language": "de"})
    paris = client.post("/match", json={"answers": _answers(q7="Paris").model_dump(), "language": "de"})
    assert north.status_code == 200
    assert paris.status_code == 200
    assert calls == ["Paris"]
    assert paris.json()["matches"][0]["id"] == "mont_saint_michel_fr"
    assert all(place["coordinates"]["lat"] >= 50 for place in north.json()["matches"])


def test_match_keeps_three_places_when_geocoding_fails(monkeypatch) -> None:
    monkeypatch.setattr("src.main.locate_text", lambda *_args, **_kwargs: None)
    response = client.post("/match", json={"answers": _answers(q7="Paris").model_dump(), "language": "de"})
    assert response.status_code == 200
    assert len(response.json()["matches"]) == 3
