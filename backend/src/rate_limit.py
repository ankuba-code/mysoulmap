from slowapi import Limiter
from slowapi.util import get_remote_address

LIMIT_CHAT = "20/minute"
LIMIT_MATCH = "20/minute"
LIMIT_ATLAS = "60/minute"
LIMIT_GO = "30/minute"
LIMIT_ADMIN_STATS = "10/minute"
LIMIT_ADMIN_LOGIN = "5/minute"

limiter = Limiter(key_func=get_remote_address, default_limits=[])
atlas_limit = limiter.shared_limit(LIMIT_ATLAS, scope="atlas")


def reset_rate_limits() -> None:
    inner = getattr(limiter, "limiter", None) or getattr(limiter, "_limiter", None)
    storage = getattr(inner, "storage", None) if inner is not None else None
    if storage is None:
        return
    reset = getattr(storage, "reset", None)
    if callable(reset):
        reset()
        return
    raw = getattr(storage, "storage", None)
    if isinstance(raw, dict):
        raw.clear()
