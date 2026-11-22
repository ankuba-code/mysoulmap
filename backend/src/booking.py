import os
from urllib.parse import urlencode

from .atlas import Place

BOOKING_LANGS = frozenset({"de", "es", "en", "ru"})
RADIUS_KM = 20


def normalize_booking_lang(lang: str | None) -> str:
    if lang and lang in BOOKING_LANGS:
        return lang
    return "de"


def booking_search_url(place: Place, lang: str | None = None) -> str:
    language = normalize_booking_lang(lang)
    query = urlencode(
        {
            "aid": os.getenv("BOOKING_AFFILIATE_ID", ""),
            "ss": f"{place.name}, {place.country}",
            "latitude": f"{place.coordinates.lat:.5f}",
            "longitude": f"{place.coordinates.lng:.5f}",
            "radius": str(RADIUS_KM),
            "dest_type": "latlong",
            "order": "distance",
            "label": "soulmap",
        }
    )
    return f"https://www.booking.com/searchresults.{language}.html?{query}"
