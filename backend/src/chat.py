import time
from collections.abc import Awaitable, Callable
from dataclasses import dataclass
from typing import Literal

from .atlas import Place
from .fallback import fallback_message, fallback_place_ids
from .llm import LlmCallError, complete_llm, pop_llm_usage
from .models_chat import ChatMessage, ChatRequest, ChatResponse, LlmOutput, RecommendedPlace
from .prompts import build_system_prompt

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
        ritual_context=request.ritual_context,
        from_ritual=request.from_ritual,
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
