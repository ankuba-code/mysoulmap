import os
from pathlib import Path

DEFAULT_COUNTRY = "XX"
DEFAULT_DB_PATH = Path(__file__).resolve().parent.parent / "data" / "GeoLite2-Country.mmdb"
DEFAULT_CITY_DB_PATH = Path(__file__).resolve().parent.parent / "data" / "GeoLite2-City.mmdb"

_country_reader = None
_country_reader_path: Path | None = None
_city_reader = None
_city_reader_path: Path | None = None


def _db_path() -> Path:
    override = os.getenv("GEOIP_DB_PATH")
    return Path(override) if override else DEFAULT_DB_PATH


def _city_db_path() -> Path:
    override = os.getenv("GEOIP_CITY_DB_PATH")
    return Path(override) if override else DEFAULT_CITY_DB_PATH


def _open_reader(path: Path, current, current_path: Path | None):
    import geoip2.database

    if current is not None and current_path == path:
        return current, current_path
    if current is not None:
        current.close()
    return geoip2.database.Reader(str(path)), path


def country_code_for_ip(ip_address: str) -> str:
    # GeoLite2 Country, lokal — keine IP-Weitergabe an Dritte.
    found = _country_code(ip_address)
    if found != DEFAULT_COUNTRY:
        return found
    city = _city_record(ip_address)
    if city is None:
        return DEFAULT_COUNTRY
    return city["country_code"]


def lookup_ip(ip_address: str) -> dict[str, str | float | int | None]:
    """Land aus GeoLite2-Country, Umkreis aus GeoLite2-City. Für die Karte im Frontend."""
    city = _city_record(ip_address)
    country = _country_code(ip_address)
    if country == DEFAULT_COUNTRY and city is not None:
        country = city["country_code"]
    return {
        "country_code": country,
        "latitude": None if city is None else city["latitude"],
        "longitude": None if city is None else city["longitude"],
        "accuracy_radius_km": None if city is None else city["accuracy_radius_km"],
    }


def _country_code(ip_address: str) -> str:
    path = _db_path()
    if not path.exists() or path.is_dir():
        return DEFAULT_COUNTRY
    try:
        import geoip2.errors
    except ImportError:
        return DEFAULT_COUNTRY

    global _country_reader, _country_reader_path
    try:
        _country_reader, _country_reader_path = _open_reader(path, _country_reader, _country_reader_path)
        iso = _country_reader.country(ip_address).country.iso_code
    except (OSError, geoip2.errors.GeoIP2Error, ValueError):
        return DEFAULT_COUNTRY
    if not iso or len(iso) != 2:
        return DEFAULT_COUNTRY
    return iso.upper()


def _city_record(ip_address: str) -> dict[str, str | float | int | None] | None:
    path = _city_db_path()
    if not path.exists() or path.is_dir():
        return None
    try:
        import geoip2.errors
    except ImportError:
        return None

    global _city_reader, _city_reader_path
    try:
        _city_reader, _city_reader_path = _open_reader(path, _city_reader, _city_reader_path)
        record = _city_reader.city(ip_address)
    except (OSError, geoip2.errors.GeoIP2Error, ValueError):
        return None
    iso = record.country.iso_code
    latitude = record.location.latitude
    longitude = record.location.longitude
    radius = record.location.accuracy_radius
    if latitude is None or longitude is None or radius is None:
        return None
    country = iso.upper() if iso and len(iso) == 2 else DEFAULT_COUNTRY
    return {
        "country_code": country,
        "latitude": float(latitude),
        "longitude": float(longitude),
        "accuracy_radius_km": int(radius),
    }
