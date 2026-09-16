# Soulmap Softwarespezifikation 2.0 (kompakt)

**Datum:** 16.09.2026 · **Status:** Entwurf · **Update:** LLM OpenAI `gpt-5-mini`; Risikoanalyse KI-Funktionen integriert (Abschnitt 10)
**Vollständige Version mit ausführlicher Begründung:** `soulmap-softwarespezifikation.md`

---

## 1. Überblick

Soulmap ist eine **öffentlich erreichbare, vollständig anonyme Web-App**, die auf Basis eines kuratierten Atlas von 40 spirituell/symbolisch bedeutsamen Orten Kurzreisen empfiehlt. Über eine eigene Domain erreichbar, von einer externen Webseite aus verlinkt (kein iframe).

**Kernprinzipien:**
- Kein Login, kein Nutzerkonto, kein Abo/Billing.
- `/chat` ist zustandslos: Client hält den Konversationsverlauf, Server speichert nichts davon.
- Empfehlungen sind strikt auf die 40 Atlas-Orte begrenzt (Scope-Regel).
- Einzige Persistenz: eine schlanke MySQL-Tabelle für anonyme Nutzungsstatistik.
- Drei Funktionen: KI-Chat-Empfehlung (mit deterministischem Fallback bei LLM-Ausfall), clientseitiger PDF-/Screenshot-Export, internes Statistik-Dashboard (zugleich LLM-Monitoring/Tracing).

**Stakeholder:** Andre (Product Owner, Betreiber, technische Umsetzung) und Guillermo Rodini (Buchautor, SEELENWEGE-Manuskript als inhaltliche Grundlage des Atlas).

---

## 2. Architektur

```
Externe Webseite → (Link) → Soulmap-Frontend (React/Vite/Tailwind)
                                   │ HTTPS/JSON, CORS auf eigene Domain
                                   ▼
                    REST-API (FastAPI, zustandslos, Rate-Limits)
                        │            │            │
                   Atlas-Service  OpenAI API  GeoIP (lokal)
                  (places.json)   (+ Fallback-        │
                                   Logik bei Ausfall)  ▼
                                         MySQL: usage_events (Statistik)
                                                       │
                                    /admin (Login: aku + Passwort) → Dashboard
```

MySQL wird **ausschließlich** für Statistik verwendet, nicht für Konversationsdaten. `places.json` wird beim Serverstart geladen (kein Hot-Reload).

---

## 3. Technologie-Stack

| Bereich | Technologie | Kurzbegründung |
|---|---|---|
| Backend | Python 3.12+, FastAPI, Uvicorn+Gunicorn | async I/O für LLM-Calls, Pydantic-Validierung eingebaut |
| Atlas-Daten | `places.json` (statisch) | keine DB nötig für 40 unveränderliche Einträge |
| Statistik-DB | MySQL 8.x (eine Tabelle), **SQLModel** + Alembic | SQLModel vereint Pydantic + SQLAlchemy in einer Klasse, minimaler Umfang |
| LLM-Validierung | OpenAI Structured Outputs + Pydantic-Modell | erzwingt festes JSON-Format der Antwort, Fehlschlag löst Fallback aus |
| Fallback-Logik | eigene, deterministische Python-Logik (Keyword-Matching) | funktioniert ohne OpenAI API, siehe 5.2 |
| GeoIP | `geoip2` + MaxMind GeoLite2 | lokale IP→Land-Auflösung, kein Drittanbieter-Versand |
| LLM | OpenAI API (`gpt-5-mini`) | bestehender Systemprompt |
| Rate-Limiting | `slowapi`, IP-basiert | einziger Abuse-Schutz ohne Endnutzer-Auth |
| Admin-Auth | fester User `aku` + generiertes, `bcrypt`-gehashtes Passwort, Session-Cookie | echter Login fürs Statistik-Dashboard statt API-Key |
| Frontend | React 18+, Vite, Tailwind CSS, `recharts` | Client-State für Konversationsverlauf, Dashboard-Diagramme |
| Export | jsPDF, html2canvas | rein clientseitig, kein Backend-Endpunkt |
| Affiliate | Booking.com Partnerprogramm | serverseitige Link-Generierung + Redirect-Tracking |
| Deployment | Docker, nginx, Hostinger-VPS (KVM) | reproduzierbar, Docker-fähig |
| CI/CD | **GitHub Actions**, getrennte Dev-/Prod-Pipelines | automatisiertes Testen/Deployen, GitHub Environments für Secret-Trennung |
| Tests | pytest, httpx | async-kompatibel |

