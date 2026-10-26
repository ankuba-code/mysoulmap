import os
import sys
from pathlib import Path


def load_env_file(path: Path, environ: dict[str, str] | None = None) -> None:
    """Setze fehlende Variablen aus einer .env-Datei. Vorhandene Werte bleiben."""
    target = os.environ if environ is None else environ
    if not path.is_file():
        return
    for raw in path.read_text().splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        if line.startswith("export "):
            line = line[len("export ") :].strip()
        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip()
        if len(value) >= 2 and value[0] == value[-1] and value[0] in {'"', "'"}:
            value = value[1:-1]
        if key and key not in target:
            target[key] = value


def load_local_env() -> None:
    if "pytest" in sys.modules:
        return
    root = Path(__file__).resolve().parents[2]
    load_env_file(root / ".env")
