"""Lädt die MaxMind-Ausgaben aus GeoIP.conf nach backend/data.

Der Lizenzschlüssel bleibt in der Konfigurationsdatei und wird nicht ausgegeben.
"""

import io
import ssl
import sys
import tarfile
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

try:
    import certifi
except ImportError:
    certifi = None

ROOT = Path(__file__).resolve().parents[2]
DEFAULT_CONF = ROOT / "frontend" / "GeoIP.conf"
DEST = ROOT / "backend" / "data"
DOWNLOAD = "https://download.maxmind.com/app/geoip_download"


def _conf(path: Path) -> dict[str, str]:
    values: dict[str, str] = {}
    for raw in path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#"):
            continue
        key, value = line.split(None, 1)
        values[key] = value
    return values


def main() -> int:
    conf_path = Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_CONF
    if not conf_path.exists():
        print(f"GeoIP-Konfiguration fehlt: {conf_path}", file=sys.stderr)
        return 1
    conf = _conf(conf_path)
    license_key = conf.get("LicenseKey", "")
    editions = conf.get("EditionIDs", "").split()
    if not license_key or not editions:
        print("LicenseKey oder EditionIDs fehlen in der Konfiguration.", file=sys.stderr)
        return 1

    DEST.mkdir(parents=True, exist_ok=True)
    for edition in editions:
        query = urllib.parse.urlencode(
            {"edition_id": edition, "license_key": license_key, "suffix": "tar.gz"}
        )
        url = f"{DOWNLOAD}?{query}"
        print(f"Lade {edition} …", flush=True)
        context = (
            ssl.create_default_context(cafile=certifi.where())
            if certifi is not None
            else ssl.create_default_context()
        )
        try:
            with urllib.request.urlopen(url, timeout=180, context=context) as response:
                payload = response.read()
        except urllib.error.HTTPError as exc:
            print(f"{edition}: Download fehlgeschlagen ({exc.code}).", file=sys.stderr)
            return 1
        except urllib.error.URLError as exc:
            reason = getattr(exc, "reason", exc)
            print(f"{edition}: Download nicht erreichbar ({type(reason).__name__}).", file=sys.stderr)
            return 1
        with tarfile.open(fileobj=io.BytesIO(payload), mode="r:gz") as archive:
            member = next(item for item in archive.getmembers() if item.name.endswith(".mmdb"))
            target = DEST / Path(member.name).name
            extracted = archive.extractfile(member)
            if extracted is None:
                print(f"{edition}: Archiv ohne Datenbank.", file=sys.stderr)
                return 1
            target.write_bytes(extracted.read())
        print(f"{edition}: {target.name} ({target.stat().st_size} Bytes)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
