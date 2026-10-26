import json
import logging

from fastapi.testclient import TestClient

from src.llm import LlmCallError
from src.logging_config import ACCESS_LOGGER, JsonFormatter
from src.main import app

client = TestClient(app)

SECRET = "GEHEIMER_CHATTEXT_XYZ_PHASE3"


def test_json_formatter_has_no_body_field() -> None:
    record = logging.LogRecord(
        name=ACCESS_LOGGER,
        level=logging.INFO,
        pathname="",
        lineno=0,
        msg="request",
        args=(),
        exc_info=None,
    )
    record.method = "POST"
    record.path = "/chat"
    record.status = 200
    record.duration_ms = 12
    payload = json.loads(JsonFormatter().format(record))
    assert payload["message"] == "request"
    assert payload["path"] == "/chat"
    assert "body" not in payload
    assert SECRET not in json.dumps(payload)


def test_access_log_omits_chat_content(monkeypatch, caplog) -> None:
    async def fake_llm(**_kwargs: object) -> object:
        raise LlmCallError("OPENAI_TIMEOUT")

    monkeypatch.setattr("src.chat.complete_llm", fake_llm)
    with caplog.at_level(logging.INFO, logger=ACCESS_LOGGER):
        response = client.post(
            "/chat",
            json={
                "messages": [{"role": "user", "content": SECRET}],
                "shown_place_ids": [],
                "language": "de",
            },
        )
    assert response.status_code == 200
    assert SECRET not in caplog.text
