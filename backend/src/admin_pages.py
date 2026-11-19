from html import escape


def login_page(error: str | None = None) -> str:
    message = f'<p class="error">{escape(error)}</p>' if error else ""
    return f"""<!doctype html>
<html lang="de">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Soulmap Admin</title>
  <style>
    body {{ font-family: system-ui, sans-serif; margin: 0; background: #f6f4f0; color: #1c1917; }}
    main {{ max-width: 24rem; margin: 12vh auto; padding: 0 1.25rem; }}
    h1 {{ font-size: 1.4rem; }}
    form {{ display: grid; gap: 0.75rem; }}
    label {{ display: grid; gap: 0.3rem; font-size: 0.9rem; }}
    input {{ padding: 0.55rem 0.7rem; border: 1px solid #d6d3d1; border-radius: 0.4rem; }}
    button {{ padding: 0.6rem 0.8rem; border: 0; border-radius: 0.4rem; background: #1c1917; color: #fff; }}
    .error {{ color: #9f1239; }}
  </style>
</head>
<body>
  <main>
    <p>Soulmap Admin</p>
    <h1>Anmelden</h1>
    {message}
    <form method="post" action="/admin/login">
      <label>Benutzername
        <input name="username" value="aku" autocomplete="username" required>
      </label>
      <label>Passwort
        <input name="password" type="password" autocomplete="current-password" required>
      </label>
      <button type="submit">Anmelden</button>
    </form>
  </main>
</body>
</html>
"""


def _rows(items: list[dict], key: str, value: str) -> str:
    if not items:
        return "<tr><td colspan='2'>Keine Daten</td></tr>"
    return "".join(
        f"<tr><td>{escape(str(item.get(key, '')))}</td><td>{escape(str(item.get(value, '')))}</td></tr>"
        for item in items
    )


def _pairs(mapping: dict) -> str:
    if not mapping:
        return "<tr><td colspan='2'>Keine Daten</td></tr>"
    return "".join(
        f"<tr><td>{escape(str(code))}</td><td>{escape(str(count))}</td></tr>"
        for code, count in mapping.items()
    )


_HINTS = {
    "rate_limited": "viele Rate-Limits",
    "short_intervals": "kurze Abstände",
    "identical_prompts": "gleiche Prompts",
    "token_ratio": "Token-Limit nah",
}


def _hint_label(hints: list) -> str:
    if not hints:
        return "—"
    return ", ".join(_HINTS.get(str(item), str(item)) for item in hints)


def _report_section(payload: dict) -> str:
    report = payload.get("monthly_report") or {}
    users = report.get("users") or []
    topics = report.get("topics") or []
    user_rows = "".join(
        "<tr>"
        f"<td>{escape(str(item.get('ip_address', '')))}</td>"
        f"<td>{escape(str(item.get('tokens_used', 0)))} / {escape(str(item.get('token_limit', '')))}</td>"
        f"<td>{escape(str(item.get('first_at', '')))} – {escape(str(item.get('last_at', '')))}"
        f" ({escape(str(item.get('active_seconds', 0)))} s)</td>"
        f"<td>{escape(str(item.get('rate_limited', 0)))}</td>"
        f"<td>{escape(str(item.get('short_gaps', 0)))}</td>"
        f"<td>{escape(str(item.get('identical_prompt_share', 0)))}</td>"
        f"<td>{escape(_hint_label(item.get('hints') or []))}</td>"
        "</tr>"
        for item in users
    ) or "<tr><td colspan='7'>Keine Daten</td></tr>"
    topic_rows = "".join(
        f"<tr><td>{escape(str(item.get('label', '')))}</td><td>{escape(str(item.get('count', 0)))}</td></tr>"
        for item in topics
    ) or "<tr><td colspan='2'>Keine Daten</td></tr>"
    return f"""
    <h2>Monatsreport {escape(str(report.get("month", "")))}</h2>
    <p>Hinweise beschreiben Auffälligkeiten. Sie stufen niemanden als Bot ein.</p>
    <table>
      <tr><th>IP</th><th>Tokens</th><th>Nutzungszeit</th><th>Rate-Limits</th><th>Kurze Abstände</th><th>Gleicher Prompt</th><th>Hinweise</th></tr>
      {user_rows}
    </table>
    <h2>Themen</h2>
    <table>
      <tr><th>Thema</th><th>Anzahl</th></tr>
      {topic_rows}
    </table>
    """


def _chart_section(payload: dict) -> str:
    charts = payload.get("charts") or {}
    figures = (
        ("world", "Weltkarte"),
        ("daily", "Verlauf"),
        ("topics", "Themen"),
        ("tokens", "Tokens"),
    )
    blocks = []
    for key, title in figures:
        src = charts.get(key)
        if not src:
            continue
        blocks.append(
            f"<figure><figcaption>{escape(title)}</figcaption>"
            f'<img alt="{escape(title)}" src="{src}"></figure>'
        )
    if not blocks:
        return ""
    return '<section class="charts">' + "".join(blocks) + "</section>"


