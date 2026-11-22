import zlib
from math import asin, cos, radians, sin, sqrt
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from .atlas import Coordinates, Place
from .booking import booking_search_url
from .facets import FACETS
from .fallback import tokenize

SYMBOLS = ("circle", "triangle", "cross", "rhombus", "spiral")
RHYTHMS = ("rise", "descent", "circle", "threshold", "pause")
ELEMENTS = ("fire", "water", "earth", "air", "aether")
LANDSCAPES = ("plain", "mountain", "forest", "coast", "city")
MOODS = ("decision", "missing", "longing", "silence", "departure")
MOTIONS = ("wander", "climb", "swim", "still")

Language = Literal["de", "en", "es", "ru"]


class MatchAnswers(BaseModel):
    model_config = ConfigDict(extra="forbid")

    q0: int = Field(ge=0, le=4)
    q1: int = Field(ge=0, le=4)
    q2: int = Field(ge=0, le=4)
    q3: int = Field(ge=0, le=4)
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
    booking_url: str = ""
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


_ELEMENT_MATCH = 40
_ELEMENT_CONTRAST = 8
_LANDSCAPE_POINTS = 24
_QUESTION_POINTS = 12
_WORD_POINTS = 8

_HINT_GROUPS = (
    (frozenset({"island", "iceland", "islandia", "исландия"}), frozenset({"iceland", "reykjavik"})),
    (
        frozenset({"vulkan", "vulkane", "volcano", "volcan", "volcán", "вулкан", "вулканы"}),
        frozenset({"volcano", "lava", "eruption"}),
    ),
    (
        frozenset({"atlantik", "atlantikküste", "atlantikkuste", "atlantic", "atlantico", "atlántico"}),
        frozenset({"atlantic", "atlantean", "ocean", "oceans"}),
    ),
    (frozenset({"wüste", "wueste", "desert", "desierto", "пустыня"}), frozenset({"desert"})),
    (frozenset({"dschungel", "jungle", "selva"}), frozenset({"jungle"})),
    (frozenset({"wald", "forest", "bosque", "лес"}), frozenset({"jungle", "forest"})),
    (
        frozenset({"meer", "küste", "kueste", "coast", "costa", "море"}),
        frozenset({"sea", "ocean", "oceans", "island", "tide", "coast"}),
    ),
    (
        frozenset({"berg", "gipfel", "mountain", "montana", "montaña", "гора"}),
        frozenset({"mountain", "height", "volcano", "mount"}),
    ),
    (frozenset({"hochebene", "plateau", "altiplano"}), frozenset({"plateau", "sky"})),
    (frozenset({"stille", "silence", "silencio", "тишина"}), frozenset({"silence"})),
    (frozenset({"heimkehr", "return", "regreso"}), frozenset({"origin", "ancestor", "center"})),
    (
        frozenset({"schwelle", "umbral", "threshold", "порог"}),
        frozenset({"threshold", "passage", "gate", "bridge", "crossroads"}),
    ),
    (frozenset({"aufbruch"}), frozenset({"renewal", "transformation", "ascent"})),
)


_GENERIC_NAME_TOKENS = frozenset(
    {
        "archipelago",
        "cape",
        "city",
        "gate",
        "lake",
        "mount",
        "node",
        "plateau",
        "river",
        "rock",
        "saint",
        "tor",
        "triangle",
        "vertex",
    }
)


