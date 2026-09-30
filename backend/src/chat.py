from collections.abc import Awaitable, Callable
from typing import Literal

from .atlas import Place
from .fallback import fallback_message, fallback_place_ids
from .llm import LlmCallError, complete_llm
from .models_chat import ChatMessage, ChatRequest, ChatResponse, LlmOutput, RecommendedPlace
from .prompts import build_system_prompt

LlmComplete = Callable[..., Awaitable[LlmOutput]]
ChatSource = Literal["llm", "fallback"]


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


def build_chat_response(
    *,
    content: str,
    place_ids: list[str],
    shown_place_ids: list[str],
    places: list[Place],
    source: ChatSource,
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
        )
        for place_id in new_ids
    ]
    return ChatResponse(
        message=ChatMessage(role="assistant", content=content),
        shown_place_ids=[*shown_place_ids, *new_ids],
        recommended_places=recommended,
        source=source,
        ai_disclosure=True,
    )


def fallback_response(request: ChatRequest, places: list[Place]) -> ChatResponse:
    place_ids = fallback_place_ids(request, places)
    by_id = {place.id: place for place in places}
    names = [by_id[place_id].name for place_id in place_ids if place_id in by_id]
    return build_chat_response(
        content=fallback_message(request.language, names),
        place_ids=place_ids,
        shown_place_ids=request.shown_place_ids,
        places=places,
        source="fallback",
    )


async def _llm_turn(
    llm: LlmComplete,
    request: ChatRequest,
    places: list[Place],
    *,
    strict: bool,
) -> LlmOutput | None:
    system_prompt = build_system_prompt(
        places,
        language=request.language,
        shown_place_ids=request.shown_place_ids,
        strict=strict,
    )
    try:
        output = await llm(system_prompt=system_prompt, messages=request.messages)
    except LlmCallError as exc:
        if exc.code == "LLM_RESPONSE_INVALID":
            return None
        raise
    if not place_ids_in_scope(output.place_ids, places):
        return None
    return output


async def handle_chat(
    request: ChatRequest,
    places: list[Place],
    *,
    complete: LlmComplete | None = None,
) -> ChatResponse:
    llm = complete if complete is not None else complete_llm
    try:
        output = await _llm_turn(llm, request, places, strict=False)
        if output is None:
            output = await _llm_turn(llm, request, places, strict=True)
    except LlmCallError:
        return fallback_response(request, places)

    if output is None:
        return fallback_response(request, places)

    return build_chat_response(
        content=output.message,
        place_ids=output.place_ids,
        shown_place_ids=request.shown_place_ids,
        places=places,
        source="llm",
    )