---

## 4. Datenmodell

### 4.1 Atlas (`places.json`, statisch, Schema v2)

```json
{
  "places": [
    {
      "schemaVersion": 2,
      "id": "mp",
      "name": "Machu Picchu",
      "country": "Peru",
      "region": null,
      "coordinates": { "lat": -13.1631, "lng": -72.545 },
      "element": "Erde",
      "archetyp": "Der Pilger",
      "primaervibration": "Ehrfurcht",
      "correspondence": "Bergnebel, Terrassen, verlorene Stadt",
      "keywords": ["Anden", "Inka", "Höhenwanderung"]
    }
  ]
}
```
Pflichtfelder: `schemaVersion`, `id`, `name`, `country`, `coordinates`, `element`, `archetyp`, `primaervibration`, `correspondence`, `keywords`. `region` optional/nullbar. Fail-Fast-Validierung beim Start.

### 4.2 Statistik (MySQL, Tabelle `usage_events`)

| Feld | Typ | Zweck |
|---|---|---|
| id | BIGINT PK | |
| event_type | ENUM('form_submission','result_view','affiliate_click') | Ereignisart |
| occurred_at | DATETIME | Zeitpunkt |
| ip_address | VARCHAR(45) | Monitoring/Missbrauchsschutz |
| country_code | CHAR(2) | per GeoIP abgeleitet |
| place_id | VARCHAR(20) NULL | nur bei `affiliate_click` |
| llm_latency_ms / llm_input_tokens / llm_output_tokens | — | nur bei `result_view` + `llm_status='success'` |
| llm_status | ENUM('success','error','fallback') | `fallback` = OpenAI nicht erreichbar/Antwort ungültig, deterministische Ersatzempfehlung genutzt |
| error_code | VARCHAR(50) NULL | Tracing, u. a. `OPENAI_TIMEOUT`, `OPENAI_UNAVAILABLE`, `LLM_RESPONSE_INVALID` |

Keine Konversationsinhalte, kein Cookie/Fingerprinting. **Löschfrist: 6 Monate**, danach automatische Löschung. Kein separates Backup (Hostinger-VPS-Backup deckt das ab).

---

## 5. REST-API

Basis: `/api/v1`, kein Auth-Header (anonym).

| Methode | Endpunkt | Zweck |
|---|---|---|
| GET | `/atlas/places`, `/atlas/places/{id}` | Atlas lesen |
| POST | `/chat` | Zustandslose Empfehlung; Client schickt vollständigen Verlauf + `shown_place_ids`; OpenAI (`gpt-5-mini`) antwortet strukturiert (JSON-Schema), bei Ausfall/Validierungsfehler greift die Fallback-Logik (5.9 der Vollversion) |
| GET | `/go/{place_id}` | Loggt `affiliate_click`, leitet per 302 zu Booking.com |
| POST | `/admin/login` / `/admin/logout` | Login (`aku` + Passwort) für das Statistik-Dashboard |
| GET | `/admin/stats` | Aggregierte Kennzahlen fürs Dashboard, session-geschützt |
| GET | `/health` | Health-Check |

**`/chat`-Response enthält u. a.:** `message`, `shown_place_ids`, `recommended_places[]` (mit `booking_link` als `/go/{id}`-Pfad), `source` (`"llm"` oder `"fallback"`), `ai_disclosure` (Art.-50-Flag).

**Ausfallverhalten OpenAI API:** 20 s Timeout, ein Retry bei transienten Fehlern; schlägt auch das fehl oder ist die strukturierte Antwort ungültig, liefert die **Fallback-Empfehlungslogik** 1–2 deterministisch per Keyword-Matching berechnete Atlas-Orte statt eines Fehlers — geloggt als `llm_status='fallback'`.

**PDF/Screenshot-Export:** rein clientseitig (jsPDF/html2canvas), kein Backend-Kontakt.

---

## 6. Sicherheit