_TEXT_FACETS = (
    (frozenset({"schwelle", "umbral", "threshold", "порог"}), "rhythm", "threshold"),
    (frozenset({"stille", "silence", "silencio", "тишина"}), "mood", "silence"),
    (frozenset({"aufbruch"}), "mood", "departure"),
    (frozenset({"heimkehr", "return", "regreso"}), "rhythm", "circle"),
    (frozenset({"wald", "dschungel", "jungle", "selva", "forest", "bosque", "лес"}), "landscape", "forest"),
    (frozenset({"berg", "gipfel", "mountain", "montana", "montaña", "гора"}), "landscape", "mountain"),
    (
        frozenset({"wüste", "wueste", "desert", "desierto", "пустыня", "hochebene", "plateau", "ebene", "plain"}),
        "landscape",
        "plain",
    ),
    (
        frozenset({"küste", "kueste", "atlantik", "atlantikküste", "atlantikkuste", "coast", "costa", "море"}),
        "landscape",
        "coast",
    ),
    (frozenset({"stadt", "city", "ciudad"}), "landscape", "city"),
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
    "place": {
        "de": "Dein genannter Ort klingt hier an.",
        "en": "The place you named echoes here.",
        "es": "El lugar que nombraste resuena aquí.",
        "ru": "Названное место отзывается здесь.",
    },
    "landscape": {
        "de": "Landschaft trifft deine Wahl.",
        "en": "Landscape matches what you chose.",
        "es": "El paisaje coincide con lo que elegiste.",
        "ru": "Пейзаж совпадает с твоим выбором.",
    },
    "rhythm": {
        "de": "Rhythmus trifft deine Bewegung.",
        "en": "Rhythm matches your movement.",
        "es": "El ritmo coincide con tu movimiento.",
        "ru": "Ритм совпадает с твоим движением.",
    },
    "mood": {
        "de": "Stimmung trifft, was dich nicht loslässt.",
        "en": "Mood matches what stays with you.",
        "es": "El ánimo coincide con lo que no te suelta.",
        "ru": "Настроение совпадает с тем, что не отпускает.",
    },
    "symbol": {
        "de": "Symbol trifft deine Form.",
        "en": "Symbol matches your form.",
        "es": "El símbolo coincide con tu forma.",
        "ru": "Символ совпадает с твоей формой.",
    },
    "motion": {
        "de": "Körper trifft diese Bewegung.",
        "en": "The body matches this movement.",
        "es": "El cuerpo coincide con este movimiento.",
        "ru": "Тело совпадает с этим движением.",
    },
    "word": {
        "de": "Dein Wort klingt hier an.",
        "en": "Your word echoes here.",
        "es": "Tu palabra resuena aquí.",
        "ru": "Твоё слово отзывается здесь.",
    },
    "proximity": {
        "de": "Liegt am nächsten zu deiner Angabe.",
        "en": "Closest to what you named.",
        "es": "Es el lugar más cercano a lo que nombraste.",
        "ru": "Ближе всего к тому, что ты назвал.",
    },
    "direction": {
        "de": "Liegt in der genannten Himmelsrichtung.",
        "en": "Lies in the direction you named.",
        "es": "Está en la dirección que nombraste.",
        "ru": "Лежит в названном направлении.",
    },
}


_ELEMENT_NAMES = {
    "de": {"fire": "Feuer", "water": "Wasser", "earth": "Erde", "air": "Luft", "aether": "Äther"},
    "en": {"fire": "Fire", "water": "Water", "earth": "Earth", "air": "Air", "aether": "Aether"},
    "es": {"fire": "fuego", "water": "agua", "earth": "tierra", "air": "aire", "aether": "éter"},
    "ru": {"fire": "огонь", "water": "вода", "earth": "земля", "air": "воздух", "aether": "эфир"},
}


def _text(language: str, key: str, **values: object) -> str:
    if "element" in values:
        raw = str(values["element"])
        names = _ELEMENT_NAMES.get(language, _ELEMENT_NAMES["de"])
        values = {**values, "element": names.get(raw, raw)}
    template = _REASON[key].get(language, _REASON[key]["de"])
    return template.format(**values)


def _tie_key(place_id: str, answers: MatchAnswers) -> int:
    blob = "|".join(
        (
            str(answers.q0),
            str(answers.q1),
            str(answers.q2),
            str(answers.q3),
            str(answers.q4),
            str(answers.q5),
            answers.q6,
            answers.q7,
            place_id,
        )
    )
    return zlib.crc32(blob.encode())


