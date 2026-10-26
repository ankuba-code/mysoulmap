import os

import bcrypt
from itsdangerous import BadSignature, SignatureExpired, URLSafeTimedSerializer

ADMIN_USERNAME = "aku"
COOKIE_NAME = "soulmap_admin"
COOKIE_PATH = "/"
SESSION_MAX_AGE = 12 * 60 * 60


class AdminNotConfiguredError(RuntimeError):
    pass


def decode_password_hash(raw: str) -> bytes:
    value = raw.strip()
    if not value:
        return b""
    if value.startswith("$2"):
        return value.encode("utf-8")
    try:
        decoded = bytes.fromhex(value)
    except ValueError:
        return value.encode("utf-8")
    return decoded


def _signer() -> URLSafeTimedSerializer:
    secret = os.getenv("ADMIN_SESSION_SECRET") or os.getenv("ADMIN_PASSWORD_HASH")
    if not secret:
        raise AdminNotConfiguredError
    return URLSafeTimedSerializer(secret, salt="soulmap-admin")


def verify_admin(username: str, password: str) -> bool:
    if username != ADMIN_USERNAME:
        return False
    hashed = decode_password_hash(os.getenv("ADMIN_PASSWORD_HASH", ""))
    if not hashed:
        return False
    try:
        return bcrypt.checkpw(password.encode("utf-8"), hashed)
    except (ValueError, TypeError):
        return False


def create_session_token() -> str:
    return _signer().dumps({"u": ADMIN_USERNAME})


def read_session_token(token: str) -> bool:
    try:
        data = _signer().loads(token, max_age=SESSION_MAX_AGE)
    except (BadSignature, SignatureExpired, AdminNotConfiguredError):
        return False
    return data.get("u") == ADMIN_USERNAME


def is_admin_session(token: str | None) -> bool:
    return bool(token and read_session_token(token))
