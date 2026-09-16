from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

MAX_TURNS = 20
MAX_MESSAGE_LENGTH = 4000
MAX_SHOWN_PLACE_IDS = 40
MAX_PLACE_ID_LENGTH = 20


class ChatMessage(BaseModel):
    model_config = ConfigDict(extra="forbid")

    role: Literal["user", "assistant"]
    content: str = Field(min_length=1, max_length=MAX_MESSAGE_LENGTH)

    @field_validator("content")
    @classmethod
    def content_not_blank(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("Nachricht darf nicht leer sein")
        return value


class ChatRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    messages: list[ChatMessage] = Field(min_length=1, max_length=MAX_TURNS)
    shown_place_ids: list[str] = Field(default_factory=list, max_length=MAX_SHOWN_PLACE_IDS)
    language: Literal["de", "es", "en", "ru"] = "de"

    @field_validator("shown_place_ids")
    @classmethod
    def valid_shown_ids(cls, values: list[str]) -> list[str]:
        for item in values:
            if not item or len(item) > MAX_PLACE_ID_LENGTH:
                raise ValueError("Ungültige place_id")
        return values

    @model_validator(mode="after")
    def require_user_message(self) -> "ChatRequest":
        if not any(message.role == "user" for message in self.messages):
            raise ValueError("Mindestens eine Nutzernachricht ist erforderlich")
        return self


class LlmOutput(BaseModel):
    model_config = ConfigDict(extra="forbid")

    message: str
    place_ids: list[str]


class RecommendedPlace(BaseModel):
    id: str
    name: str
    booking_link: str


class ChatResponse(BaseModel):
    message: ChatMessage
    shown_place_ids: list[str]
    recommended_places: list[RecommendedPlace]
    source: Literal["llm", "fallback"]
    ai_disclosure: bool = True