def _facet_hits(place: Place, answers: MatchAnswers) -> list[tuple[str, int]]:
    facet = FACETS.get(place.id)
    if facet is None:
        return []
    chosen = (
        ("landscape", LANDSCAPES[answers.q0], _LANDSCAPE_POINTS),
        ("rhythm", RHYTHMS[answers.q1], _QUESTION_POINTS),
        ("mood", MOODS[answers.q2], _QUESTION_POINTS),
        ("symbol", SYMBOLS[answers.q4], _QUESTION_POINTS),
        ("motion", MOTIONS[answers.q5], _QUESTION_POINTS),
    )
    hits = [(key, points) for key, value, points in chosen if facet[key] == value]
    covered = {key for key, _points in hits}
    tokens = set(tokenize(f"{answers.q6} {answers.q7}"))
    for triggers, key, value in _TEXT_FACETS:
        if key in covered or not tokens & triggers or facet[key] != value:
            continue
        hits.append(("word", _WORD_POINTS))
        break
    return hits


def score_place(
    place: Place,
    card: AnimaCard,
    language: str,
    answers: MatchAnswers,
) -> tuple[int, list[ScoreReason]]:
    reasons: list[ScoreReason] = []
    if place.element == card.element:
        element = _ELEMENT_MATCH
        reasons.append(
            ScoreReason(
                dimension="element",
                text=_text(language, "element_match", element=place.element),
                points=element,
            )
        )
    else:
        element = _ELEMENT_CONTRAST
        reasons.append(
            ScoreReason(dimension="element", text=_text(language, "element_contrast"), points=element)
        )

    hits = _facet_hits(place, answers)
    for key, points in hits:
        reasons.append(ScoreReason(dimension=key, text=_text(language, key), points=points))
    return element + sum(points for _key, points in hits), reasons


_GEO_ANCHOR = 200
_NORTH_LAT = 50.0
_SOUTH_LAT = -10.0
_EAST_LNG = 60.0
_WEST_LNG = -30.0

_DIRECTION_WORDS = {
    "norden": "north",
    "nord": "north",
    "nördlich": "north",
    "nordlich": "north",
    "north": "north",
    "northern": "north",
    "norte": "north",
    "север": "north",
    "севере": "north",
    "северный": "north",
    "северная": "north",
    "süden": "south",
    "sueden": "south",
    "süd": "south",
    "sued": "south",
    "südlich": "south",
    "sudlich": "south",
    "south": "south",
    "southern": "south",
    "sur": "south",
    "юг": "south",
    "юге": "south",
    "южный": "south",
    "osten": "east",
    "ost": "east",
    "östlich": "east",
    "ostlich": "east",
    "east": "east",
    "eastern": "east",
    "este": "east",
    "восток": "east",
    "востоке": "east",
    "восточный": "east",
    "westen": "west",
    "west": "west",
    "westlich": "west",
    "western": "west",
    "oeste": "west",
    "запад": "west",
    "западе": "west",
    "западный": "west",
}
_FILLER = frozenset(
    {
        "a",
        "an",
        "and",
        "das",
        "de",
        "del",
        "dem",
        "den",
        "der",
        "die",
        "direccion",
        "dirección",
        "direction",
        "ein",
        "eine",
        "einer",
        "el",
        "hacia",
        "im",
        "in",
        "к",
        "la",
        "las",
        "los",
        "на",
        "oder",
        "of",
        "or",
        "richtung",
        "the",
        "to",
        "toward",
        "towards",
        "und",
        "в",
        "von",
        "y",
        "zum",
        "zur",
    }
)
_MODIFIER = frozenset(
    {
        "deep",
        "eher",
        "extrem",
        "extreme",
        "far",
        "fern",
        "ferner",
        "ganz",
        "high",
        "hoch",
        "hohe",
        "hohem",
        "hohen",
        "hoher",
        "irgendwo",
        "lower",
        "quite",
        "sehr",
        "somewhere",
        "tief",
        "tiefen",
        "upper",
        "weit",
    }
)
_MOOD_TOKENS = frozenset(
    {
        "calor",
        "clima",
        "climate",
        "cold",
        "dunkel",
        "dunkelheit",
        "fog",
        "frio",
        "frío",
        "hell",
        "helles",
        "kalt",
        "kalte",
        "kaltes",
        "klima",
        "климат",
        "licht",
        "light",
        "luz",
        "nebel",
        "neblig",
        "rain",
        "regen",
        "schnee",
        "свет",
        "snow",
        "sol",
        "sonne",
        "sonnig",
        "sun",
        "tropical",
        "tropen",
        "tropisch",
        "warm",
        "warme",
        "warmes",
        "wind",
    }
)
_COUNTRY_ALIASES = {
    "island": "iceland",
    "islandia": "iceland",
    "исландия": "iceland",
}
_GEO_GENERIC = _GENERIC_NAME_TOKENS | {"mountain", "mountains", "republic", "kingdom"}
_NO_LOOKUP = frozenset(token for triggers, _targets in _HINT_GROUPS for token in triggers) | _MOOD_TOKENS
_Ranked = tuple[int, int, int, Place, list[ScoreReason]]


