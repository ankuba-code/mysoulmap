import os

import bcrypt
import pytest

TEST_ADMIN_PASSWORD = "phase4-test-pass"

os.environ["DATABASE_URL"] = "sqlite://"
os.environ["BOOKING_AFFILIATE_ID"] = "test-aid"
os.environ["ADMIN_PASSWORD_HASH"] = bcrypt.hashpw(
    TEST_ADMIN_PASSWORD.encode("utf-8"),
    bcrypt.gensalt(),
).hex()

from src.db import init_db  # noqa: E402
from src.models_events import UsageEvent  # noqa: E402, F401
from src.rate_limit import reset_rate_limits  # noqa: E402

init_db()


@pytest.fixture(autouse=True)
def _reset_rate_limits() -> None:
    reset_rate_limits()
