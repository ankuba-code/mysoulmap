import asyncio
import os

from openai import (
    APIConnectionError,
    APIStatusError,
    APITimeoutError,
    AsyncOpenAI,
    RateLimitError,
)

from .models_chat import ChatMessage, LlmOutput
from .prompts import to_openai_messages

MODEL = "gpt-5-mini"
TIMEOUT_SECONDS = 20.0
RETRY_BACKOFF_SECONDS = 0.5


class LlmCallError(Exception):
    def __init__(self, code: str) -> None:
        self.code = code
        super().__init__(code)


def _client() -> AsyncOpenAI:
    return AsyncOpenAI(timeout=TIMEOUT_SECONDS)


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
    try:
        completion = await client.beta.chat.completions.parse(
            model=MODEL,
            messages=payload,
            response_format=LlmOutput,
        )
    except AttributeError:
        completion = await client.chat.completions.parse(
            model=MODEL,
            messages=payload,
            response_format=LlmOutput,
        )

    parsed = completion.choices[0].message.parsed
    if parsed is None:
        raise LlmCallError("LLM_RESPONSE_INVALID")
    return LlmOutput.model_validate(parsed)