**Prompt-Injection-Schutz (`/chat`):**
- Systemprompt ausschließlich als `role: "system"`-Nachricht, nie String-Konkatenation
- Client-gelieferter Verlauf gilt nur als Anzeige, nie als Autorität
- Output-Scope-Validierung gegen `places.json` als Backstop, unabhängig vom Verlauf
- Systemprompt-Exfiltration explizit verboten
- Input-Grenzen (max. Turns/Zeichen), kein Tool-/Code-Zugriff des Modells
- Frontend: kein `dangerouslySetInnerHTML` mit rohem Modelltext (XSS-Schutz)

**Rate-Limits (pro IP):**

| Endpunkt | Limit |
|---|---|
| `/chat` | 20/min |
| `/atlas/*` | 60/min |
| `/go/{id}` | 30/min |
| `/admin/stats` | 10/min |
| `/admin/login` | 5/min (Brute-Force-Schutz) |

**Weitere Maßnahmen:** CORS nur eigene Domain, Security-Header (CSP, HSTS, `X-Content-Type-Options`, `Referrer-Policy`), `X-Forwarded-For` nur von nginx akzeptiert (Spoofing-Schutz).

---

## 6a. Fallback-Empfehlungslogik & Statistik-Dashboard (neu)

**Fallback (bei OpenAI-Ausfall/ungültiger Antwort):** Rein deterministisches Keyword-Matching der aktuellen Nutzereingabe gegen `keywords`/`element`/`archetyp`/`correspondence` aller nicht bereits gezeigten Atlas-Orte → 1–2 Orte mit höchstem Score (bei Score 0: zufällige Auswahl). `message.content` ist ein fixer, mehrsprachiger Textbaustein, kein LLM-Output. Läuft komplett ohne externe Abhängigkeit, damit garantiert erreichbar.

**Statistik-Dashboard (`/admin`, geschützt):**
- Login: fester Benutzername **`aku`** + generiertes, `bcrypt`-gehashtes Passwort, Session-Cookie (12h Gültigkeit) statt statischem API-Key.
- Menüpunkte: Übersicht (Zeitreihe, Conversion-Rate), Herkunft (Top-Länder), Beliebte Orte (Top-Klicks), **LLM-Ausfälle/Fallback-Nutzung** (eigener Menüpunkt: Fallback-Rate über Zeit, Verteilung nach `error_code`), Rohdaten (`?raw=true`, zusätzlich abgesichert).
- Diagramme via `recharts` im React-Frontend.

---

## 7. Deployment (Hostinger-VPS)

| Ressource | Minimum | Empfehlung |
|---|---|---|
| CPU | 1 vCPU | 2 vCPU |
| RAM | 4 GB | 8 GB |
| Storage | 50 GB NVMe | 50–100 GB NVMe |
| Bandbreite | 4 TB/Monat | 4–8 TB/Monat |

