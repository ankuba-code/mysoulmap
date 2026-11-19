import json
import os
import time
import urllib.parse
import urllib.request
from base64 import b64encode
from datetime import datetime, timedelta, timezone

from .llm import langfuse_enabled

WINDOW_DAYS = 7
CACHE_SECONDS = 60
_cache: dict[str, object] = {"at": 0.0, "value": None}

NAME_FILTER = [
    {"column": "name", "operator": "=", "value": "soulmap-chat", "type": "string"}
]


def fetch_langfuse_widgets(now: datetime, *, opener=None) -> dict | None:
    if not langfuse_enabled():
        return None
    cached = _cache.get("value")
    if opener is None and isinstance(cached, dict) and time.monotonic() - float(_cache["at"]) < CACHE_SECONDS:
        return cached
    try:
        payload = _load(now, opener or urllib.request.urlopen)
    except Exception as exc:
        payload = {"error": type(exc).__name__, "days": []}
    if opener is None:
        _cache["at"] = time.monotonic()
        _cache["value"] = payload
    return payload


def reset_langfuse_cache() -> None:
    _cache["at"] = 0.0
    _cache["value"] = None


def _load(now: datetime, opener) -> dict:
    end = now if now.tzinfo else now.replace(tzinfo=timezone.utc)
    start = end - timedelta(days=WINDOW_DAYS)
    summary = _metrics(
        opener,
        {
            "view": "observations",
            "metrics": [
                {"measure": "count", "aggregation": "count"},
                {"measure": "totalCost", "aggregation": "sum"},
                {"measure": "totalTokens", "aggregation": "sum"},
                {"measure": "latency", "aggregation": "p95"},
            ],
            "dimensions": [],
            "filters": NAME_FILTER,
            "fromTimestamp": start.isoformat(),
            "toTimestamp": end.isoformat(),
            "config": {"row_limit": 10},
        },
    )
    series = _metrics(
        opener,
        {
            "view": "observations",
            "metrics": [
                {"measure": "count", "aggregation": "count"},
                {"measure": "totalCost", "aggregation": "sum"},
            ],
            "dimensions": [],
            "filters": NAME_FILTER,
            "timeDimension": {"granularity": "day"},
            "fromTimestamp": start.isoformat(),
            "toTimestamp": end.isoformat(),
            "orderBy": [{"field": "time_dimension", "direction": "asc"}],
            "config": {"row_limit": 31},
        },
    )
    row = summary[0] if summary else {}
    days = []
    for item in series:
        stamp = str(item.get("time_dimension") or "")
        days.append(
            {
                "date": stamp[:10],
                "calls": int(item.get("count_count") or 0),
                "cost_usd": _number(item.get("sum_totalCost")),
            }
        )
    return {
        "period_days": WINDOW_DAYS,
        "calls": int(row.get("count_count") or 0),
        "cost_usd": _number(row.get("sum_totalCost")),
        "tokens": int(row.get("sum_totalTokens") or 0),
        "latency_ms": int(round(_number(row.get("p95_latency")))),
        "days": days,
    }


def _metrics(opener, query: dict) -> list[dict]:
    base = os.getenv("LANGFUSE_BASE_URL", "https://cloud.langfuse.com").strip().rstrip("/")
    public = os.getenv("LANGFUSE_PUBLIC_KEY", "").strip()
    secret = os.getenv("LANGFUSE_SECRET_KEY", "").strip()
    token = b64encode(f"{public}:{secret}".encode()).decode()
    url = base + "/api/public/v2/metrics?" + urllib.parse.urlencode({"query": json.dumps(query)})
    request = urllib.request.Request(url, headers={"Authorization": f"Basic {token}"})
    with opener(request, timeout=5) as response:
        payload = json.loads(response.read().decode())
    data = payload.get("data") if isinstance(payload, dict) else None
    return data if isinstance(data, list) else []


def _number(value: object) -> float:
    try:
        return float(value or 0)
    except (TypeError, ValueError):
        return 0.0
