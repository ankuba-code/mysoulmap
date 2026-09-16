import json
from pathlib import Path
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, ValidationError

DATA_PATH = Path(__file__).resolve().parent.parent / "data" / "places.json"


class Coordinates(BaseModel):
    model_config = ConfigDict(extra="forbid")

    lat: float = Field(ge=-90, le=90)
    lng: float = Field(ge=-180, le=180)


class Place(BaseModel):
    model_config = ConfigDict(extra="forbid")

    schemaVersion: Literal[2]
    id: str = Field(min_length=1, max_length=20)
    name: str = Field(min_length=1)
    country: str = Field(min_length=1)
    region: str | None = None
    coordinates: Coordinates
    element: str = Field(min_length=1)
    archetyp: str = Field(min_length=1)
    primaervibration: str = Field(min_length=1)
    correspondence: str = Field(min_length=1)
    keywords: list[str]


def load_places(path: Path | None = None) -> list[Place]:
    data_path = path if path is not None else DATA_PATH
    if not data_path.exists():
        raise FileNotFoundError(f"Atlas-Datei fehlt: {data_path}")

    try:
        raw = json.loads(data_path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        raise ValueError(f"Atlas-Datei ist kein gültiges JSON: {data_path}") from exc

    if not isinstance(raw, dict) or "places" not in raw:
        raise ValueError("Atlas-Datei muss ein Objekt mit Schlüssel 'places' sein")
    if not isinstance(raw["places"], list):
        raise ValueError("'places' muss eine Liste sein")

    try:
        places = [Place.model_validate(item) for item in raw["places"]]
    except ValidationError as exc:
        raise ValueError(f"Atlas-Schema ungültig: {data_path}") from exc

    ids = [place.id for place in places]
    if len(ids) != len(set(ids)):
        raise ValueError("Doppelte Atlas-id in places.json")

    return places


def filter_places(
    places: list[Place],
    *,
    element: str | None = None,
    archetyp: str | None = None,
    keyword: str | None = None,
) -> list[Place]:
    result = places
    if element:
        needle = element.casefold()
        result = [place for place in result if place.element.casefold() == needle]
    if archetyp:
        needle = archetyp.casefold()
        result = [place for place in result if place.archetyp.casefold() == needle]
    if keyword:
        needle = keyword.casefold()
        result = [
            place
            for place in result
            if any(needle in item.casefold() for item in place.keywords)
        ]
    return result


def get_place_by_id(places: list[Place], place_id: str) -> Place | None:
    for place in places:
        if place.id == place_id:
            return place
    return None


PLACES: list[Place] = load_places()
