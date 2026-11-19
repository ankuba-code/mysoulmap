import asyncio
import json
from datetime import datetime, timezone
from urllib.parse import parse_qs, urlparse

from src.admin_pages import stats_page
from src.langfuse_metrics import fetch_langfuse_widgets, reset_langfuse_cache
from src.llm import PROMPT_CACHE_KEY, _client, complete_llm, langfuse_enabled, langfuse_project_url
from src.models_chat import ChatMessage, LlmOutput


def test_admin_links_the_configured_langfuse_project(monkeypatch) -> None:
    url = "https://cloud.langfuse.com/project/example"
    monkeypatch.setenv("LANGFUSE_PROJECT_URL", url)
    assert langfuse_project_url() == url
    html = stats_page({"period": "2026-11-01/2026-11-19", "langfuse_url": url})
    assert f'href="{url}"' in html
    assert 'target="_blank"' in html


def test_langfuse_project_url_rejects_other_schemes(monkeypatch) -> None:
    monkeypatch.setenv("LANGFUSE_PROJECT_URL", "http://cloud.langfuse.com/project/x")
    assert langfuse_project_url() is None


def test_langfuse_stays_off_without_keys(monkeypatch) -> None:
    monkeypatch.delenv("LANGFUSE_PUBLIC_KEY", raising=False)
    monkeypatch.delenv("LANGFUSE_SECRET_KEY", raising=False)
    assert langfuse_enabled() is False


def test_langfuse_client_is_used_when_keys_are_set(monkeypatch) -> None:
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
    monkeypatch.setenv("LANGFUSE_PUBLIC_KEY", "pk-test")
    monkeypatch.setenv("LANGFUSE_SECRET_KEY", "sk-test")
    monkeypatch.setattr("langfuse.openai.AsyncOpenAI", _Client)

    assert langfuse_enabled() is True
    client = _client()
    assert isinstance(client, _Client)
    result = asyncio.run(
        complete_llm(
            system_prompt="atlas",
            messages=[ChatMessage(role="user", content="Ruhe")],
        )
    )
    assert result.place_ids == ["uluru_au"]
    assert seen["name"] == "soulmap-chat"
    assert seen["metadata"] == {"prompt_cache_key": PROMPT_CACHE_KEY}


class _Body:
    def __init__(self, payload: dict) -> None:
        self.payload = payload

    def read(self) -> bytes:
        return json.dumps(self.payload).encode()

    def __enter__(self) -> "_Body":
        return self

    def __exit__(self, *args: object) -> bool:
        return False


def test_langfuse_widgets_map_the_metrics_response(monkeypatch) -> None:
    monkeypatch.setenv("LANGFUSE_PUBLIC_KEY", "pk-test")
    monkeypatch.setenv("LANGFUSE_SECRET_KEY", "sk-test")
    reset_langfuse_cache()

    def opener(request, timeout):
        assert timeout == 5
        assert "sk-test" not in request.full_url
        query = json.loads(parse_qs(urlparse(request.full_url).query)["query"][0])
        assert query["filters"][0]["value"] == "soulmap-chat"
        if query.get("timeDimension"):
            return _Body(
                {
                    "data": [
                        {
                            "time_dimension": "2026-11-18T00:00:00.000Z",
                            "count_count": 3,
                            "sum_totalCost": 0.02,
                        }
                    ]
                }
            )
        return _Body(
            {
                "data": [
                    {
                        "count_count": 4,
                        "sum_totalCost": 0.05,
                        "sum_totalTokens": 120,
                        "p95_latency": 800.4,
                    }
                ]
            }
        )

    widgets = fetch_langfuse_widgets(datetime(2026, 11, 19, tzinfo=timezone.utc), opener=opener)
    assert widgets["calls"] == 4
    assert widgets["tokens"] == 120
    assert widgets["latency_ms"] == 800
    assert widgets["days"] == [{"date": "2026-11-18", "calls": 3, "cost_usd": 0.02}]
    html = stats_page({"period": "2026-11-01/2026-11-19", "langfuse": widgets})
    assert "Aufrufe" in html
    assert "0.0500 $" in html
    assert 'aria-label="Langfuse Aufrufe"' in html
