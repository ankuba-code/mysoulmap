from sqlmodel import Session

from .models_settings import AppSetting

CHAT_MODEL_KEY = "chat_model"
CHAT_HALT_KEY = "chat_halt"
HALT_ON = "on"
HALT_OFF = "off"
DEFAULT_CHAT_MODEL = "gpt-5-mini"
CHAT_MODELS = {
    "gpt-5-mini": "openai/gpt-5-mini",
    "claude-haiku-5-5": "anthropic/claude-haiku-5.5",
}


def active_chat_model(session: Session) -> str:
    row = session.get(AppSetting, CHAT_MODEL_KEY)
    if row is not None and row.value in CHAT_MODELS:
        return row.value
    return DEFAULT_CHAT_MODEL


def set_chat_model(session: Session, model_id: str) -> str:
    if model_id not in CHAT_MODELS:
        raise ValueError(model_id)
    row = session.get(AppSetting, CHAT_MODEL_KEY)
    if row is None:
        session.add(AppSetting(key=CHAT_MODEL_KEY, value=model_id))
    else:
        row.value = model_id
    session.commit()
    return model_id


def chat_is_halted(session: Session) -> bool:
    row = session.get(AppSetting, CHAT_HALT_KEY)
    return row is not None and row.value == HALT_ON


def set_chat_halt(session: Session, halted: bool) -> bool:
    value = HALT_ON if halted else HALT_OFF
    row = session.get(AppSetting, CHAT_HALT_KEY)
    if row is None:
        session.add(AppSetting(key=CHAT_HALT_KEY, value=value))
    else:
        row.value = value
    session.commit()
    return halted
