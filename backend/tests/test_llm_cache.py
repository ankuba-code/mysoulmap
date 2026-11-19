import asyncio

from src.llm import PROMPT_CACHE_KEY, complete_llm
from src.models_chat import ChatMessage, LlmOutput


def test_chat_call_uses_one_stable_prompt_cache_key(monkeypatch) -> None:
    seen: dict[str, object] = {}

    class _Message:
        parsed = LlmOutput(message="Uluru.", place_ids=["uluru_au"])

    class _Choice:
        message = _Message()

    class _Completion:
        choices = [_Choice()]
        usage = None

    class _Completions:
        async def parse(self, **kwargs: object) -> _Completion:
            seen.update(kwargs)
            return _Completion()

    class _Chat:
        def __init__(self) -> None:
            self.completions = _Completions()

    class _Beta:
        def __init__(self) -> None:
            self.chat = _Chat()

    class _Client:
        def __init__(self, **_kwargs: object) -> None:
            self.beta = _Beta()

    monkeypatch.setenv("OPENAI_API_KEY", "test-key")
    monkeypatch.setattr("src.llm.AsyncOpenAI", _Client)
    result = asyncio.run(
        complete_llm(
            system_prompt="atlas",
            messages=[ChatMessage(role="user", content="Ruhe")],
        )
    )
    assert result.place_ids == ["uluru_au"]
    assert seen["prompt_cache_key"] == PROMPT_CACHE_KEY == "soulmap"
