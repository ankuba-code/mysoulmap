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


def stats_page(payload: dict) -> str:
    llm = payload.get("llm_monitoring") or {}
    events = payload.get("events") or []
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
                "place_id",
                "llm_status",
                "error_code",
                "ip_address",
            )
        )
        + "</tr>"
        for item in events
    )
    raw_section = (
        f"""
        <h2>Rohdaten</h2>
        <table>
          <tr><th>ID</th><th>Typ</th><th>Zeit</th><th>Land</th><th>Ort</th><th>LLM</th><th>Fehler</th><th>IP</th></tr>
          {raw_rows or "<tr><td colspan='8'>Keine Events</td></tr>"}
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
    main {{ max-width: 52rem; margin: 2rem auto; padding: 0 1.25rem 3rem; }}
    header {{ display: flex; justify-content: space-between; align-items: center; gap: 1rem; }}
    .cards {{ display: grid; grid-template-columns: repeat(auto-fit, minmax(10rem, 1fr)); gap: 0.75rem; }}
    .card {{ background: #fff; border-radius: 0.5rem; padding: 0.9rem; }}
    table {{ width: 100%; border-collapse: collapse; background: #fff; }}
    th, td {{ text-align: left; padding: 0.45rem 0.6rem; border-bottom: 1px solid #e7e5e4; font-size: 0.92rem; }}
    button {{ padding: 0.4rem 0.7rem; border: 0; border-radius: 0.4rem; background: #1c1917; color: #fff; }}
  </style>
</head>
<body>
  <main>
    <header>
      <div>
        <p>Soulmap Admin</p>
        <h1>Statistik {escape(str(payload.get("period", "")))}</h1>
      </div>
      <form method="post" action="/admin/logout"><button type="submit">Abmelden</button></form>
    </header>
    <section class="cards">
      <div class="card"><strong>{escape(str(payload.get("form_submissions", 0)))}</strong><div>Formulare</div></div>
      <div class="card"><strong>{escape(str(payload.get("result_views", 0)))}</strong><div>Ergebnisse</div></div>
      <div class="card"><strong>{escape(str(payload.get("conversion_rate", 0)))}</strong><div>Conversion</div></div>
      <div class="card"><strong>{escape(str(payload.get("affiliate_clicks", 0)))}</strong><div>Affiliate-Klicks</div></div>
      <div class="card"><strong>{escape(str(payload.get("click_through_rate", 0)))}</strong><div>CTR</div></div>
      <div class="card"><strong>{escape(str(llm.get("fallback_rate", 0)))}</strong><div>Fallback-Rate</div></div>
      <div class="card"><strong>{escape(str(llm.get("avg_latency_ms", 0)))} ms</strong><div>LLM-Latenz</div></div>
    </section>
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
    {raw_section}
  </main>
</body>
</html>
"""
