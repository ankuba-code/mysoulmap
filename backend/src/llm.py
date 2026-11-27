import asyncio
import json
import logging
import os
from contextvars import ContextVar
from urllib.parse import urlparse

from openai import (
    APIConnectionError,
    APIStatusError,
    APITimeoutError,
    AsyncOpenAI,
    RateLimitError,
)
from pydantic import ValidationError
from sqlmodel import Session

from .chat_model import CHAT_MODELS, active_chat_model
from .db import get_engine
from .models_chat import ChatMessage, LlmOutput
from .prompts import to_openai_messages

logger = logging.getLogger("soulmap.llm")

OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1"
# Fünf Ortsnotizen à 600 Zeichen plus die Nachricht bis 3600 Zeichen.
GROUP_OUTPUT_TOKENS = 3072
# Eine Ortsnotiz à 600 Zeichen, plus die versteckten Reasoning-Tokens von gpt-5-mini.
PLACE_OUTPUT_TOKENS = 2048
TIMEOUT_SECONDS = 45.0
RETRY_BACKOFF_SECONDS = 0.5
_llm_usage: ContextVar[dict[str, int | None]] = ContextVar("llm_usage", default={})

_LENGTH_KEYS = {"minLength", "maxLength", "minItems", "maxItems", "minimum", "maximum"}


def pop_llm_usage() -> dict[str, int | None]:
    usage = dict(_llm_usage.get())
    _llm_usage.set({})
    return usage


class LlmCallError(Exception):
    def __init__(self, code: str) -> None:
        self.code = code
        super().__init__(code)


def langfuse_enabled() -> bool:
    return bool(os.getenv("LANGFUSE_PUBLIC_KEY", "").strip() and os.getenv("LANGFUSE_SECRET_KEY", "").strip())


def langfuse_project_url() -> str | None:
    raw = os.getenv("LANGFUSE_PROJECT_URL", "").strip()
    parsed = urlparse(raw)
    if parsed.scheme != "https" or not parsed.netloc:
        return None
    return raw


def flush_langfuse() -> None:
    if not langfuse_enabled():
        return
    try:
        from langfuse import get_client

        get_client().flush()
    except Exception:
        logger.exception("langfuse_flush_failed")


def wire_schema() -> dict:
    raw = LlmOutput.model_json_schema()
    defs = raw.pop("$defs", {})
    return _strict_schema(_inline_refs(raw, defs))


def _inline_refs(node: object, defs: dict) -> object:
    if isinstance(node, list):
        return [_inline_refs(item, defs) for item in node]
    if not isinstance(node, dict):
        return node
    ref = node.get("$ref")
    if isinstance(ref, str):
        return _inline_refs(defs[ref.rsplit("/", 1)[-1]], defs)
    return {key: _inline_refs(value, defs) for key, value in node.items()}


def _strict_schema(node: object) -> dict:
    if not isinstance(node, dict):
        return {}
    cleaned = {
        key: value
        for key, value in node.items()
        if key not in _LENGTH_KEYS and key not in {"title", "default"}
    }
    properties = cleaned.get("properties")
    if isinstance(properties, dict):
        cleaned["properties"] = {key: _strict_schema(value) for key, value in properties.items()}
        cleaned["required"] = list(properties.keys())
        cleaned["additionalProperties"] = False
    items = cleaned.get("items")
    if isinstance(items, dict):
        cleaned["items"] = _strict_schema(items)
    defs = cleaned.get("$defs")
    if isinstance(defs, dict):
        cleaned["$defs"] = {key: _strict_schema(value) for key, value in defs.items()}
    if cleaned.get("type") == "object":
        cleaned["additionalProperties"] = False
    return cleaned


def _client() -> AsyncOpenAI:
    api_key = os.getenv("OPENROUTER_API_KEY", "")
    base_url = os.getenv("OPENROUTER_BASE_URL", OPENROUTER_BASE_URL).rstrip("/")
    if not langfuse_enabled():
        return AsyncOpenAI(api_key=api_key, base_url=base_url, timeout=TIMEOUT_SECONDS)
    from langfuse.openai import AsyncOpenAI as LangfuseAsyncOpenAI

    return LangfuseAsyncOpenAI(api_key=api_key, base_url=base_url, timeout=TIMEOUT_SECONDS)


