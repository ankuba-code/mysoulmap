import json
from urllib.error import URLError

from src.geocode import locate_text


class _Body:
    def __init__(self, payload: dict) -> None:
        self._raw = json.dumps(payload).encode("utf-8")

    def read(self) -> bytes:
        return self._raw

    def __enter__(self) -> "_Body":
        return self

    def __exit__(self, *_args: object) -> bool:
        return False


def test_locate_text_reads_the_first_web_result(monkeypatch) -> None:
    def _open(request, timeout, context=None):  # noqa: ARG001
        assert "name=Paris" in request.full_url
        assert "language=de" in request.full_url
        return _Body({"results": [{"latitude": 48.85, "longitude": 2.35, "name": "Paris"}]})

    monkeypatch.setattr("src.geocode.urlopen", _open)
    point = locate_text("Paris", language="de")
    assert point is not None
    assert point.lat == 48.85
    assert point.lng == 2.35


def test_locate_text_returns_none_without_a_result(monkeypatch) -> None:
    monkeypatch.setattr("src.geocode.urlopen", lambda *_args, **_kwargs: _Body({}))
    assert locate_text("Nirgendwo") is None


def test_locate_text_swallows_network_errors(monkeypatch) -> None:
    def _open(*_args, **_kwargs):
        raise URLError("offline")

    monkeypatch.setattr("src.geocode.urlopen", _open)
    assert locate_text("Paris") is None
