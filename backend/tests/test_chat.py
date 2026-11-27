import asyncio

from src.atlas import PLACES
from src.chat import clip_message, handle_chat
from src.fallback import fallback_place_ids, score_place, tokenize
from src.llm import GROUP_OUTPUT_TOKENS, PLACE_OUTPUT_TOKENS, LlmCallError
from src.models_chat import ChatRequest, LlmOutput, RitualContext
from src.prompts import build_system_prompt, select_prompt_places


def _request(
    text: str = "Ich suche einen Ort mit height mountain",
    shown: list[str] | None = None,
    language: str = "de",
) -> ChatRequest:
    return ChatRequest(
        messages=[{"role": "user", "content": text}],
        shown_place_ids=shown or [],
        language=language,  # type: ignore[arg-type]
    )


def test_tokenize_and_score() -> None:
    tokens = tokenize("height, mountain!")
    assert "height" in tokens
    assert "mountain" in tokens
    mp = next(place for place in PLACES if place.id == "machu_picchu_pe")
    assert score_place(mp, tokens) >= 2


def test_fallback_keyword_prefers_matching_place() -> None:
    ids = fallback_place_ids(_request("height mountain"), PLACES)
    assert ids == ["machu_picchu_pe"]


def test_fallback_excludes_shown_place_ids() -> None:
    ids = fallback_place_ids(
        _request("height mountain", shown=["machu_picchu_pe"]),
        PLACES,
    )
    assert "machu_picchu_pe" not in ids


def test_fallback_zero_score_uses_sample() -> None:
    seen: list[list[str]] = []

    def fake_sample(pool: list[str], k: int) -> list[str]:
        seen.append(pool[:])
        return pool[:k]

    ids = fallback_place_ids(
        _request("zzzzzzzz"),
        PLACES,
        sample=fake_sample,
    )
    assert seen
    assert 1 <= len(ids) <= 2
    assert set(ids).issubset({place.id for place in PLACES})


def test_llm_success_returns_new_places_only() -> None:
    async def fake_llm(**_kwargs: object) -> LlmOutput:
        return LlmOutput(message="Machu Picchu ruft.", place_ids=["machu_picchu_pe"])

    response = asyncio.run(
        handle_chat(_request(shown=["sedona"]), PLACES, complete=fake_llm)
    )
    assert response.source == "llm"
    assert response.ai_disclosure is True
    assert response.message.role == "assistant"
    assert [place.id for place in response.recommended_places] == ["machu_picchu_pe"]
    assert response.recommended_places[0].booking_link == "/go/machu_picchu_pe"
    assert response.recommended_places[0].booking_url.startswith("https://www.booking.com/searchresults.")
    assert "aid=test-aid" in response.recommended_places[0].booking_url
    assert "label=soulmap" in response.recommended_places[0].booking_url
    assert response.shown_place_ids == ["sedona", "machu_picchu_pe"]


def test_scope_violation_then_valid_retry() -> None:
    calls: list[bool] = []

    async def fake_llm(*, system_prompt: str, **_kwargs: object) -> LlmOutput:
        calls.append("STRICT" in system_prompt)
        if "STRICT" not in system_prompt:
            return LlmOutput(message="Paris ist schön.", place_ids=["paris"])
        return LlmOutput(message="Dann Uluru.", place_ids=["uluru_au"])

    response = asyncio.run(handle_chat(_request(), PLACES, complete=fake_llm))
    assert calls == [False, True]
    assert response.source == "llm"
    assert [place.id for place in response.recommended_places] == ["uluru_au"]


def test_scope_violation_falls_back_after_retry() -> None:
    async def fake_llm(**_kwargs: object) -> LlmOutput:
        return LlmOutput(message="Paris.", place_ids=["paris"])

    response = asyncio.run(handle_chat(_request("Anden"), PLACES, complete=fake_llm))
    assert response.source == "fallback"
    assert response.recommended_places
    assert all(place.id in {p.id for p in PLACES} for place in response.recommended_places)