def _selected_model() -> tuple[str, str]:
    with Session(get_engine()) as session:
        model_id = active_chat_model(session)
    return model_id, CHAT_MODELS[model_id]


def output_token_cap(place_count: int) -> int:
    if place_count <= 1:
        return PLACE_OUTPUT_TOKENS
    return GROUP_OUTPUT_TOKENS


async def complete_llm(
    *,
    system_prompt: str,
    messages: list[ChatMessage],
    max_tokens: int = GROUP_OUTPUT_TOKENS,
) -> LlmOutput:
    if not os.getenv("OPENROUTER_API_KEY"):
        raise LlmCallError("OPENAI_UNAVAILABLE")

    payload = to_openai_messages(system_prompt, messages)
    last_unavailable: LlmCallError | None = None

    for attempt in range(2):
        try:
            return await _parse_once(payload, max_tokens)
        except APITimeoutError as exc:
            raise LlmCallError("OPENAI_TIMEOUT") from exc
        except (RateLimitError, APIConnectionError) as exc:
            last_unavailable = LlmCallError("OPENAI_UNAVAILABLE")
            last_unavailable.__cause__ = exc
        except APIStatusError as exc:
            if exc.status_code >= 500:
                last_unavailable = LlmCallError("OPENAI_UNAVAILABLE")
                last_unavailable.__cause__ = exc
            else:
                raise LlmCallError("OPENAI_ERROR") from exc
        except LlmCallError:
            raise
        except Exception as exc:
            raise LlmCallError("OPENAI_ERROR") from exc

        if attempt == 0:
            await asyncio.sleep(RETRY_BACKOFF_SECONDS)
            continue
        if last_unavailable is not None:
            raise last_unavailable
        raise LlmCallError("OPENAI_UNAVAILABLE")

    raise LlmCallError("OPENAI_UNAVAILABLE")


def _json_text(content: str) -> str:
    text = content.strip()
    if not text.startswith("```"):
        return text
    lines = text.splitlines()
    body = lines[1:]
    if body and body[-1].strip().startswith("```"):
        body = body[:-1]
    return "\n".join(body).strip()


async def _parse_once(payload: list[dict[str, str]], max_tokens: int) -> LlmOutput:
    model_id, slug = _selected_model()
    client = _client()
    extra: dict[str, object] = {"provider": {"require_parameters": True}}
    if model_id == "claude-haiku-5-5":
        extra["reasoning"] = {"enabled": False}
    request: dict[str, object] = {
        "model": slug,
        "messages": payload,
        "max_tokens": max_tokens,
        "response_format": {
            "type": "json_schema",
            "json_schema": {
                "name": "LlmOutput",
                "strict": True,
                "schema": wire_schema(),
            },
        },
        "extra_body": extra,
    }
    if langfuse_enabled():
        request["name"] = "soulmap-chat"
        request["metadata"] = {"model": slug}
    # OpenRouter-Felder und Langfuse-Metadaten liegen außerhalb der OpenAI-Typisierung.
    completion = await client.chat.completions.create(**request)  # type: ignore[call-overload]
    message = completion.choices[0].message
    content = message.content if isinstance(message.content, str) else ""
    if not content.strip():
        raise LlmCallError("LLM_RESPONSE_INVALID")
    try:
        parsed = json.loads(_json_text(content))
        output = LlmOutput.model_validate(parsed)
    except (json.JSONDecodeError, ValidationError) as exc:
        raise LlmCallError("LLM_RESPONSE_INVALID") from exc
    usage = getattr(completion, "usage", None)
    if usage is not None:
        _llm_usage.set(
            {
                "input_tokens": getattr(usage, "prompt_tokens", None),
                "output_tokens": getattr(usage, "completion_tokens", None),
            }
        )
    return output
