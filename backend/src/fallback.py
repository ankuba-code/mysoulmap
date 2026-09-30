import random
import re
from collections.abc import Callable

from .atlas import Place
from .models_chat import ChatRequest

_WORD_RE = re.compile(r"[^\w]+", flags=re.UNICODE)

FALLBACK_WITH_PLACES = {
    "de": "Unser KI-Assistent ist gerade nicht erreichbar. Basierend auf deiner Anfrage empfehlen wir dir: {names}.",
    "en": "Our AI assistant is currently unavailable. Based on your request we recommend: {names}.",
    "es": "Nuestro asistente de IA no está disponible en este momento. Según tu consulta te recomendamos: {names}.",
    "ru": "Наш ИИ-ассистент сейчас недоступен. На основе твоего запроса мы рекомендуем: {names}.",
}

FALLBACK_WITHOUT_PLACES = {
    "de": "Unser KI-Assistent ist gerade nicht erreichbar. Bitte versuche es in einem Moment erneut.",
    "en": "Our AI assistant is currently unavailable. Please try again in a moment.",
    "es": "Nuestro asistente de IA no está disponible en este momento. Inténtalo de nuevo en un momento.",
    "ru": "Наш ИИ-ассистент сейчас недоступен. Пожалуйста, попробуй ещё раз чуть позже.",
}


def tokenize(text: str) -> list[str]:
    cleaned = _WORD_RE.sub(" ", text.casefold())
    return [token for token in cleaned.split() if token]


def score_place(place: Place, user_tokens: list[str]) -> int:
    field_text = " ".join(
        [
            *place.keywords,
            place.element,
            place.archetyp,
            place.correspondence,
        ]
    )
    place_tokens = set(tokenize(field_text))
    return sum(1 for token in user_tokens if token in place_tokens)


def fallback_place_ids(
    request: ChatRequest,
    places: list[Place],
    *,
    sample: Callable[[list[str], int], list[str]] | None = None,
) -> list[str]:
    shown = set(request.shown_place_ids)
    remaining = [place for place in places if place.id not in shown]
    if not remaining:
        return []

    user_text = " ".join(
        message.content for message in request.messages if message.role == "user"
    )
    user_tokens = tokenize(user_text)
    ranked = sorted(
        remaining,
        key=lambda place: (-score_place(place, user_tokens), place.id),
    )
    matched = [
        place.id
        for place in ranked
        if score_place(place, user_tokens) > 0
    ][:2]
    if matched:
        return matched

    ids = [place.id for place in remaining]
    picker = sample if sample is not None else (lambda pool, k: random.sample(pool, k))
    return picker(ids, min(2, len(ids)))


def fallback_message(language: str, place_names: list[str]) -> str:
    if place_names:
        template = FALLBACK_WITH_PLACES.get(language, FALLBACK_WITH_PLACES["de"])
        return template.format(names=", ".join(place_names))
    return FALLBACK_WITHOUT_PLACES.get(language, FALLBACK_WITHOUT_PLACES["de"])
