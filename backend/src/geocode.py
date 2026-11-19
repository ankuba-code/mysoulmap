import json
import logging
import ssl
from urllib.error import URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

import certifi
from pydantic import ValidationError

from .atlas import Coordinates

logger = logging.getLogger(__name__)

_ENDPOINT = "https://geocoding-api.open-meteo.com/v1/search"
_TIMEOUT_SECONDS = 4.0


def locate_text(query: str, *, language: str = "de") -> Coordinates | None:
    """Koordinate zu einem freien Ortsnamen. Bei Ausfall bleibt der Match ohne Punkt."""
    params = urlencode(
        {
            "name": query,
            "count": 1,
            "language": language,
            "format": "json",
        }
    )
    request = Request(
        f"{_ENDPOINT}?{params}",
        headers={"User-Agent": "Soulmap/1.0"},
    )
    try:
        context = ssl.create_default_context(cafile=certifi.where())
        with urlopen(request, timeout=_TIMEOUT_SECONDS, context=context) as response:
            payload = json.loads(response.read().decode("utf-8"))
    except (URLError, TimeoutError, json.JSONDecodeError, UnicodeError, OSError) as exc:
        logger.warning("Geocoding fehlgeschlagen: %s", type(exc).__name__)
        return None

    results = payload.get("results") if isinstance(payload, dict) else None
    if not results:
        return None
    first = results[0]
    if not isinstance(first, dict):
        return None
    try:
        return Coordinates(lat=first["latitude"], lng=first["longitude"])
    except (KeyError, TypeError, ValidationError):
        return None
