import os
from pathlib import Path

DEFAULT_COUNTRY = "XX"
DEFAULT_DB_PATH = Path(__file__).resolve().parent.parent / "data" / "GeoLite2-Country.mmdb"

_reader = None


def _db_path() -> Path:
    override = os.getenv("GEOIP_DB_PATH")
    return Path(override) if override else DEFAULT_DB_PATH


def country_code_for_ip(ip_address: str) -> str:
    # GeoLite2, lokal — keine IP-Weitergabe an Dritte (MaxMind-EULA / Attribution).
    path = _db_path()
    if not path.exists():
        return DEFAULT_COUNTRY
    try:
        import geoip2.database
        import geoip2.errors
    except ImportError:
        return DEFAULT_COUNTRY

    global _reader
    if _reader is None:
        _reader = geoip2.database.Reader(str(path))
    try:
        iso = _reader.country(ip_address).country.iso_code
    except (geoip2.errors.AddressNotFoundError, ValueError):
        return DEFAULT_COUNTRY
    if not iso or len(iso) != 2:
        return DEFAULT_COUNTRY
    return iso.upper()
