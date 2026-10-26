import logging
from datetime import datetime, timezone

from sqlmodel import Session

from .db import get_engine, init_db
from .stats import purge_old_events

logger = logging.getLogger("soulmap.purge")


def run_purge(now: datetime | None = None) -> int:
    moment = now or datetime.now(timezone.utc).replace(tzinfo=None)
    with Session(get_engine()) as session:
        deleted = purge_old_events(session, moment)
    logger.info("purged_usage_events", extra={"deleted": deleted})
    return deleted


if __name__ == "__main__":
    init_db()
    count = run_purge()
    raise SystemExit(0 if count >= 0 else 1)
