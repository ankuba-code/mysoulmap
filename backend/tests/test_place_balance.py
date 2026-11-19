"""Sichtbarkeit der 40 Atlas-Orte über das Ritualraster.

Das Raster ist das Produkt der Auswahlfragen: Landschaft (q0), Rhythmus (q1),
Stimmung (q2), Element (q3), Symbol (q4), Körper (q5). Der Freitext bleibt
neutral, damit ein deutsches Ritualwort keinen Namens- oder Vibrationstreffer
erzwingen muss. Jeder Ort soll dabei mindestens einmal in den Top 3 stehen.
"""

from dataclasses import dataclass
from itertools import product

from src.atlas import PLACES, Place
from src.match import (
    ELEMENTS,
    RHYTHMS,
    SYMBOLS,
    MatchAnswers,
    MatchRequest,
    _ELEMENT_CONTRAST,
    _ELEMENT_MATCH,
    _LANDSCAPE_POINTS,
    _QUESTION_POINTS,
    match_places,
    score_place,
)

NEUTRAL_WORD = "qqqq"
NEUTRAL_HINT = "zz"
ELEMENT_ORDER = ("fire", "water", "earth", "air", "aether")
_CHOICES = {
    "q0": range(5),
    "q1": range(len(RHYTHMS)),
    "q2": range(5),
    "q3": range(len(ELEMENTS)),
    "q4": range(len(SYMBOLS)),
    "q5": range(4),
}


def _answers(**overrides: object) -> MatchAnswers:
    payload: dict[str, object] = {
        "q0": 0,
        "q1": 0,
        "q2": 0,
        "q3": 0,
        "q4": 0,
        "q5": 0,
        "q6": NEUTRAL_WORD,
        "q7": NEUTRAL_HINT,
    }
    payload.update(overrides)
    return MatchAnswers.model_validate(payload)


def _ids(**overrides: object) -> tuple[str, ...]:
    response = match_places(PLACES, MatchRequest(answers=_answers(**overrides)))
    return tuple(place.id for place in response.matches)


@dataclass
class Visibility:
    place: Place
    hits: int
    rank1: int


def _sweep() -> tuple[list[Visibility], int]:
    hits = {place.id: 0 for place in PLACES}
    rank1 = {place.id: 0 for place in PLACES}
    profiles = 0
    for q0, q1, q2, q3, q4, q5 in product(
        _CHOICES["q0"],
        _CHOICES["q1"],
        _CHOICES["q2"],
        _CHOICES["q3"],
        _CHOICES["q4"],
        _CHOICES["q5"],
    ):
        profiles += 1
        for index, place_id in enumerate(_ids(q0=q0, q1=q1, q2=q2, q3=q3, q4=q4, q5=q5)):
            hits[place_id] += 1
            if index == 0:
                rank1[place_id] += 1
    rows = [Visibility(place, hits[place.id], rank1[place.id]) for place in PLACES]
    rows.sort(
        key=lambda row: (
            ELEMENT_ORDER.index(row.place.element),
            -row.hits,
            row.place.name.casefold(),
        )
    )
    return rows, profiles


def _vibration_opens(place: Place) -> bool:
    elements = [place.element] if place.element in ELEMENTS else list(ELEMENTS)
    for element in elements:
        if place.id in _ids(q3=ELEMENTS.index(element), q6=place.primaervibration):
            return True
    return False


def _name_opens(place: Place) -> bool:
    element = place.element if place.element in ELEMENTS else ELEMENTS[0]
    return place.id in _ids(q3=ELEMENTS.index(element), q7=place.name)


def _profile_lines() -> list[str]:
    answers = _answers(q0=1, q1=RHYTHMS.index("descent"), q2=2, q3=ELEMENTS.index("earth"), q4=1, q5=1)
    response = match_places(PLACES, MatchRequest(answers=answers))
    card = response.anima_card
    chosen = {place.id for place in response.matches}
    lines = [
        (
            "Beispielprofil: Landschaft Berg, Rhythmus Abstieg, Stimmung Sehnsucht, "
            f"Element {card.element}, Symbol {card.archetype_symbol}, Körper Klettern, Freitext neutral."
        ),
        "Top 3: " + ", ".join(f"{place.name} ({place.score})" for place in response.matches),
    ]
    ranked: list[tuple[int, str, Place, str]] = []
    for place in PLACES:
        total, reasons = score_place(place, card, "de", answers)
        reason_text = ", ".join(f"{reason.dimension} {reason.points}" for reason in reasons)
        ranked.append((total, place.name.casefold(), place, reason_text))
    ranked.sort(key=lambda item: (-item[0], item[1]))
    for total, _name, place, reason_text in ranked:
        if place.element not in {card.element, "aether"} and place.id not in chosen:
            continue
        mark = "sichtbar" if place.id in chosen else "verdeckt"
        lines.append(
            f"  {total:3}  {mark:8}  {place.element:7}  {place.id:4}  {place.name}  [{reason_text}]"
        )
    return lines


