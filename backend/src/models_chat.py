from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

MAX_TURNS = 20
MAX_MESSAGE_LENGTH = 4000
MAX_SHOWN_PLACE_IDS = 40
MAX_PLACE_ID_LENGTH = 40


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


class RitualContext(BaseModel):
    model_config = ConfigDict(extra="forbid")

    archetype_symbol: str = Field(min_length=1, max_length=40)
    element: str = Field(min_length=1, max_length=40)
    inner_rhythm: str = Field(min_length=1, max_length=40)
    emotional_intensity: int = Field(ge=1, le=10)
    travel_direction: str = Field(min_length=1, max_length=40)
    dominant_frequency: str = Field(min_length=1, max_length=400)
    matched_place_ids: list[str] = Field(default_factory=list, max_length=5)
    lines: list[str] = Field(default_factory=list, max_length=8)

    @field_validator("lines")
    @classmethod
    def lines_bounded(cls, values: list[str]) -> list[str]:
        cleaned: list[str] = []
        for item in values:
            text = item.strip()
            if not text or len(text) > 500:
                raise ValueError("Ungültige Ritualzeile")
            cleaned.append(text)
        return cleaned


class ChatRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    messages: list[ChatMessage] = Field(min_length=1, max_length=MAX_TURNS)
    shown_place_ids: list[str] = Field(default_factory=list, max_length=MAX_SHOWN_PLACE_IDS)
    language: Literal["de", "es", "en", "ru"] = "de"
    from_ritual: bool = False
    ritual_context: RitualContext | None = None
    prompt_catalog: Literal["atlas", "element", "place"] = "atlas"
    focus_place_id: str | None = None

    @field_validator("shown_place_ids")
    @classmethod
    def valid_shown_ids(cls, values: list[str]) -> list[str]:
        for item in values:
            if not item or len(item) > MAX_PLACE_ID_LENGTH:
                raise ValueError("Ungültige place_id")
        return values

    @field_validator("focus_place_id")
    @classmethod
    def valid_focus_id(cls, value: str | None) -> str | None:
        if value is None:
            return None
        text = value.strip()
        if not text or len(text) > MAX_PLACE_ID_LENGTH:
            raise ValueError("Ungültige place_id")
        return text

    @model_validator(mode="after")
    def require_user_message(self) -> "ChatRequest":
        if not any(message.role == "user" for message in self.messages):
            raise ValueError("Mindestens eine Nutzernachricht ist erforderlich")
        return self


class PlaceNote(BaseModel):
    model_config = ConfigDict(extra="forbid")

    place_id: str = Field(min_length=1, max_length=MAX_PLACE_ID_LENGTH)
    text: str = Field(min_length=1, max_length=MAX_MESSAGE_LENGTH)

    @field_validator("text")
    @classmethod
    def text_not_blank(cls, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("Ortshinweis darf nicht leer sein")
        return cleaned


class LlmOutput(BaseModel):
    model_config = ConfigDict(extra="forbid")

    message: str
    place_ids: list[str]
    overview: str = ""
    place_notes: list[PlaceNote] = Field(default_factory=list, max_length=6)

    @field_validator("overview")
    @classmethod
    def overview_stripped(cls, value: str) -> str:
        return value.strip()


class RecommendedPlace(BaseModel):
    id: str
    name: str
    booking_link: str
    booking_url: str = ""
    country: str = ""
    coordinates: dict[str, float] | None = None
    primaervibration: str = ""
    correspondence: str = ""


class ChatSection(BaseModel):
    kind: Literal["overview", "place"]
    text: str
    place_id: str | None = None
    name: str = ""
    country: str = ""
    primaervibration: str = ""


class ChatResponse(BaseModel):
    message: ChatMessage
    shown_place_ids: list[str]
    recommended_places: list[RecommendedPlace]
    sections: list[ChatSection] = Field(default_factory=list)
    source: Literal["llm", "fallback"]
    ai_disclosure: bool = True
    token_notice: Literal["approaching"] | None = None
