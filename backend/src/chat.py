import time
from collections.abc import Awaitable, Callable
from dataclasses import dataclass
from typing import Literal

from .atlas import Place
from .booking import booking_search_url
from .fallback import fallback_message, fallback_place_ids
from .place_i18n import localized_name
from .llm import LlmCallError, complete_llm, output_token_cap, pop_llm_usage
from .models_chat import (
    MAX_MESSAGE_LENGTH,
    ChatMessage,
    ChatRequest,
    ChatResponse,
    ChatSection,
    LlmOutput,
    PlaceNote,
    RecommendedPlace,
)
from .prompts import build_system_prompt, select_prompt_places

LlmComplete = Callable[..., Awaitable[LlmOutput]]
ChatSource = Literal["llm", "fallback"]


@dataclass
class ChatTrace:
    source: ChatSource
    error_code: str | None = None
    latency_ms: int | None = None
    input_tokens: int | None = None
    output_tokens: int | None = None


def unique_preserve(values: list[str]) -> list[str]:
    seen: set[str] = set()
    result: list[str] = []
    for value in values:
        if value in seen:
            continue
        seen.add(value)
        result.append(value)
    return result


def place_ids_in_scope(place_ids: list[str], places: list[Place]) -> bool:
    known = {place.id for place in places}
    return all(place_id in known for place_id in place_ids)


def place_notes_in_scope(notes: list[PlaceNote], places: list[Place]) -> bool:
    known = {place.id for place in places}
    return all(note.place_id in known for note in notes)


def build_sections(
    *,
    overview: str,
    place_notes: list[PlaceNote],
    places: list[Place],
) -> list[ChatSection]:
    by_id = {place.id: place for place in places}
    sections: list[ChatSection] = []
    shared = clip_message(overview)
    if shared:
        sections.append(ChatSection(kind="overview", text=shared))
    seen: set[str] = set()
    for note in place_notes:
        if note.place_id in seen or note.place_id not in by_id:
            continue
        seen.add(note.place_id)
        place = by_id[note.place_id]
        sections.append(
            ChatSection(
                kind="place",
                text=clip_message(note.text),
                place_id=place.id,
                name=place.name,
                country=place.country,
                primaervibration=place.primaervibration,
            )
        )
    return sections


def clip_message(content: str) -> str:
    text = content.strip()
    if len(text) <= MAX_MESSAGE_LENGTH:
        return text
    limit = MAX_MESSAGE_LENGTH - 1
    clipped = text[:limit]
    if " " in clipped:
        clipped = clipped.rsplit(" ", 1)[0]
    clipped = clipped.rstrip(" ,;:-")
    if not clipped:
        clipped = text[:limit]
    return f"{clipped}…"


def build_chat_response(
    *,
    content: str,
    place_ids: list[str],
    shown_place_ids: list[str],
    places: list[Place],
    source: ChatSource,
    overview: str = "",
    place_notes: list[PlaceNote] | None = None,
    language: str = "de",
) -> ChatResponse:
    by_id = {place.id: place for place in places}
    already = set(shown_place_ids)
    new_ids = [
        place_id
        for place_id in unique_preserve(place_ids)
        if place_id in by_id and place_id not in already
    ]
    recommended = [
        RecommendedPlace(
            id=place_id,
            name=by_id[place_id].name,
            booking_link=f"/go/{place_id}",
            booking_url=booking_search_url(by_id[place_id], language),
            country=by_id[place_id].country,
            coordinates={
                "lat": by_id[place_id].coordinates.lat,
                "lng": by_id[place_id].coordinates.lng,
            },
            primaervibration=by_id[place_id].primaervibration,
            correspondence=by_id[place_id].correspondence,
        )
        for place_id in new_ids
    ]
    return ChatResponse(
        message=ChatMessage(role="assistant", content=clip_message(content)),
        shown_place_ids=[*shown_place_ids, *new_ids],
        recommended_places=recommended,
        sections=build_sections(
            overview=overview,
            place_notes=place_notes or [],
            places=places,
        ),
        source=source,
        ai_disclosure=True,
    )


def fallback_response(request: ChatRequest, places: list[Place]) -> ChatResponse:
    place_ids = fallback_place_ids(request, places)
    by_id = {place.id: place for place in places}
    names = [localized_name(request.language, by_id[place_id]) for place_id in place_ids if place_id in by_id]
    return build_chat_response(
        content=fallback_message(request.language, names),
        place_ids=place_ids,
        shown_place_ids=request.shown_place_ids,
        places=places,
        source="fallback",
        language=request.language,
    )


async def _llm_turn(
    llm: LlmComplete,
    request: ChatRequest,
    places: list[Place],
    *,
    strict: bool,
) -> LlmOutput | None:
    chosen = select_prompt_places(places, request)
    system_prompt = build_system_prompt(
        chosen,
        language=request.language,
        shown_place_ids=request.shown_place_ids,
        ritual_context=request.ritual_context,
        from_ritual=request.from_ritual,
        strict=strict,
    )
    try:
        output = await llm(
            system_prompt=system_prompt,
            messages=request.messages,
            max_tokens=output_token_cap(len(chosen)),
        )
    except LlmCallError as exc:
        if exc.code == "LLM_RESPONSE_INVALID":
            return None
        raise
    if not place_ids_in_scope(output.place_ids, places) or not place_notes_in_scope(
        output.place_notes, places
    ):
        return None
    return output


async def run_chat(
    request: ChatRequest,
    places: list[Place],
    *,
    complete: LlmComplete | None = None,
) -> tuple[ChatResponse, ChatTrace]:
    llm = complete if complete is not None else complete_llm
    started = time.perf_counter()
    error_code: str | None = None
    try:
        output = await _llm_turn(llm, request, places, strict=False)
        if output is None:
            output = await _llm_turn(llm, request, places, strict=True)
            if output is None:
                error_code = "LLM_RESPONSE_INVALID"
    except LlmCallError as exc:
        error_code = exc.code
        output = None

    latency_ms = int((time.perf_counter() - started) * 1000)
    usage = pop_llm_usage()

    if output is None:
        return fallback_response(request, places), ChatTrace(
            source="fallback",
            error_code=error_code,
            latency_ms=latency_ms,
        )

    return (
        build_chat_response(
            content=output.message,
            place_ids=output.place_ids,
            shown_place_ids=request.shown_place_ids,
            places=places,
            source="llm",
            overview=output.overview,
            place_notes=output.place_notes,
            language=request.language,
        ),
        ChatTrace(
            source="llm",
            latency_ms=latency_ms,
            input_tokens=usage.get("input_tokens"),
            output_tokens=usage.get("output_tokens"),
        ),
    )


async def handle_chat(
    request: ChatRequest,
    places: list[Place],
    *,
    complete: LlmComplete | None = None,
) -> ChatResponse:
    response, _ = await run_chat(request, places, complete=complete)
    return response
