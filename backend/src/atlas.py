import json
from pathlib import Path
from pydantic import BaseModel

DATA_PATH = Path(__file__).resolve().parent.parent / "data" / "places.json"


class Place(BaseModel):
    id: str
    name: str
    country: str
    region: str | None = None
    # weitere Felder gemäß eurem Atlas-Schema v2 ergänzen


def load_places() -> list[Place]:
    if not DATA_PATH.exists():
        return []
    raw = json.loads(DATA_PATH.read_text(encoding="utf-8"))
    return [Place(**p) for p in raw.get("places", [])]


PLACES: list[Place] = load_places()