def _window_label(llm: dict) -> str:
    window = llm.get("window_15m") or {}
    if not window:
        return "—"
    if window.get("status") == "degraded":
        return "auffällig"
    if int(window.get("chat_turns") or 0) < 3:
        return "wenig Daten"
    return "ruhig"


def _budget_section(payload: dict) -> str:
    trace = payload.get("daily_trace") or {}
    live = trace.get("live") or {}
    hours = trace.get("hours") or []
    peak = max((int(item.get("tokens") or 0) for item in hours), default=0)
    bars = []
    for item in hours:
        tokens = int(item.get("tokens") or 0)
        height = 2 if peak == 0 else max(2, round(tokens / peak * 64))
        mark = " on" if tokens else ""
        bars.append(
            f'<span class="{mark.strip()}" style="height:{height}px" title="{int(item.get("hour", 0)):02d} Uhr: {tokens}"></span>'
        )
    users = trace.get("users") or []
    rows = []
    for item in users:
        power = " class=\"power\"" if item.get("power_user") else ""
        label = "Power-User" if item.get("power_user") else "—"
        rows.append(
            f"<tr{power}>"
            f"<td>{escape(str(item.get('ip_address', '')))}</td>"
            f"<td>{escape(str(item.get('subnet', '')))}</td>"
            f"<td>{escape(str(item.get('tokens_used', 0)))}</td>"
            f"<td>{float(item.get('share') or 0):.1%}</td>"
            f"<td>{escape(str(item.get('calls', 0)))}</td>"
            f"<td>{escape(str(item.get('blocked', 0)))}</td>"
            f"<td>{escape(str(item.get('last_at', '')))}</td>"
            f"<td>{label}</td>"
            "</tr>"
        )
    body = "".join(rows) or "<tr><td colspan='8'>Keine Daten</td></tr>"
    share = float(trace.get("power_user_share") or 0)
    return f"""
    <h2>Tagesbudget {escape(str(trace.get("date", "")))}</h2>
    <p>Gebucht {escape(str(trace.get("tokens_used", 0)))} von {escape(str(trace.get("daily_limit", 0)))} Tokens
    ({float(trace.get("usage_ratio") or 0):.1%}).
    Reserviert heute {escape(str(live.get("daily_reserved", 0)))},
    diese Stunde {escape(str(live.get("hourly_reserved", 0)))} von {escape(str(live.get("hourly_limit", 0)))}.
    Power-User liegen bei mindestens {share:.0%} des Tagesbudgets.</p>
    <div class="daytrace" aria-label="Tages Trace">{"".join(bars)}</div>
    <table>
      <tr><th>IP</th><th>Netz</th><th>Tokens</th><th>Anteil</th><th>Aufrufe</th><th>Geblockt</th><th>Zuletzt</th><th>Hinweis</th></tr>
      {body}
    </table>
    """


def _langfuse_link(payload: dict) -> str:
    raw = str(payload.get("langfuse_url") or "")
    if not raw.startswith("https://"):
        return ""
    href = escape(raw, quote=True)
    return f'<a href="{href}" target="_blank" rel="noopener noreferrer">Langfuse</a>'


def _langfuse_section(payload: dict) -> str:
    widgets = payload.get("langfuse")
    if not isinstance(widgets, dict):
        return ""
    if widgets.get("error"):
        return f"<h2>Langfuse</h2><p class=\"error\">Die Kennzahlen sind gerade nicht erreichbar ({escape(str(widgets.get('error')))}).</p>"
    days = widgets.get("days") or []
    peak = max((int(item.get("calls") or 0) for item in days), default=0)
    bars = []
    for item in days:
        calls = int(item.get("calls") or 0)
        height = 2 if peak == 0 else max(2, round(calls / peak * 64))
        mark = "on" if calls else ""
        bars.append(
            f'<span class="{mark}" style="height:{height}px" title="{escape(str(item.get("date", "")))}: {calls}"></span>'
        )
    return f"""
    <h2>Langfuse, {escape(str(widgets.get("period_days", 7)))} Tage</h2>
    <section class="cards">
      <div class="card"><strong>{escape(str(widgets.get("calls", 0)))}</strong><div>Aufrufe</div></div>
      <div class="card"><strong>{float(widgets.get("cost_usd") or 0):.4f} $</strong><div>Kosten</div></div>
      <div class="card"><strong>{escape(str(widgets.get("tokens", 0)))}</strong><div>Tokens</div></div>
      <div class="card"><strong>{escape(str(widgets.get("latency_ms", 0)))} ms</strong><div>Latenz p95</div></div>
    </section>
    <div class="daytrace" aria-label="Langfuse Aufrufe">{"".join(bars)}</div>
    """


