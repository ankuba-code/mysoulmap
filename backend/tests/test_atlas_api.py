from fastapi.testclient import TestClient

from src.main import app

client = TestClient(app)


def test_list_places_returns_schema_v2() -> None:
    response = client.get("/atlas/places")
    assert response.status_code == 200
    body = response.json()
    assert "places" in body
    assert len(body["places"]) >= 1
    place = body["places"][0]
    for field in (
        "schemaVersion",
        "id",
        "name",
        "country",
        "coordinates",
        "element",
        "archetyp",
        "primaervibration",
        "correspondence",
        "keywords",
    ):
        assert field in place
    assert place["schemaVersion"] == 2
    assert "lat" in place["coordinates"]
    assert "lng" in place["coordinates"]


def test_list_places_filters() -> None:
    by_element = client.get("/atlas/places", params={"element": "Erde"})
    assert by_element.status_code == 200
    assert {place["element"] for place in by_element.json()["places"]} == {"Erde"}

    by_keyword = client.get("/atlas/places", params={"keyword": "Inka"})
    assert by_keyword.status_code == 200
    ids = [place["id"] for place in by_keyword.json()["places"]]
    assert ids == ["mp"]


def test_get_place_by_id() -> None:
    response = client.get("/atlas/places/mp")
    assert response.status_code == 200
    assert response.json()["id"] == "mp"
    assert response.json()["name"] == "Machu Picchu"


def test_get_place_unknown_returns_404() -> None:
    response = client.get("/atlas/places/gibt-es-nicht")
    assert response.status_code == 404
    body = response.json()
    assert body["error"]["code"] == "PLACE_NOT_FOUND"
    assert body["error"]["details"]["id"] == "gibt-es-nicht"


def test_health_reports_loaded_places() -> None:
    response = client.get("/health")
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert body["places_loaded"] >= 1
