import asyncio
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

from .models_chat import ChatMessage, LlmOutput
from .prompts import to_openai_messages

logger = logging.getLogger("soulmap.llm")

MODEL = "gpt-5-mini"
# Stabiler Schlüssel, damit Folgefragen auf derselben Cache-Route landen.
# gpt-5-mini cached nur das gemeinsame Präfix und routet dafür über diesen Key.
PROMPT_CACHE_KEY = "soulmap"
TIMEOUT_SECONDS = 45.0
RETRY_BACKOFF_SECONDS = 0.5
_llm_usage: ContextVar[dict[str, int | None]] = ContextVar("llm_usage", default={})


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


def _client() -> AsyncOpenAI:
    if not langfuse_enabled():
        return AsyncOpenAI(timeout=TIMEOUT_SECONDS)
    from langfuse.openai import AsyncOpenAI as LangfuseAsyncOpenAI

    return LangfuseAsyncOpenAI(timeout=TIMEOUT_SECONDS)


async def complete_llm(
    *,
    system_prompt: str,
    messages: list[ChatMessage],
) -> LlmOutput:
    if not os.getenv("OPENAI_API_KEY"):
        raise LlmCallError("OPENAI_UNAVAILABLE")

    payload = to_openai_messages(system_prompt, messages)
    last_unavailable: LlmCallError | None = None

    for attempt in range(2):
        try:
            return await _parse_once(payload)
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


async def _parse_once(payload: list[dict[str, str]]) -> LlmOutput:
    client = _client()
    request: dict[str, object] = {
        "model": MODEL,
        "messages": payload,
        "response_format": LlmOutput,
        "prompt_cache_key": PROMPT_CACHE_KEY,
    }
    if langfuse_enabled():
        request["name"] = "soulmap-chat"
        request["metadata"] = {"prompt_cache_key": PROMPT_CACHE_KEY}
    try:
        completion = await client.beta.chat.completions.parse(**request)
    except AttributeError:
        completion = await client.chat.completions.parse(**request)

    parsed = completion.choices[0].message.parsed
    if parsed is None:
        raise LlmCallError("LLM_RESPONSE_INVALID")
    usage = getattr(completion, "usage", None)
    if usage is not None:
        _llm_usage.set(
            {
                "input_tokens": getattr(usage, "prompt_tokens", None),
                "output_tokens": getattr(usage, "completion_tokens", None),
            }
        )
    return LlmOutput.model_validate(parsed)
