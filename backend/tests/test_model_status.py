import io
import json

from src.model_status import model_reachable, slug_listed


def test_slug_listed_matches_the_openrouter_id() -> None:
    payload = {"data": [{"id": "openai/gpt-5-mini"}, {"id": "other"}]}
    assert slug_listed("openai/gpt-5-mini", payload) is True
    assert slug_listed("anthropic/claude-haiku-5.5", payload) is False
    assert slug_listed("openai/gpt-5-mini", {}) is False


def test_model_reachable_uses_the_catalog(monkeypatch) -> None:
    monkeypatch.delenv("SOULMAP_MODEL_PROBE", raising=False)
    monkeypatch.setenv("OPENROUTER_API_KEY", "test-key")
    body = json.dumps({"data": [{"id": "openai/gpt-5-mini"}]}).encode()

    class Response(io.BytesIO):
        def __enter__(self):
            return self

        def __exit__(self, *args):
            return False

    monkeypatch.setattr("src.model_status.urllib.request.urlopen", lambda *args, **kwargs: Response(body))
    from src import model_status

    model_status._cache.clear()
    assert model_reachable("gpt-5-mini") is True
    assert model_reachable("claude-haiku-5-5") is False
