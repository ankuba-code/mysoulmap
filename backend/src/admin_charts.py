import base64
import csv
import os
from io import BytesIO
from pathlib import Path

os.environ.setdefault("MPLBACKEND", "Agg")

import matplotlib.pyplot as plt  # noqa: E402
import pandas as pd  # noqa: E402
import seaborn as sns  # noqa: E402

_CENTROIDS: dict[str, tuple[float, float]] | None = None
_COLORS = ["#1c1917", "#b45309", "#78716c"]


def attach_charts(payload: dict) -> dict:
    enriched = dict(payload)
    enriched["charts"] = render_admin_charts(payload)
    return enriched


def render_admin_charts(payload: dict) -> dict[str, str]:
    sns.set_theme(style="whitegrid")
    figures = {
        "world": _world(payload.get("top_countries") or []),
        "daily": _daily(payload.get("daily") or []),
        "topics": _ranked(_topic_rows(payload), "Themen", "Anzahl"),
        "tokens": _tokens((payload.get("monthly_report") or {}).get("users") or []),
    }
    return {name: _png(figure) for name, figure in figures.items()}


def _topic_rows(payload: dict) -> list[dict]:
    topics = (payload.get("monthly_report") or {}).get("topics") or []
    return [{"label": _short(item.get("label") or ""), "count": int(item.get("count") or 0)} for item in topics]


def _world(countries: list[dict]):
    centroids = _centroids()
    base = pd.DataFrame(
        [{"lon": lon, "lat": lat} for lon, lat in centroids.values()],
    )
    fig, axes = plt.subplots(
        1,
        2,
        figsize=(11, 4.4),
        gridspec_kw={"width_ratios": [1.7, 1]},
    )
    map_axis, bar_axis = axes
    if not base.empty:
        sns.scatterplot(
            data=base,
            x="lon",
            y="lat",
            color="#d6d3d1",
            s=14,
            ax=map_axis,
            legend=False,
        )
    points = []
    for item in countries:
        code = str(item.get("country_code") or "").upper()
        center = centroids.get(code)
        if center is None:
            continue
        points.append({"lon": center[0], "lat": center[1], "count": int(item.get("count") or 0), "land": code})
    if points:
        sns.scatterplot(
            data=pd.DataFrame(points),
            x="lon",
            y="lat",
            size="count",
            hue="count",
            palette="flare",
            sizes=(50, 320),
            ax=map_axis,
            legend=False,
        )
    map_axis.set_xlim(-180, 180)
    map_axis.set_ylim(-60, 85)
    map_axis.set_aspect("equal", adjustable="box")
    map_axis.set_title("Weltkarte")
    map_axis.set_xlabel("")
    map_axis.set_ylabel("")
    ranked = pd.DataFrame(
        [{"Land": str(item.get("country_code") or ""), "Ereignisse": int(item.get("count") or 0)} for item in countries]
    )
    if ranked.empty:
        _note(bar_axis, "Keine Herkunft")
    else:
        sns.barplot(data=ranked, y="Land", x="Ereignisse", color="#1c1917", ax=bar_axis)
        bar_axis.set_title("Länder")
    fig.tight_layout()
    return fig


def _daily(rows: list[dict]):
    long_rows = []
    for row in rows:
        day = str(row.get("date") or "")
        long_rows.extend(
            [
                {"Tag": day, "Anzahl": int(row.get("form_submissions") or 0), "Reihe": "Formulare"},
                {"Tag": day, "Anzahl": int(row.get("result_views") or 0), "Reihe": "Ergebnisse"},
                {"Tag": day, "Anzahl": int(row.get("fallbacks") or 0), "Reihe": "Fallbacks"},
            ]
        )
    fig, axis = plt.subplots(figsize=(10, 3.6))
    if not long_rows:
        return _blank(fig, axis, "Verlauf")
    frame = pd.DataFrame(long_rows)
    sns.lineplot(data=frame, x="Tag", y="Anzahl", hue="Reihe", marker="o", palette=_COLORS, ax=axis)
    axis.set_title("Verlauf")
    axis.tick_params(axis="x", labelrotation=45)
    fig.tight_layout()
    return fig


def _ranked(rows: list[dict], title: str, value_name: str):
    fig, axis = plt.subplots(figsize=(10, 4.2))
    if not rows:
        return _blank(fig, axis, title)
    frame = pd.DataFrame(rows).head(12)
    sns.barplot(data=frame, y="label", x="count", color="#b45309", ax=axis)
    axis.set_title(title)
    axis.set_xlabel(value_name)
    axis.set_ylabel("")
    fig.tight_layout()
    return fig


def _tokens(users: list[dict]):
    fig, axis = plt.subplots(figsize=(10, 3.8))
    if not users:
        return _blank(fig, axis, "Tokens")
    frame = pd.DataFrame(
        [
            {
                "IP": str(item.get("ip_address") or ""),
                "Tokens": int(item.get("tokens_used") or 0),
            }
            for item in users[:12]
        ]
    )
    sns.barplot(data=frame, x="IP", y="Tokens", color="#1c1917", ax=axis)
    limit = int(users[0].get("token_limit") or 0)
    if limit:
        axis.axhline(limit, color="#b45309", linestyle="--", linewidth=1)
    axis.set_title("Tokens gegen Limit")
    axis.tick_params(axis="x", labelrotation=30)
    fig.tight_layout()
    return fig


def _blank(fig, axis, title: str):
    axis.set_axis_off()
    axis.set_title(title)
    axis.text(0.5, 0.5, "Keine Daten", ha="center", va="center", transform=axis.transAxes)
    return fig


def _note(axis, title: str) -> None:
    axis.set_axis_off()
    axis.set_title(title)
    axis.text(0.5, 0.5, "Keine Daten", ha="center", va="center", transform=axis.transAxes)


def _png(fig) -> str:
    buffer = BytesIO()
    fig.savefig(buffer, format="png", dpi=120, bbox_inches="tight", facecolor="white")
    plt.close(fig)
    encoded = base64.b64encode(buffer.getvalue()).decode("ascii")
    return f"data:image/png;base64,{encoded}"


def _short(text: str) -> str:
    cleaned = " ".join(text.split())
    if len(cleaned) <= 48:
        return cleaned
    return cleaned[:47] + "…"


def _centroids() -> dict[str, tuple[float, float]]:
    global _CENTROIDS
    if _CENTROIDS is not None:
        return _CENTROIDS
    path = Path(__file__).resolve().parent.parent / "data" / "country_centroids.csv"
    loaded: dict[str, tuple[float, float]] = {}
    with path.open(newline="", encoding="utf-8") as handle:
        for row in csv.DictReader(handle):
            code = (row.get("country") or "").upper()
            lon = (row.get("longitude") or "").strip()
            lat = (row.get("latitude") or "").strip()
            if not code or not lon or not lat:
                continue
            loaded[code] = (float(lon), float(lat))
    _CENTROIDS = loaded
    return loaded
