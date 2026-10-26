from urllib.parse import parse_qs, urlparse

from src.atlas import get_place_by_id, PLACES
from src.booking import booking_search_url, normalize_booking_lang


def test_booking_url_uses_aid_ss_and_label(monkeypatch) -> None:
    monkeypatch.setenv("BOOKING_AFFILIATE_ID", "123456")
    place = get_place_by_id(PLACES, "mp")
    assert place is not None
    parsed = urlparse(booking_search_url(place, "de"))
    assert parsed.scheme == "https"
    assert parsed.netloc == "www.booking.com"
    assert parsed.path == "/searchresults.de.html"
    query = parse_qs(parsed.query)
    assert query["aid"] == ["123456"]
    assert query["ss"] == ["Machu Picchu, Peru"]
    assert query["label"] == ["soulmap"]


def test_unknown_language_falls_back_to_de() -> None:
    assert normalize_booking_lang("xx") == "de"
    assert normalize_booking_lang("es") == "es"