def _direction_phrase(text: str) -> str | None:
    tokens = tokenize(text)
    if not tokens:
        return None
    found: set[str] = set()
    for token in tokens:
        if token in _FILLER or token in _MODIFIER:
            continue
        direction = _DIRECTION_WORDS.get(token)
        if direction is None:
            return None
        found.add(direction)
    if len(found) != 1:
        return None
    return found.pop()


def _phrase_in(phrase: str, blob: str) -> bool:
    if len(phrase) < 3:
        return False
    start = 0
    while True:
        index = blob.find(phrase, start)
        if index < 0:
            return False
        end = index + len(phrase)
        before = blob[index - 1] if index else " "
        after = blob[end] if end < len(blob) else " "
        if not before.isalnum() and not after.isalnum():
            return True
        start = index + 1


def _atlas_hits(raw: str, places: list[Place]) -> list[Place]:
    user_tokens = set(tokenize(raw))
    blob = raw.casefold()
    hits: list[Place] = []
    for place in places:
        name_tokens = {
            token
            for token in set(tokenize(place.name)) - _GENERIC_NAME_TOKENS
            if len(token) >= 4 or (len(token) >= 3 and len(tokenize(place.name)) == 1)
        }
        country_tokens = {
            token for token in set(tokenize(place.country)) - _GEO_GENERIC if len(token) >= 4
        }
        aliased = {_COUNTRY_ALIASES.get(token, token) for token in user_tokens}
        if (
            _phrase_in(place.name.casefold(), blob)
            or _phrase_in(place.country.casefold(), blob)
            or (name_tokens & user_tokens)
            or (country_tokens & user_tokens)
            or (country_tokens & aliased)
        ):
            hits.append(place)
    return hits


def q7_lookup_query(text: str, places: list[Place]) -> str | None:
    stripped = text.strip()
    if not stripped or _direction_phrase(stripped):
        return None
    hits = _atlas_hits(stripped, places)
    if len(hits) == 1:
        return None
    if len(hits) > 1:
        return stripped
    content = [token for token in tokenize(stripped) if len(token) >= 3]
    if content and all(token in _NO_LOOKUP for token in content):
        return None
    return stripped


def _distance_km(origin: Coordinates, place: Place) -> float:
    lat1 = radians(origin.lat)
    lat2 = radians(place.coordinates.lat)
    dlat = radians(place.coordinates.lat - origin.lat)
    dlng = radians(place.coordinates.lng - origin.lng)
    haversine = sin(dlat / 2) ** 2 + cos(lat1) * cos(lat2) * sin(dlng / 2) ** 2
    return 2 * 6371.0 * asin(sqrt(min(1.0, haversine)))