Entspricht etwa **KVM 1 (Minimum) / KVM 2 (Empfehlung)**. Ubuntu 22.04/24.04 LTS, Docker + Docker Compose, nginx als Reverse-Proxy mit TLS (Let's Encrypt). Node.js nur für den Build (CI/CD), nicht zwingend auf dem VPS. Nur Port 80/443/22 öffentlich. Wöchentliches VPS-Backup durch Hostinger inklusive.

**CI/CD:** GitHub Actions mit zwei getrennten Pipelines — `dev` (Trigger: Push auf `develop`, automatisches Deployment auf Staging) und `prod` (Trigger: Push/Merge auf `main`, optionale manuelle Freigabe via GitHub Environment, danach Deployment auf den Hostinger-VPS). Beide Pipelines: Lint (ruff) + Typprüfung (mypy) + Tests (pytest) + `vite build` als Gates. Secrets liegen getrennt in den jeweiligen GitHub Environments.

---

## 8. Rechtliches (EU AI Act & DSGVO — keine Rechtsberatung)

| Thema | Kernmaßnahme |
|---|---|
| AI Act Art. 50 Abs. 1 | Sichtbarer KI-Hinweis beim ersten Request (`ai_disclosure`) |
| AI Act Art. 50 Abs. 2 | Platzhalter für maschinenlesbare Kennzeichnung, sobald EU-Standard vorliegt |
| DSGVO — `usage_events` | Rechtsgrundlage: berechtigtes Interesse; 6 Monate Löschfrist; Login-Schutz (nicht mehr nur API-Key) für das Statistik-Dashboard |
| OpenAI | AVV/DPA abschließen, Drittlandtransfer prüfen (SCC/DPF) |
| Werbekennzeichnung | Booking.com-Links als „Anzeige"/„Werbung" kennzeichnen (§ 5a UWG, § 22 MStV), `rel="sponsored"` |
| **Impressumspflicht** | § 5 TMG/DDG — **noch offen, hohe Priorität** |
| European Accessibility Act | Anwendbarkeit prüfen, ggf. Basis-Barrierefreiheit |

---

## 9. Entwicklungsmethodik: OpenSpec (Spec-Driven Development)

Capabilities: `atlas`, `chat`, `export`, `security`, `stats`, `frontend`, `affiliate`, `compliance`. Workflow: **Propose → Review → Apply → Archive**, jede Änderung als eigener Change-Ordner mit Spec-Delta. Setup: Node.js ≥ 20.19, `openspec init`.

---

## 10. Risikoanalyse KI-Funktionen (Zusammenfassung)

Vollständige Analyse: `soulmap-ki-risikoanalyse.md`. Scope: `/chat` (OpenAI-Anbindung) + Fallback-Logik.

| Risiko | Restrisiko | Gegenmaßnahme |
|---|---|---|
| Halluzination/Scope-Verstoß | 🟢 Niedrig | Structured Outputs + Scope-Validierung als Backstop |
| Prompt Injection | 🟢 Niedrig | Rollentrennung, Output-Backstop, kein Tool-Zugriff |
| OpenAI-API-Ausfall | 🟢 Niedrig | Fallback-Logik ohne externe Abhängigkeit |
| Fallback-Qualitätsverlust | 🟢 Niedrig | `source`-Flag, Fallback-Rate im Dashboard sichtbar |
| Kostenmissbrauch | 🟡 Mittel | IP-Rate-Limiting speziell für `/chat` |
| Datenübermittlung an OpenAI | 🟡 Mittel | Keine Persistenz; AVV noch offen |
| Unzureichende KI-Kennzeichnung | 🟡 Mittel | `ai_disclosure`-Flag; UI-Umsetzung noch zu verifizieren |
| XSS über Modellantwort | 🟢 Niedrig* | Verbot von Raw-HTML-Rendering |
| Bias/Fairness | 🟢 Niedrig | Struktureller 40-Orte-Deckel |
| Vendor-Lock-in/Modell-Drift | 🟡 Mittel | LLM-Monitoring im Dashboard |
| Haftung für KI-Falschaussagen | 🟡 Mittel | **Offen** — Disclaimer bisher nicht vorgesehen |

*Voraussetzung: Implementierung hält Vorgabe ein (Code-Review-Punkt).

Kein Risiko erreicht 🔴 Hoch. Die 🟡-Einstufungen sind überwiegend offene organisatorische Schritte, keine Architekturlücken.

**Human-in-the-Loop-Lücken (2 von 10 Eskalationsfällen bereits abgedeckt):** Es fehlt v. a. ein **Nutzer-Feedback-Kanal** für unangemessenen KI-Output und ein **"Not-Aus"-Schalter** für `/chat` bei verteilten Kostenangriffen. Details: `soulmap-ki-risikoanalyse.md`, Abschnitt 6.

---

## 11. Offene Aktionspunkte vor Go-Live

1. Impressum erstellen (höchste Priorität)
2. Booking.com-Affiliate-ID beantragen + Partner-Richtlinien prüfen
3. Datenschutzerklärung + Impressum juristisch prüfen lassen
4. European-Accessibility-Act-Anwendbarkeit einordnen
5. Entscheidung: `element`/`archetyp`/`primaervibration`/`correspondence`/`keywords` auf englische Feldnamen umstellen? (aktuell Deutsch belassen)
6. Haftungsausschluss für KI-Detailaussagen ergänzen (siehe Abschnitt 10)
7. Nutzer-Feedback-Kanal für KI-Output einführen? (siehe Abschnitt 10)
8. Not-Aus-Schalter für `/chat` einführen? (siehe Abschnitt 10)

---

*Ende der kompakten Spezifikation. Details, Beispiele und Begründungen: siehe Vollversion `soulmap-softwarespezifikation.md`; Umsetzungsschritte: siehe `soulmap-umsetzungsplan.md`; Risikoanalyse: siehe `soulmap-ki-risikoanalyse.md`.*
