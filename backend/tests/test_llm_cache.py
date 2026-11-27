import asyncio
import json

from sqlmodel import Session

from src.chat_model import set_chat_model
from src.db import get_engine
from src.llm import LlmCallError, complete_llm, wire_schema
from src.models_chat import ChatMessage, LlmOutput


def _reset_model() -> None:
    with Session(get_engine()) as session:
        set_chat_model(session, "gpt-5-mini")


def test_wire_schema_is_strict_without_length_limits() -> None:
    schema = wire_schema()
    encoded = json.dumps(schema)
    assert schema["additionalProperties"] is False
    assert set(schema["required"]) == {"message", "place_ids", "overview", "place_notes"}
    assert "$ref" not in encoded
    assert "minLength" not in encoded
    assert "maxLength" not in encoded
    assert "maxItems" not in encoded


def test_chat_call_uses_openrouter_json_schema(monkeypatch) -> None:
    seen: dict[str, object] = {}
    constructed: dict[str, object] = {}
    _reset_model()

    class _Message:
        content = json.dumps(
            {"message": "Uluru.", "place_ids": ["uluru_au"], "overview": "", "place_notes": []}
        )

    class _Choice:
        message = _Message()

    class _Completion:
        choices = [_Choice()]
        usage = None

    class _Completions:
        async def create(self, **kwargs: object) -> _Completion:
            seen.update(kwargs)
            return _Completion()

    class _Chat:
        def __init__(self) -> None:
            self.completions = _Completions()

    class _Client:
        def __init__(self, **kwargs: object) -> None:
            constructed.update(kwargs)
            self.chat = _Chat()

    monkeypatch.setenv("OPENROUTER_API_KEY", "test-key")
    monkeypatch.delenv("LANGFUSE_PUBLIC_KEY", raising=False)
    monkeypatch.delenv("LANGFUSE_SECRET_KEY", raising=False)
    monkeypatch.setattr("src.llm.AsyncOpenAI", _Client)
    result = asyncio.run(
        complete_llm(
            system_prompt="atlas",
            messages=[ChatMessage(role="user", content="Ruhe")],
        )
    )
    assert result == LlmOutput(message="Uluru.", place_ids=["uluru_au"])
    assert constructed["base_url"] == "https://openrouter.ai/api/v1"
    assert constructed["api_key"] == "test-key"
    assert seen["model"] == "openai/gpt-5-mini"
    assert seen["max_tokens"] == 3072
    asyncio.run(
        complete_llm(
            system_prompt="atlas",
            messages=[ChatMessage(role="user", content="Ruhe")],
            max_tokens=1024,
        )
    )
    assert seen["max_tokens"] == 1024
    assert seen["response_format"]["json_schema"]["strict"] is True
    assert seen["extra_body"] == {"provider": {"require_parameters": True}}


def test_claude_call_disables_reasoning(monkeypatch) -> None:
    seen: dict[str, object] = {}

    class _Message:
        content = '{"message":"Uluru.","place_ids":[],"overview":"","place_notes":[]}'

    class _Choice:
        message = _Message()

    class _Completion:
        choices = [_Choice()]
        usage = None

    class _Completions:
        async def create(self, **kwargs: object) -> _Completion:
            seen.update(kwargs)
            return _Completion()

    class _Chat:
        def __init__(self) -> None:
            self.completions = _Completions()

    class _Client:
        def __init__(self, **_kwargs: object) -> None:
            self.chat = _Chat()

    with Session(get_engine()) as session:
        set_chat_model(session, "claude-haiku-5-5")
    monkeypatch.setenv("OPENROUTER_API_KEY", "test-key")
    monkeypatch.delenv("LANGFUSE_PUBLIC_KEY", raising=False)
    monkeypatch.delenv("LANGFUSE_SECRET_KEY", raising=False)
    monkeypatch.setattr("src.llm.AsyncOpenAI", _Client)
    try:
        asyncio.run(
            complete_llm(
                system_prompt="atlas",
                messages=[ChatMessage(role="user", content="Ruhe")],
            )
        )
    finally:
        _reset_model()
    assert seen["model"] == "anthropic/claude-haiku-5.5"
    assert seen["extra_body"]["reasoning"] == {"enabled": False}


def test_invalid_model_json_is_rejected(monkeypatch) -> None:
    class _Message:
        content = "kein json"

    class _Choice:
        message = _Message()

    class _Completion:
        choices = [_Choice()]
        usage = None

    class _Completions:
        async def create(self, **_kwargs: object) -> _Completion:
            return _Completion()

    class _Chat:
        def __init__(self) -> None:
            self.completions = _Completions()

    class _Client:
        def __init__(self, **_kwargs: object) -> None:
            self.chat = _Chat()

    monkeypatch.setenv("OPENROUTER_API_KEY", "test-key")
    monkeypatch.delenv("LANGFUSE_PUBLIC_KEY", raising=False)
    monkeypatch.delenv("LANGFUSE_SECRET_KEY", raising=False)
    monkeypatch.setattr("src.llm.AsyncOpenAI", _Client)
    try:
        asyncio.run(
            complete_llm(
                system_prompt="atlas",
                messages=[ChatMessage(role="user", content="Ruhe")],
            )
        )
    except LlmCallError as exc:
        assert exc.code == "LLM_RESPONSE_INVALID"
    else:
        raise AssertionError("expected LLM_RESPONSE_INVALID")