def test_long_assistant_message_is_clipped() -> None:
    async def fake_llm(**_kwargs: object) -> LlmOutput:
        return LlmOutput(message="Wort " * 2000, place_ids=["machu_picchu_pe"])

    response = asyncio.run(handle_chat(_request(), PLACES, complete=fake_llm))
    assert response.source == "llm"
    assert len(response.message.content) <= 4000
    assert response.message.content.endswith("…")
    assert clip_message("kurz") == "kurz"


def test_ritual_fallback_stays_on_element() -> None:
    request = ChatRequest(
        messages=[{"role": "user", "content": "Vertiefe die bereits empfohlenen Atlas-Orte"}],
        shown_place_ids=["mount_etna_it", "krakatoa_id"],
        from_ritual=True,
        ritual_context=RitualContext(
            archetype_symbol="triangle",
            element="fire",
            inner_rhythm="rise",
            emotional_intensity=7,
            travel_direction="outward",
            dominant_frequency="Aufbruch",
            matched_place_ids=["mount_etna_it", "krakatoa_id", "mauna_kea_us"],
            lines=["Wenn du heute ein Element wärst — welches? Feuer — unruhig, aufflackernd"],
        ),
    )
    ids = fallback_place_ids(request, PLACES)
    assert ids
    assert set(ids).isdisjoint({"mount_etna_it", "krakatoa_id"})
    elements = {place.element for place in PLACES if place.id in ids}
    assert elements == {"fire"}


def test_ritual_prompt_splits_detail_and_more_places() -> None:
    prompt = build_system_prompt(
        PLACES,
        language="de",
        shown_place_ids=["reykjavik_is"],
        from_ritual=True,
        ritual_context=RitualContext(
            archetype_symbol="triangle",
            element="fire",
            inner_rhythm="rise",
            emotional_intensity=7,
            travel_direction="outward",
            dominant_frequency="Aufbruch",
            matched_place_ids=["reykjavik_is"],
            lines=["Welcher Ort auf der Welt zieht dich ohne Erklärung an? Island, Vulkane"],
        ),
    )
    assert "empty place_ids list" in prompt
    assert "one place_notes entry for every matched place" in prompt
    assert "exactly one place_notes entry for that place" in prompt
    assert "Do not describe the other matched places." in prompt
    assert "3600 characters" in prompt
    assert "client prints the atlas name" in prompt
    assert "Island, Vulkane" in prompt
    assert "Allowed place_ids" not in prompt
    assert '"keywords"' not in prompt
    assert '"correspondence"' not in prompt
    assert '"element"' in prompt


def _ritual(**overrides: object) -> RitualContext:
    payload = {
        "archetype_symbol": "triangle",
        "element": "fire",
        "inner_rhythm": "rise",
        "emotional_intensity": 7,
        "travel_direction": "outward",
        "dominant_frequency": "Aufbruch",
        "matched_place_ids": ["machu_picchu_pe"],
        "lines": ["Feuer"],
    }
    payload.update(overrides)
    return RitualContext.model_validate(payload)


def test_place_catalog_keeps_only_the_requested_place() -> None:
    request = ChatRequest(
        messages=[{"role": "user", "content": "Vertiefe nur diesen Ort."}],
        from_ritual=True,
        prompt_catalog="place",
        focus_place_id="machu_picchu_pe",
        ritual_context=_ritual(),
    )
    chosen = select_prompt_places(PLACES, request)
    assert [place.id for place in chosen] == ["machu_picchu_pe"]
    prompt = build_system_prompt(
        chosen,
        language="de",
        shown_place_ids=[],
        ritual_context=request.ritual_context,
        from_ritual=True,
    )
    assert "machu_picchu_pe" in prompt
    assert "uluru_au" not in prompt


