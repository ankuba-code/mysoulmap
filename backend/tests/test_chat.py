import asyncio

from src.atlas import PLACES
from src.chat import handle_chat
from src.fallback import fallback_place_ids, score_place, tokenize
from src.llm import LlmCallError
from src.models_chat import ChatRequest, LlmOutput


def _request(
    text: str = "Ich suche einen Ort in den Anden",
    shown: list[str] | None = None,
    language: str = "de",
) -> ChatRequest:
    return ChatRequest(
        messages=[{"role": "user", "content": text}],
        shown_place_ids=shown or [],
        language=language,  # type: ignore[arg-type]
    )


def test_tokenize_and_score() -> None:
    tokens = tokenize("Anden, Inka!")
    assert "anden" in tokens
    assert "inka" in tokens
    mp = next(place for place in PLACES if place.id == "mp")
    assert score_place(mp, tokens) >= 2


def test_fallback_keyword_prefers_matching_place() -> None:
    ids = fallback_place_ids(_request("Anden Inka Höhenwanderung"), PLACES)
    assert ids == ["mp"]


def test_fallback_excludes_shown_place_ids() -> None:
    ids = fallback_place_ids(
        _request("Anden Inka", shown=["mp"]),
        PLACES,
    )
    assert "mp" not in ids


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
        return LlmOutput(message="Machu Picchu ruft.", place_ids=["mp"])

    response = asyncio.run(
        handle_chat(_request(shown=["sedona"]), PLACES, complete=fake_llm)
    )
    assert response.source == "llm"
    assert response.ai_disclosure is True
    assert response.message.role == "assistant"
    assert [place.id for place in response.recommended_places] == ["mp"]
    assert response.recommended_places[0].booking_link == "/go/mp"
    assert response.shown_place_ids == ["sedona", "mp"]


def test_scope_violation_then_valid_retry() -> None:
    calls: list[bool] = []

    async def fake_llm(*, system_prompt: str, **_kwargs: object) -> LlmOutput:
        calls.append("STRICT" in system_prompt)
        if "STRICT" not in system_prompt:
            return LlmOutput(message="Paris ist schön.", place_ids=["paris"])
        return LlmOutput(message="Dann Sedona.", place_ids=["sedona"])

    response = asyncio.run(handle_chat(_request(), PLACES, complete=fake_llm))
    assert calls == [False, True]
    assert response.source == "llm"
    assert [place.id for place in response.recommended_places] == ["sedona"]


def test_scope_violation_falls_back_after_retry() -> None:
    async def fake_llm(**_kwargs: object) -> LlmOutput:
        return LlmOutput(message="Paris.", place_ids=["paris"])

    response = asyncio.run(handle_chat(_request("Anden"), PLACES, complete=fake_llm))
    assert response.source == "fallback"
    assert response.recommended_places
    assert all(place.id in {p.id for p in PLACES} for place in response.recommended_places)


def test_timeout_uses_fallback() -> None:
    async def fake_llm(**_kwargs: object) -> LlmOutput:
        raise LlmCallError("OPENAI_TIMEOUT")

    response = asyncio.run(handle_chat(_request("Anden Inka"), PLACES, complete=fake_llm))
    assert response.source == "fallback"
    assert "nicht erreichbar" in response.message.content
    assert [place.id for place in response.recommended_places][0] == "mp"