def _direction_pool(places: list[Place], direction: str) -> list[Place]:
    predicates = {
        "north": lambda place: place.coordinates.lat >= _NORTH_LAT,
        "south": lambda place: place.coordinates.lat <= _SOUTH_LAT,
        "east": lambda place: place.coordinates.lng >= _EAST_LNG,
        "west": lambda place: place.coordinates.lng <= _WEST_LNG,
    }
    pool = [place for place in places if predicates[direction](place)]
    if len(pool) >= 3:
        return pool
    axis = {
        "north": lambda place: place.coordinates.lat,
        "south": lambda place: -place.coordinates.lat,
        "east": lambda place: place.coordinates.lng,
        "west": lambda place: -place.coordinates.lng,
    }[direction]
    return sorted(places, key=axis, reverse=True)[:3]


def _nearest(candidates: list[Place], origin: Coordinates, ranked: list[_Ranked]) -> Place:
    order = {item[3].id: index for index, item in enumerate(ranked)}
    return min(
        candidates,
        key=lambda place: (_distance_km(origin, place), order[place.id], place.name.casefold()),
    )


def _pin(item: _Ranked, language: str, key: str, bonus: int) -> _Ranked:
    total, hint, name, place, reasons = item
    if any(reason.dimension == key for reason in reasons):
        return item
    reason = ScoreReason(dimension=key, text=_text(language, key), points=bonus)
    return total + bonus, hint, name, place, [reason, *reasons][:4]


def _anchor(
    hits: list[Place],
    places: list[Place],
    located: Coordinates | None,
    ranked: list[_Ranked],
) -> Place | None:
    if len(hits) == 1:
        return hits[0]
    if len(hits) > 1:
        if located is not None:
            return _nearest(hits, located, ranked)
        hit_ids = {place.id for place in hits}
        return next(item[3] for item in ranked if item[3].id in hit_ids)
    if located is not None:
        return _nearest(places, located, ranked)
    return None


def _select_ranked(
    ranked: list[_Ranked],
    places: list[Place],
    request: MatchRequest,
    located: Coordinates | None,
    limit: int,
) -> list[_Ranked]:
    text = request.answers.q7
    hits = _atlas_hits(text, places)
    direction = _direction_phrase(text)
    if direction and not hits:
        pool = {place.id for place in _direction_pool(places, direction)}
        chosen = [item for item in ranked if item[3].id in pool]
        return [_pin(item, request.language, "direction", 0) for item in chosen[:limit]]
    anchor = _anchor(hits, places, located, ranked)
    if anchor is None:
        return ranked[:limit]
    pinned = [
        _pin(item, request.language, "proximity", _GEO_ANCHOR) if item[3].id == anchor.id else item
        for item in ranked
    ]
    pinned.sort(key=lambda item: (-item[0], -item[1], item[2]))
    return pinned[:limit]


def match_places(
    places: list[Place],
    request: MatchRequest,
    *,
    limit: int = 3,
    located: Coordinates | None = None,
) -> MatchResponse:
    card = derive_anima_card(request.answers)
    ranked: list[_Ranked] = []
    for place in places:
        total, reasons = score_place(place, card, request.language, request.answers)
        hits = sum(1 for reason in reasons if reason.dimension != "element")
        ranked.append((total, hits, _tie_key(place.id, request.answers), place, reasons))
    ranked.sort(key=lambda item: (-item[0], -item[1], item[2]))
    selected = _select_ranked(ranked, places, request, located, limit)
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
            booking_url=booking_search_url(place, request.language),
            score=total,
            reasons=reasons,
        )
        for total, _hint, _name, place, reasons in selected
    ]
    return MatchResponse(anima_card=card, matches=matches)
