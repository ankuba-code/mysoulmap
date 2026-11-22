import json
from functools import cache
from pathlib import Path

from .atlas import Place

_PATH = Path(__file__).resolve().parents[1] / "data" / "place_i18n.json"


@cache
def _table() -> dict:
    return json.loads(_PATH.read_text(encoding="utf-8"))


def localized_fields(language: str, place: Place) -> dict[str, str] | None:
    row = _table().get(language, {}).get(place.id)
    if not isinstance(row, dict):
        return None
    return row


def localized_name(language: str, place: Place) -> str:
    row = localized_fields(language, place)
    if row and row.get("name"):
        return str(row["name"])
    return place.name
