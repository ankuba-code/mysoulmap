import json
from pathlib import Path

import pytest
from pydantic import ValidationError

from src.atlas import Place, filter_places, get_place_by_id, load_places

VALID_PLACE = {
    "schemaVersion": 2,
    "id": "mp",
    "name": "Machu Picchu",
    "country": "Peru",
    "region": None,
    "coordinates": {"lat": -13.1631, "lng": -72.545},
    "element": "Erde",
    "archetyp": "Der Pilger",
    "primaervibration": "Ehrfurcht",
    "correspondence": "Bergnebel, Terrassen, verlorene Stadt",
    "keywords": ["Anden", "Inka", "Höhenwanderung"],
}


def _write_places(path: Path, places: list[dict]) -> Path:
    target = path / "places.json"
    target.write_text(json.dumps({"places": places}), encoding="utf-8")
    return target


def test_place_accepts_spec_v2_example() -> None:
    place = Place.model_validate(VALID_PLACE)
    assert place.id == "mp"
    assert place.region is None
    assert place.coordinates.lat == pytest.approx(-13.1631)
    assert place.keywords == ["Anden", "Inka", "Höhenwanderung"]


def test_place_region_is_optional() -> None:
    payload = {**VALID_PLACE}
    payload.pop("region")
    place = Place.model_validate(payload)
    assert place.region is None


def test_place_rejects_missing_required_field() -> None:
    payload = {**VALID_PLACE}
    del payload["element"]
    with pytest.raises(ValidationError):
        Place.model_validate(payload)


def test_place_rejects_other_schema_version() -> None:
    with pytest.raises(ValidationError):
        Place.model_validate({**VALID_PLACE, "schemaVersion": 1})


def test_load_places_fail_fast_on_missing_file(tmp_path: Path) -> None:
    with pytest.raises(FileNotFoundError):
        load_places(tmp_path / "missing.json")


def test_load_places_fail_fast_on_invalid_schema(tmp_path: Path) -> None:
    invalid = {**VALID_PLACE}
    del invalid["name"]
    path = _write_places(tmp_path, [invalid])
    with pytest.raises(ValueError, match="Atlas-Schema ungültig"):
        load_places(path)


def test_load_places_fail_fast_on_duplicate_ids(tmp_path: Path) -> None:
    second = {**VALID_PLACE, "id": "mp", "name": "Kopie"}
    path = _write_places(tmp_path, [VALID_PLACE, second])
    with pytest.raises(ValueError, match="Doppelte Atlas-id"):
        load_places(path)


def test_filter_and_lookup(tmp_path: Path) -> None:
    sedona = {
        **VALID_PLACE,
        "id": "sedona",
        "name": "Sedona",
        "country": "USA",
        "element": "Feuer",
        "archetyp": "Der Suchende",
        "keywords": ["Vortex", "Wüste"],
    }
    uluru = {
        **VALID_PLACE,
        "id": "uluru",
        "name": "Uluru",
        "country": "Australien",
        "element": "Erde",
        "archetyp": "Der Hüter",
        "keywords": ["Outback", "Fels"],
    }
    places = load_places(_write_places(tmp_path, [VALID_PLACE, sedona, uluru]))

    by_element = filter_places(places, element="erde")
    assert [place.id for place in by_element] == ["mp", "uluru"]

    by_archetyp = filter_places(places, archetyp="Der Suchende")
    assert [place.id for place in by_archetyp] == ["sedona"]

    by_keyword = filter_places(places, keyword="anden")
    assert [place.id for place in by_keyword] == ["mp"]

    combined = filter_places(places, element="Erde", keyword="Fels")
    assert [place.id for place in combined] == ["uluru"]

    assert get_place_by_id(places, "mp") is not None
    assert get_place_by_id(places, "unknown") is None
