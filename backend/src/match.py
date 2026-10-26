from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from .atlas import Coordinates, Place

SYMBOLS = ("circle", "triangle", "cross", "rhombus", "spiral")
RHYTHMS = ("rise", "descent", "circle", "threshold", "pause")
ELEMENTS = ("fire", "water", "earth", "air")

Language = Literal["de", "en", "es", "ru"]


class MatchAnswers(BaseModel):
    model_config = ConfigDict(extra="forbid")

    q0: int = Field(ge=0, le=4)
    q1: int = Field(ge=0, le=4)
    q2: int = Field(ge=0, le=4)
    q3: int = Field(ge=0, le=3)
    q4: int = Field(ge=0, le=4)
    q5: int = Field(ge=0, le=3)
    q6: str = Field(min_length=1, max_length=400)
    q7: str = Field(min_length=2, max_length=400)


class MatchRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    answers: MatchAnswers
    language: Language = "de"


class AnimaCard(BaseModel):
    archetype_symbol: str
    element: str
    inner_rhythm: str
    emotional_intensity: int
    travel_direction: str
    keywords: list[str]
    dominant_frequency: str


class ScoreReason(BaseModel):
    dimension: str
    text: str
    points: int


class MatchedPlace(BaseModel):
    id: str
    name: str
    country: str
    coordinates: Coordinates
    element: str
    archetyp: str
    primaervibration: str
    correspondence: str
    booking_link: str
    score: int
    reasons: list[ScoreReason]


class MatchResponse(BaseModel):
    anima_card: AnimaCard
    matches: list[MatchedPlace]


def _clamp(value: int, low: int, high: int) -> int:
    return max(low, min(high, value))


def derive_anima_card(answers: MatchAnswers) -> AnimaCard:
    archetype_symbol = SYMBOLS[answers.q4]
    inner_rhythm = RHYTHMS[answers.q1]
    element = ELEMENTS[answers.q3]
    travel_direction = "inward" if inner_rhythm in {"pause", "circle"} else "outward"
    word = answers.q6.strip()
    place_hint = answers.q7.strip()
    base = 7 if inner_rhythm in {"rise", "threshold"} else 6 if inner_rhythm == "descent" else 5
    emotional_intensity = _clamp(base + (1 if len(word) >= 10 else 0), 1, 10)
    keywords = list(
        dict.fromkeys(
            item
            for item in (
                archetype_symbol,
                element,
                inner_rhythm,
                travel_direction,
                word.casefold(),
                place_hint.casefold(),
            )
            if item
        )
    )[:12]
    return AnimaCard(
        archetype_symbol=archetype_symbol,
        element=element,
        inner_rhythm=inner_rhythm,
        emotional_intensity=emotional_intensity,
        travel_direction=travel_direction,
        keywords=keywords,
        dominant_frequency=word or inner_rhythm,
    )


_REASON = {
    "element_match": {
        "de": "Element spiegelt sich: {element}.",
        "en": "Element mirrors you: {element}.",
        "es": "El elemento se refleja: {element}.",
        "ru": "Стихия откликается: {element}.",
    },
    "element_contrast": {
        "de": "Element kontrastiert und kann klären.",
        "en": "Element contrasts and can clarify.",
        "es": "El elemento contrasta y puede aclarar.",
        "ru": "Стихия контрастирует и может прояснить.",
    },
    "archetype": {
        "de": "Archetyp oder Rhythmus berührt den Ort.",
        "en": "Archetype or rhythm touches this place.",
        "es": "El arquetipo o el ritmo toca este lugar.",
        "ru": "Архетип или ритм касается этого места.",
    },
    "intensity": {
        "de": "Intensität passt (±{delta}).",
        "en": "Intensity is close (±{delta}).",
        "es": "La intensidad encaja (±{delta}).",
        "ru": "Интенсивность близка (±{delta}).",
    },
    "frequency": {
        "de": "Frequenz klingt an: „{frequency}“.",
        "en": "Frequency echoes: “{frequency}”.",
        "es": "La frecuencia resuena: «{frequency}».",
        "ru": "Частота отзывается: «{frequency}».",
    },
    "keywords": {
        "de": "Schlüsselwörter treffen ({overlap}).",
        "en": "Keywords overlap ({overlap}).",
        "es": "Las palabras clave coinciden ({overlap}).",
        "ru": "Ключевые слова совпадают ({overlap}).",
    },
}


def _text(language: str, key: str, **values: object) -> str:
    template = _REASON[key].get(language, _REASON[key]["de"])
    return template.format(**values)


def score_place(place: Place, card: AnimaCard, language: str) -> tuple[int, list[ScoreReason]]:
    reasons: list[ScoreReason] = []

    def add(reason: ScoreReason) -> None:
        if len(reasons) < 4:
            reasons.append(reason)

    if place.element == card.element:
        element = 30
        add(ScoreReason(dimension="element", text=_text(language, "element_match", element=place.element), points=30))
    else:
        element = 10
        add(ScoreReason(dimension="element", text=_text(language, "element_contrast"), points=10))

    keyword_set = {item.casefold() for item in place.keywords}
    if card.archetype_symbol in keyword_set or card.inner_rhythm in keyword_set:
        archetype = 25
        add(ScoreReason(dimension="archetype", text=_text(language, "archetype"), points=25))
    else:
        archetype = 12

    delta = abs(place.intensity - card.emotional_intensity)
    intensity = max(0, 15 - delta * 3)
    if intensity >= 9:
        add(ScoreReason(dimension="intensity", text=_text(language, "intensity", delta=delta), points=intensity))

    hay = " · ".join([place.primaervibration, *place.secondaryFrequencies]).casefold()
    dominant = card.dominant_frequency.casefold()
    if dominant and dominant in hay:
        frequency = 20
        add(
            ScoreReason(
                dimension="frequency",
                text=_text(language, "frequency", frequency=card.dominant_frequency),
                points=20,
            )
        )
    else:
        frequency = 8

    overlap = sum(1 for keyword in card.keywords if keyword.casefold() in keyword_set)
    keywords = min(10, overlap * 2)
    if keywords:
        add(ScoreReason(dimension="keywords", text=_text(language, "keywords", overlap=overlap), points=keywords))

    return element + archetype + intensity + frequency + keywords, reasons


def match_places(places: list[Place], request: MatchRequest, *, limit: int = 3) -> MatchResponse:
    card = derive_anima_card(request.answers)
    ranked: list[tuple[int, str, Place, list[ScoreReason]]] = []
    for place in places:
        total, reasons = score_place(place, card, request.language)
        ranked.append((total, place.name.casefold(), place, reasons))
    ranked.sort(key=lambda item: (-item[0], item[1]))
    matches = [
        MatchedPlace(
            id=place.id,
            name=place.name,
            country=place.country,
            coordinates=place.coordinates,
            element=place.element,
            archetyp=place.archetyp,
            primaervibration=place.primaervibration,
            correspondence=place.correspondence,
            booking_link=f"/go/{place.id}",
            score=total,
            reasons=reasons,
        )
        for total, _name, place, reasons in ranked[:limit]
    ]
    return MatchResponse(anima_card=card, matches=matches)
