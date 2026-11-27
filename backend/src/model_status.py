import json
import os
import time
import urllib.error
import urllib.request

from .chat_model import CHAT_MODELS
from .llm import OPENROUTER_BASE_URL

_CACHE_SECONDS = 60.0
_MISS_SECONDS = 15.0
_cache: dict[str, tuple[float, bool]] = {}


def model_reachable(model_id: str) -> bool:
    if os.getenv("SOULMAP_MODEL_PROBE") == "off":
        return False
    slug = CHAT_MODELS.get(model_id)
    api_key = os.getenv("OPENROUTER_API_KEY", "").strip()
    if not slug or not api_key:
        return False
    now = time.monotonic()
    cached = _cache.get(slug)
    if cached is not None and now - cached[0] < (_CACHE_SECONDS if cached[1] else _MISS_SECONDS):
        return cached[1]
    ok = _slug_is_listed(slug, api_key)
    _cache[slug] = (now, ok)
    return ok


def slug_listed(slug: str, payload: object) -> bool:
    if not isinstance(payload, dict):
        return False
    rows = payload.get("data")
    if not isinstance(rows, list):
        return False
    return any(isinstance(row, dict) and row.get("id") == slug for row in rows)


def _slug_is_listed(slug: str, api_key: str) -> bool:
    base = os.getenv("OPENROUTER_BASE_URL", OPENROUTER_BASE_URL).rstrip("/")
    request = urllib.request.Request(
        f"{base}/models",
        headers={"Authorization": f"Bearer {api_key}", "Accept": "application/json"},
    )
    try:
        with urllib.request.urlopen(request, timeout=8) as response:
            payload = json.loads(response.read().decode("utf-8"))
    except (urllib.error.URLError, TimeoutError, json.JSONDecodeError, OSError):
        return False
    return slug_listed(slug, payload)
