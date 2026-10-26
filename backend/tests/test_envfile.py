import os

from src.envfile import load_env_file, load_local_env


def test_load_env_file_fills_missing_and_keeps_existing(tmp_path) -> None:
    env_file = tmp_path / ".env"
    env_file.write_text(
        "\n".join(
            [
                "# kommentar",
                "OPENAI_API_KEY=from-file",
                "export DATABASE_URL=mysql://should-not-win",
                "EMPTY=",
                "QUOTED=\"abc\"",
            ]
        )
    )
    environ = {"DATABASE_URL": "sqlite://"}
    load_env_file(env_file, environ)
    assert environ["OPENAI_API_KEY"] == "from-file"
    assert environ["DATABASE_URL"] == "sqlite://"
    assert environ["EMPTY"] == ""
    assert environ["QUOTED"] == "abc"


def test_load_local_env_skips_during_pytest(monkeypatch) -> None:
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    load_local_env()
    assert os.getenv("OPENAI_API_KEY") is None
