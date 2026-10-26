import os
from collections.abc import Iterator
from pathlib import Path
from urllib.parse import quote_plus

from sqlmodel import Session, SQLModel, create_engine

_engine = None


def get_database_url() -> str:
    explicit = os.getenv("DATABASE_URL")
    if explicit:
        return explicit
    user = os.getenv("MYSQL_USER", "soulmap")
    password = os.getenv("MYSQL_PASSWORD", "")
    host = os.getenv("MYSQL_HOST", "db")
    database = os.getenv("MYSQL_DATABASE", "soulmap")
    return (
        f"mysql+pymysql://{quote_plus(user)}:{quote_plus(password)}"
        f"@{host}:3306/{database}"
    )


def get_engine():
    global _engine
    if _engine is None:
        url = get_database_url()
        kwargs: dict = {"pool_pre_ping": True}
        if url.startswith("sqlite"):
            from sqlalchemy.pool import StaticPool

            kwargs["connect_args"] = {"check_same_thread": False}
            kwargs["poolclass"] = StaticPool
        _engine = create_engine(url, **kwargs)
    return _engine


def reset_engine() -> None:
    global _engine
    if _engine is not None:
        _engine.dispose()
    _engine = None


def get_session() -> Iterator[Session]:
    with Session(get_engine()) as session:
        yield session


def init_db() -> None:
    url = get_database_url()
    if url.startswith("sqlite"):
        SQLModel.metadata.create_all(get_engine())
        return
    import fcntl

    from alembic import command
    from alembic.config import Config

    ini = Path(__file__).resolve().parent.parent / "alembic.ini"
    config = Config(str(ini))
    lock_path = Path("/tmp/soulmap-alembic.lock")
    with lock_path.open("w") as fh:
        fcntl.flock(fh, fcntl.LOCK_EX)
        command.upgrade(config, "head")