def stats_page(payload: dict) -> str:
    llm = payload.get("llm_monitoring") or {}
    window_label = _window_label(llm)
    events = payload.get("events") or []
    report = _report_section(payload)
    budget = _budget_section(payload)
    langfuse = _langfuse_section(payload)
    charts = _chart_section(payload)
    countries = _rows(payload.get("top_countries") or [], "country_code", "count")
    clicked = _rows(payload.get("top_clicked_places") or [], "place_id", "clicks")
    fallbacks = _pairs(llm.get("fallback_by_code") or {})
    raw_rows = "".join(
        "<tr>"
        + "".join(
            f"<td>{escape(str(item.get(field, '')))}</td>"
            for field in (
                "id",
                "event_type",
                "occurred_at",
                "country_code",
                "os_language",
                "place_id",
                "llm_status",
                "error_code",
                "ip_address",
                "user_prompt",
            )
        )
        + "</tr>"
        for item in events
    )
    raw_section = (
        f"""
        <h2>Rohdaten</h2>
        <table>
          <tr><th>ID</th><th>Typ</th><th>Zeit</th><th>Land</th><th>OS-Sprache</th><th>Ort</th><th>LLM</th><th>Fehler</th><th>IP</th><th>Prompt</th></tr>
          {raw_rows or "<tr><td colspan='10'>Keine Events</td></tr>"}
        </table>
        """
        if events
        else '<p><a href="/admin?raw=true">Rohdaten anzeigen</a></p>'
    )
    return f"""<!doctype html>
<html lang="de">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Soulmap Statistik</title>
  <style>
    body {{ font-family: system-ui, sans-serif; margin: 0; background: #f6f4f0; color: #1c1917; }}
    main {{ max-width: 64rem; margin: 2rem auto; padding: 0 1.25rem 3rem; }}
    .charts {{ display: grid; gap: 1.25rem; margin: 1.5rem 0; }}
    .charts figure {{ margin: 0; background: #fff; border-radius: 0.5rem; padding: 0.6rem; }}
    .charts img {{ width: 100%; height: auto; }}
    .charts figcaption {{ font-size: 0.95rem; margin-bottom: 0.4rem; }}
    header {{ display: flex; justify-content: space-between; align-items: center; gap: 1rem; }}
    .cards {{ display: grid; grid-template-columns: repeat(auto-fit, minmax(10rem, 1fr)); gap: 0.75rem; }}
    .card {{ background: #fff; border-radius: 0.5rem; padding: 0.9rem; }}
    .daytrace {{ display: flex; align-items: flex-end; gap: 3px; height: 4.5rem; background: #fff; border-radius: 0.5rem; padding: 0.6rem; margin: 0.8rem 0 1.2rem; }}
    .daytrace span {{ flex: 1; background: #d6d3d1; border-radius: 2px 2px 0 0; min-height: 2px; }}
    .daytrace span.on {{ background: #b45309; }}
    tr.power td {{ background: #fff7ed; }}
    table {{ width: 100%; border-collapse: collapse; background: #fff; }}
    th, td {{ text-align: left; padding: 0.45rem 0.6rem; border-bottom: 1px solid #e7e5e4; font-size: 0.92rem; }}
    button {{ padding: 0.4rem 0.7rem; border: 0; border-radius: 0.4rem; background: #1c1917; color: #fff; }}
    .tools {{ display: flex; align-items: center; gap: 0.75rem; }}
    .tools a {{ color: #1c1917; }}
  </style>
</head>
<body>
  <main>
    <header>
      <div>
        <p>Soulmap Admin</p>
        <h1>Statistik {escape(str(payload.get("period", "")))}</h1>
      </div>
      <div class="tools">
        {_langfuse_link(payload)}
        <form method="post" action="/admin/logout"><button type="submit">Abmelden</button></form>
      </div>
    </header>
    {budget}
    {langfuse}
    <section class="cards">
      <div class="card"><strong>{escape(str(payload.get("form_submissions", 0)))}</strong><div>Formulare</div></div>
      <div class="card"><strong>{escape(str(payload.get("result_views", 0)))}</strong><div>Ergebnisse</div></div>
      <div class="card"><strong>{escape(str(payload.get("conversion_rate", 0)))}</strong><div>Conversion</div></div>
      <div class="card"><strong>{escape(str(payload.get("affiliate_clicks", 0)))}</strong><div>Affiliate-Klicks</div></div>
      <div class="card"><strong>{escape(str(payload.get("click_through_rate", 0)))}</strong><div>CTR</div></div>
      <div class="card"><strong>{escape(str(llm.get("fallback_rate", 0)))}</strong><div>Fallback-Rate</div></div>
      <div class="card"><strong>{escape(str(llm.get("avg_latency_ms", 0)))} ms</strong><div>LLM-Latenz</div></div>
      <div class="card"><strong>{escape(window_label)}</strong><div>15 Minuten</div></div>
    </section>
    {charts}
    <h2>Herkunft</h2>
    <table>
      <tr><th>Land</th><th>Anzahl</th></tr>
      {countries}
    </table>
    <h2>Beliebte Orte</h2>
    <table>
      <tr><th>Ort</th><th>Klicks</th></tr>
      {clicked}
    </table>
    <h2>Fallback nach Code</h2>
    <table>
      <tr><th>Code</th><th>Anzahl</th></tr>
      {fallbacks}
    </table>
    {report}
    {raw_section}
  </main>
</body>
</html>
"""
