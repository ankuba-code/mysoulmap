from pathlib import Path

from fastapi.testclient import TestClient

from src.geoip import DEFAULT_CITY_DB_PATH, DEFAULT_DB_PATH, country_code_for_ip, lookup_ip
from src.main import app

client = TestClient(app)


def test_country_code_without_database_is_xx(monkeypatch, tmp_path: Path) -> None:
    monkeypatch.setenv("GEOIP_DB_PATH", str(tmp_path / "missing-country.mmdb"))
    monkeypatch.setenv("GEOIP_CITY_DB_PATH", str(tmp_path / "missing-city.mmdb"))
    assert country_code_for_ip("8.8.8.8") == "XX"
    assert country_code_for_ip("127.0.0.1") == "XX"
    assert lookup_ip("8.8.8.8")["latitude"] is None


def test_country_code_uses_local_maxmind_database() -> None:
    if not DEFAULT_DB_PATH.exists():
        return
    assert country_code_for_ip("8.8.8.8") == "US"
    assert country_code_for_ip("127.0.0.1") == "XX"


def test_lookup_uses_geolite2_city_database() -> None:
    if not DEFAULT_CITY_DB_PATH.exists():
        return
    found = lookup_ip("8.8.8.8")
    assert found["country_code"] == "US"
    assert isinstance(found["latitude"], float)
    assert isinstance(found["longitude"], float)
    assert found["accuracy_radius_km"] > 0
    assert lookup_ip("127.0.0.1")["latitude"] is None


def test_geo_endpoint_returns_caller_lookup(monkeypatch) -> None:
    monkeypatch.setattr(
        "src.main.lookup_ip",
        lambda _ip: {
            "country_code": "DE",
            "latitude": 52.52,
            "longitude": 13.405,
            "accuracy_radius_km": 20,
        },
    )
    response = client.get("/geo")
    assert response.status_code == 200
    assert response.json() == {
        "country_code": "DE",
        "latitude": 52.52,
        "longitude": 13.405,
        "accuracy_radius_km": 20,
    }
