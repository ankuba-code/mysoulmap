import os
from urllib.parse import urlencode

from .atlas import Place

BOOKING_LANGS = frozenset({"de", "es", "en", "ru"})


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
            "label": "soulmap",
        }
    )
    return f"https://www.booking.com/searchresults.{language}.html?{query}"