def _render(rows: list[Visibility], profiles: int) -> str:
    hidden = [row for row in rows if row.hits == 0]
    fair = profiles * 3 / len(rows)
    levels = sorted({place.intensity for place in PLACES})
    if len(levels) == 1:
        intensity_line = (
            f"  Intensität         alle Orte stehen auf {levels[0]}, der Anteil sortiert niemanden."
        )
    else:
        intensity_line = f"  Intensität         Stufen im Atlas: {levels}."
    lines = [
        (
            f"Raster: Landschaft 5 × Rhythmus {len(RHYTHMS)} × Stimmung 5 × "
            f"Element {len(ELEMENTS)} × Symbol {len(SYMBOLS)} × Körper 4 = {profiles} Profile."
        ),
        "Freitext neutral. Je Profil die Top 3.",
        f"Gleichverteilung wäre {fair:.0f} Treffer pro Ort. {len(hidden)} von {len(rows)} Orten haben 0.",
        "",
        "Punkte heute:",
        (
            f"  Element            {_ELEMENT_MATCH} bei Treffer, sonst {_ELEMENT_CONTRAST}. "
            "Äther ist die fünfte Antwort."
        ),
        (
            f"  Fragen             Landschaft {_LANDSCAPE_POINTS}, "
            f"Rhythmus, Stimmung, Symbol und Körper je {_QUESTION_POINTS}. "
            "Jede Frage zählt für sich."
        ),
        intensity_line,
        "  Intensitätspunkte  zählen nicht mit. Alle Orte stehen auf derselben Stufe.",
        "  Wort               8, wenn der Freitext eine noch nicht getroffene Zuordnung trifft.",
        "  Gleichstand        über die Antworten gedreht, nicht nach dem Namen.",
        (
            f"  Folge              Eine fremde Landschaft ({_ELEMENT_CONTRAST} + {_LANDSCAPE_POINTS}) "
            f"bleibt unter dem eigenen Element ({_ELEMENT_MATCH})."
        ),
        "",
        "Element   Treffer  Platz1  Anteil    id    Ort",
    ]
    for row in rows:
        share = f"{row.hits / profiles:.1%}"
        lines.append(
            f"{row.place.element:8}  {row.hits:7}  {row.rank1:6}  {share:>7}   "
            f"{row.place.id:4}  {row.place.name}"
        )
    lines.extend(["", "Orte ohne Treffer im Raster. Rettung nur über Freitext:"])
    for row in hidden:
        vibration = "ja" if _vibration_opens(row.place) else "nein"
        named = "ja" if _name_opens(row.place) else "nein"
        lines.append(
            f"  {row.place.element:7}  {row.place.id:4}  {row.place.name:24}  "
            f"eigene Vibration: {vibration:4}  eigener Name: {named}"
        )
    lines.append("")
    lines.extend(_profile_lines())
    return "\n".join(lines)


def test_neutral_free_text_does_not_name_a_place_or_vibration() -> None:
    blob = f"{NEUTRAL_WORD} {NEUTRAL_HINT}".casefold()
    assert not any(place.name.casefold() in blob for place in PLACES)
    assert not any(blob in place.primaervibration.casefold() for place in PLACES)


def test_landscape_mood_symbol_and_body_can_change_the_top3() -> None:
    earth = {"q1": RHYTHMS.index("descent"), "q3": ELEMENTS.index("earth")}
    landscapes = {_ids(q0=choice, **earth) for choice in _CHOICES["q0"]}
    moods = {_ids(q2=choice, q3=ELEMENTS.index("earth")) for choice in _CHOICES["q2"]}
    symbols = {
        _ids(q4=choice, q0=1, q1=0, q3=ELEMENTS.index("earth")) for choice in _CHOICES["q4"]
    }
    bodies = {_ids(q5=choice, q3=ELEMENTS.index("water")) for choice in _CHOICES["q5"]}
    assert len(landscapes) > 1
    assert len(moods) > 1
    assert len(symbols) > 1
    assert len(bodies) > 1
    assert _ids(q3=0) != _ids(q3=1)


def test_structured_ritual_can_surface_every_place() -> None:
    """Soll: jedes Profil aus den sechs Auswahlfragen, jeder Ort mindestens einmal."""
    rows, profiles = _sweep()
    missing = [f"{row.place.id} {row.place.name}" for row in rows if row.hits == 0]
    assert missing == [], _render(rows, profiles)