def test_element_catalog_keeps_the_ritual_element_and_matches() -> None:
    matched = next(place for place in PLACES if place.element != "fire")
    left_out = next(place for place in PLACES if place.element != "fire" and place.id != matched.id)
    request = ChatRequest(
        messages=[{"role": "user", "content": "Schlage weitere Orte vor."}],
        from_ritual=True,
        prompt_catalog="element",
        ritual_context=_ritual(matched_place_ids=[matched.id]),
    )
    chosen = select_prompt_places(PLACES, request)
    ids = {place.id for place in chosen}
    fire_ids = {place.id for place in PLACES if place.element == "fire"}
    assert fire_ids <= ids
    assert matched.id in ids
    assert left_out.id not in ids
    assert len(chosen) < len(PLACES)


def test_one_place_turn_caps_output_tokens() -> None:
    seen: dict[str, object] = {}

    async def fake_llm(**kwargs: object) -> LlmOutput:
        seen.update(kwargs)
        return LlmOutput(
            message="Früh auf den Berg.",
            place_ids=[],
            overview="",
            place_notes=[{"place_id": "machu_picchu_pe", "text": "Früh auf den Berg."}],
        )

    request = ChatRequest(
        messages=[{"role": "user", "content": "Vertiefe nur diesen Ort."}],
        from_ritual=True,
        prompt_catalog="place",
        focus_place_id="machu_picchu_pe",
        ritual_context=_ritual(element="earth"),
    )
    response = asyncio.run(handle_chat(request, PLACES, complete=fake_llm))
    assert response.source == "llm"
    assert seen["max_tokens"] == PLACE_OUTPUT_TOKENS
    assert "uluru_au" not in str(seen["system_prompt"])


def test_element_turn_keeps_room_for_several_notes() -> None:
    seen: dict[str, object] = {}

    async def fake_llm(**kwargs: object) -> LlmOutput:
        seen.update(kwargs)
        return LlmOutput(message="Zwei Orte.", place_ids=["mount_etna_it"])

    request = ChatRequest(
        messages=[{"role": "user", "content": "Schlage weitere Orte vor."}],
        from_ritual=True,
        prompt_catalog="element",
        ritual_context=_ritual(),
    )
    asyncio.run(handle_chat(request, PLACES, complete=fake_llm))
    assert seen["max_tokens"] == GROUP_OUTPUT_TOKENS


def test_place_notes_take_headings_from_the_atlas() -> None:
    async def fake_llm(**_kwargs: object) -> LlmOutput:
        return LlmOutput(
            message="Anreise über Lima. Früh auf den Berg.",
            place_ids=[],
            overview="Anreise über Lima.",
            place_notes=[
                {"place_id": "machu_picchu_pe", "text": "Früh auf den Berg."},
                {"place_id": "machu_picchu_pe", "text": "Dieser zweite Hinweis fällt weg."},
            ],
        )

    response = asyncio.run(handle_chat(_request(shown=["machu_picchu_pe"]), PLACES, complete=fake_llm))
    assert response.source == "llm"
    assert response.recommended_places == []
    assert [section.kind for section in response.sections] == ["overview", "place"]
    place = response.sections[1]
    atlas = next(item for item in PLACES if item.id == "machu_picchu_pe")
    assert place.place_id == "machu_picchu_pe"
    assert place.name == atlas.name
    assert place.country == atlas.country
    assert place.primaervibration == atlas.primaervibration
    assert place.text == "Früh auf den Berg."
    assert "Machu Picchu" not in place.text


def test_unknown_place_note_falls_back_after_retry() -> None:
    async def fake_llm(**_kwargs: object) -> LlmOutput:
        return LlmOutput(
            message="Paris.",
            place_ids=[],
            place_notes=[{"place_id": "paris", "text": "Abendlicht."}],
        )

    response = asyncio.run(handle_chat(_request("Anden"), PLACES, complete=fake_llm))
    assert response.source == "fallback"
    assert response.sections == []


def test_timeout_uses_fallback() -> None:
    async def fake_llm(**_kwargs: object) -> LlmOutput:
        raise LlmCallError("OPENAI_TIMEOUT")

    response = asyncio.run(handle_chat(_request("height mountain"), PLACES, complete=fake_llm))
    assert response.source == "fallback"
    assert "nicht erreichbar" in response.message.content
    assert [place.id for place in response.recommended_places][0] == "machu_picchu_pe"
