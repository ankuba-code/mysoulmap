# Soulmap Softwarespezifikation 3.0

**Datum:** 24.11.2026 · **Status:** umgesetzt, läuft auf dem VPS  
**Vorgänger:** `soulmap-softwarespezifikation-2.0-kompakt.md` und die ausführliche Fassung `soulmap-softwarespezifikation.md` (Stand 2.9 vom 16.09.2026)  
**Risikoanalyse:** `soulmap-ki-risikoanalyse.md` bleibt gültig für den Chat. Diese Fassung beschreibt den gebauten Umfang.

---

## 1. Überblick

Soulmap ist eine öffentlich erreichbare, anonyme Web-App. Sie führt durch ein kurzes Ritual und zeigt danach bis zu drei Orte aus einem festen Atlas von 40 spirituell und symbolisch bedeutsamen Orten. Der Chat schärft diese Orte nach. Es gibt kein Nutzerkonto, kein Login für Besucher und kein Abo.

**Kernprinzipien:**

- Der Einstieg ist das Ritual, nicht der leere Chat. `POST /match` bewertet die Antworten deterministisch und ohne Sprachmodell.
- Der Chat bleibt zustandslos. Der Browser hält den Verlauf, der Server speichert keine Nachrichten.
- Empfehlungen bleiben im Atlas. Orte außerhalb von `places.json` werden verworfen.
- Einzige Persistenz: die Tabelle `usage_events` für anonyme Nutzungsstatistik.
- Oberflächensprache ist Deutsch, Englisch, Spanisch oder Russisch. Ohne erkennbare Systemsprache bleibt Deutsch.

**Stakeholder:** Andre (Product Owner, Betreiber, technische Umsetzung) und Guillermo Rodini (Buchautor, SEELENWEGE-Manuskript als inhaltliche Grundlage des Atlas).

---

## 2. Änderungen gegenüber Spezifikation 2.x

| Thema | Stand 2.x | Stand 3.0 |
|---|---|---|
| Einstieg | Chat als erste Funktion | Scroll-Intro, danach acht Fragen, dann Ergebnisseite |
| Ortswahl | nur über `/chat` | `POST /match` ohne LLM; Chat schärft auf der Ergebnisseite nach |
| Sprache | mehrsprachige Textbausteine vorgesehen | Schalter für de, en, es, ru; Server wählt die Systemsprache, Standard ist Deutsch |
| Atlas-Texte | ein Sprachstand in `places.json` | Anzeigenamen und Texte zusätzlich in `place_i18n.json` |
| Ergebnisseite | nicht als eigener Schritt beschrieben | eigene Route `/results`, öffnet immer oben |
| Karte | nicht spezifiziert | Leaflet-Karte, ungefährer Standort über `GET /geo`, Terrain in einem Dialog |
| Buchung | Redirect `/go/{id}` | zusätzlich Suchlink mit Koordinate, 20 km Radius und Sprache |
| PDF | clientseitig | eingebettete Noto-Sans-Schriften, damit Russisch (Kyrillisch) lesbar bleibt |
| Rechtstexte | Impressum noch offen | Seiten für Impressum, Datenschutz und Nutzungsbedingungen, jeweils in vier Sprachen |
| Deploy | getrennte Dev- und Prod-Pipeline | ein Workflow bei Push auf `main`: Images nach GHCR, SSH-Deploy auf den VPS |

---

## 3. Nutzerfluss

1. **Intro.** Die Startseite beginnt mit einer scrollbaren Partikelanimation. Sechs Phasen: Stille, Erde, Wasser, Feuer, Luft, Äther. In der letzten Phase bilden die 40 Atlas-Orte eine Konstellation. Texte, Hinweis, Überspringen und der Aufruf „Beginne deine Reise“ folgen der gewählten Sprache. Es gibt keinen Ton und keinen Abschnitt „Hier beginnt der Chat“.
2. **Ritual.** Acht Fragen. Sechs davon sind eine Auswahl, zwei sind Freitext (ein Wort, ein Ort). Die Antwort scrollt zur nächsten Frage. Am Ende steht eine Anima-Karte.
3. **Ergebnisse.** `POST /match` speichert Karte und Treffer in `sessionStorage` und öffnet `/results` oben. Die Seite zeigt Karte, Orte, Buchungslinks, eine Druckkarte und den Chat.
4. **Nachschärfen.** Der Chat auf der Ergebnisseite bleibt im Atlas. Weitere Orte aus dem Gespräch erscheinen neben den Match-Treffern.
5. **Ohne Ritual** leitet `/results` auf `/` zurück.

Der Stand des Rituals und die gewählte Sprache liegen in `sessionStorage` und enden mit dem Tab. Ob das Intro schon gesehen wurde, merkt sich `localStorage` (`soulmap_splash_seen_v1`): erster Besuch 600 vh Scrollweg, Wiederkehr 260 vh. Bei `prefers-reduced-motion` ist das Intro eine Bildschirmhöhe und zeigt sofort die letzte Phase mit dem Aufruf zur Reise.

---

## 4. Architektur

```
Externe Webseite → (Link) → Soulmap-Frontend (React/Vite/Tailwind)
                                   │ HTTPS/JSON, Präfix /api
                                   ▼
                    REST-API (FastAPI, Chat zustandslos)
                     │          │           │            │
                Atlas +     Match      OpenAI API      GeoIP
                place_i18n  (ohne LLM) (+ Fallback)    (lokal)
                     │                      │            │
                     └────────── MySQL: usage_events ────┘
                                       │
                         /admin (Login) → Statistik-Dashboard
```

`places.json` und `place_i18n.json` werden beim Start geladen. Es gibt kein Hot-Reload. MySQL hält nur Statistik, keine Gespräche und kein Ritual.

---

## 5. Technologie-Stack

| Bereich | Technologie | Rolle in 3.0 |
|---|---|---|
| Backend | Python 3.12+, FastAPI, Gunicorn + Uvicorn | API, Validierung, Matching |
| Atlas | `places.json`, Schema v2, englische Elementschlüssel | 40 Orte, beim Start geprüft |
| Ortstexte | `place_i18n.json` | Namen und Beschreibungen je Sprache, Fallback auf den Atlas-Namen |
| Matching | `match.py` | feste Punkte aus den acht Antworten, kein LLM |
| Statistik-DB | MySQL 8, SQLModel, Alembic | nur `usage_events` |
| LLM | OpenAI `gpt-5-mini`, Structured Outputs | nur `/chat` |
| Fallback | Keyword-Matching in Python | 1–2 Atlas-Orte, wenn das Modell ausfällt |
| GeoIP | `geoip2` + MaxMind GeoLite2, lokal | Land für die Statistik, ungefährer Standort für die Karte |
| Rate-Limit | `slowapi`, pro IP | einziger Schutz ohne Besucher-Login |
| Admin | Benutzer `aku`, bcrypt, signiertes Cookie | nur das Statistik-Dashboard |
| Frontend | React 18, Vite, Tailwind, React Router | eine SPA |
| Intro | Canvas, eigene Partikel-Engine | framework-frei im Frontend |
| Karte | Leaflet, react-leaflet, OSM-Kacheln | Ergebnisseite und Terrain-Dialog |
| Export | jsPDF, html2canvas, Noto Sans | PDF und Screenshot nur im Browser |
| Affiliate | Booking.com, serverseitiger Suchlink | Redirect über `/go/{id}` |
| Deployment | Docker, nginx, GHCR, GitHub Actions, Hostinger-VPS | Push auf `main` spielt aus |

---

## 6. Datenmodell

### 6.1 Atlas (`places.json`)

Pflichtfelder: `schemaVersion` (2), `id`, `name`, `country`, `coordinates.lat`, `coordinates.lng`, `element`, `archetyp`, `primaervibration`, `correspondence`, `keywords`. `region` darf fehlen. `element` ist einer der Schlüssel `earth`, `water`, `fire`, `air`, `aether`. Doppelte `id` lassen den Start fehlschlagen.

### 6.2 Übersetzungen (`place_i18n.json`)

Schlüssel sind die Sprachcodes `de`, `en`, `es`, `ru`, darunter die Atlas-`id`. Eine Zeile kann `name` und weitere Anzeigefelder tragen. Fehlt die Zeile oder der Name, bleibt der Name aus `places.json`. Die Datei wird mit ins API-Image kopiert.

### 6.3 Ritual im Browser

`sessionStorage` unter `soulmap.ritual` und `soulmap.language`. Das Ritual gilt nur, wenn `result.matches` und `result.anima_card` vorhanden sind. Die Sprache ist `de`, `en`, `es` oder `ru`.

Die acht Antworten:

| Feld | Form |
|---|---|
| q0–q4 | Index 0–4 (Landschaft, Bewegung, Spannung, Element, Symbol) |
| q5 | Index 0–3 (Körperbewegung) |
| q6 | Text, 1–400 Zeichen (Wort) |
| q7 | Text, 2–400 Zeichen (Ort) |

### 6.4 Statistik (`usage_events`)

Unverändert im Zweck: anonyme Ereignisse, keine Gesprächsinhalte, Löschung nach 6 Monaten. Zusätzlich zum Stand 2.x wird die primäre Systemsprache aus `Accept-Language` als `os_language` gespeichert (zum Beispiel `de-DE`), nicht der ganze Header.

---

## 7. REST-API

Von außen hängen die JSON-Endpunkte unter `/api`. `/go/…` geht ohne dieses Präfix an die API. Kein Auth-Header für Besucher.

| Methode | Pfad | Zweck |
|---|---|---|
| GET | `/health` | Laufstatus und Anzahl geladener Orte |
| GET | `/language` | eine von `de`, `en`, `es`, `ru` aus der primären Systemsprache |
| GET | `/geo` | ungefährer Standort aus der IP, lokal über GeoIP |
| GET | `/atlas/places`, `/atlas/places/{id}` | Atlas lesen, filterbar nach Element, Archetyp, Schlüsselwort |
| POST | `/match` | acht Antworten und Sprache → Anima-Karte und Treffer |
| POST | `/chat` | zustandslose Empfehlung; bei Ausfall Fallback |
| GET | `/go/{place_id}` | Klick zählen, 302 auf die Booking-Suche; `lang` wählt die Buchungssprache |
| POST | `/admin/login`, `/admin/logout` | Admin-Sitzung |
| GET | `/admin/stats` | Kennzahlen, nur mit Sitzung |
| GET | `/health/signals` | Betriebsampel, nur mit Monitor-Token |

**`GET /language`.** Der Server liest den ersten Sprach-Tag von `Accept-Language`. `en-US` wird `en`, `es-MX` wird `es`. Jeder andere Tag, ein leerer Header oder `*` ergibt `de`. Der Browser schickt den Header von selbst. Hat der Besucher im Schalter schon eine Sprache gewählt, ignoriert die Oberfläche die Antwort.

**`POST /match`.** Body: `{ "answers": { q0…q7 }, "language": "de" }`. Antwort: `anima_card` und `matches` (id, Name, Land, Koordinaten, Begründung, `booking_link` als `/go/{id}`, `booking_url` als fertige Booking-Suche). Die Suche setzt Breite, Länge, Radius 20 km, `dest_type=latlong` und Sortierung nach Entfernung. Kein OpenAI-Aufruf.

**`POST /chat`.** Unverändert im Vertrag von 2.x: Verlauf und `shown_place_ids` kommen vom Client, `source` ist `llm` oder `fallback`, `ai_disclosure` kennzeichnet die KI. Empfohlene Orte tragen ebenfalls `booking_url`. Timeout und Fallback wie bisher.

**PDF und Screenshot** haben keinen API-Endpunkt.

**Rate-Limits pro IP:**

| Endpunkt | Limit |
|---|---|
| `/chat`, `/match` | 20/min |
| `/atlas/*` | 60/min |
| `/language`, `/geo` | 60/min |
| `/go/{id}` | 30/min |
| `/admin/stats` | 10/min |
| `/admin/login` | 5/min |

---

## 8. Oberfläche

### 8.1 Intro

Die Animation ist eine eigene Canvas-Fläche über die volle Breite, klebend im Viewport, gesteuert vom Scrollfortschritt. Phasen morphen ineinander. Die Äther-Phase zeichnet die Orte aus `GET /atlas/places` und färbt sie nach Element. „Überspringen“ und „Beginne deine Reise“ scrollen zur ersten Frage. Der Prototyp-Abschnitt mit einem Schein-Chat und der Schalter „Mit Klang erleben“ gehören nicht zur Anwendung.

### 8.2 Sprache

Der Schalter sitzt in der Kopfzeile (es, en, de, ru). Beim ersten Besuch ohne gespeicherte Sprache fragt die Oberfläche `GET /language` und stellt den Schalter darauf. Eine manuelle Wahl gilt für den Tab und wird nicht wieder überschrieben. Liegt schon ein Ritual mit Sprache vor, bleibt diese. `document.documentElement.lang` folgt der Auswahl. Intro, Fragen, Ergebnisse, Chat, Rechtstexte und Buchungslinks nutzen dieselbe Sprache.

### 8.3 Ergebnisseite

Die Seite setzt beim Öffnen `window.scrollTo(0, 0)`, damit die Scrollposition des langen Rituals nicht unten stehen bleibt. Der KI-Hinweis und der Terrain-Dialog fokussieren ihre Schaltfläche ohne die Seite zu verschieben (`preventScroll`).

Sichtbar sind: Überschrift, Anima-Karte, Leaflet-Karte mit Treffern und optionalem Herkunftskreis, Ortsliste mit Land, QR-Code und Buchungslink, Druckkarte, eingebetteter Chat. „Terrain anzeigen“ öffnet die Karte in einem Dialog. „Mehr erfahren“ öffnet denselben Dialog mit einem Chat, der nur diesen einen Ort vertieft.

### 8.4 Rechtstexte

`/impressum`, `/datenschutz` und `/disclaimer` sind eigene Routen, Texte in de, en, es und ru, erreichbar aus der Fußzeile. Das ist die Produktumsetzung. Eine juristische Prüfung der Formulierungen ist damit nicht ersetzt.

---

## 9. Sicherheit

Die Chat-Regeln aus 2.x bleiben: Systemprompt nur als Systemrolle, Verlauf ist keine Autorität, Ausgabe nur gegen den Atlas, kein HTML aus der Modellantwort, Längengrenzen, kein Werkzeugzugriff des Modells.

CORS nur auf die eigene Domain. nginx setzt CSP, HSTS, `X-Content-Type-Options` und `Referrer-Policy`. `X-Forwarded-For` gilt nur, wenn der Proxy ihn setzen darf.

---

## 10. Deployment

Ein GitHub-Actions-Workflow `Build & Deploy` startet bei Push auf `main`. Er baut das API-Image und das Web-Image für `linux/amd64`, schiebt sie nach GHCR und zieht sie per SSH auf dem VPS (`docker compose -f docker-compose.prod.yml pull && up -d`).

`hostinger-up.sh` ist der manuelle Weg auf dem Server: Repository nach `/opt/mysoulmap`, `.env` bleibt liegen, Images werden gezogen und gestartet. Geheimnisse stehen nur in der Umgebung, nicht im Quelltext.

Öffentlich ist die Anwendung unter `https://app.mithertz.online`.

---

## 11. Rechtliches (keine Rechtsberatung)

| Thema | Stand 3.0 |
|---|---|
| AI Act Art. 50 | KI-Hinweis auf der Ergebnisseite, bevor der Chat genutzt wird; `ai_disclosure` in der Chat-Antwort |
| DSGVO | `usage_events` mit IP, Land und Systemsprache; Rechtsgrundlage weiter berechtigtes Interesse; 6 Monate Löschfrist |
| OpenAI | nur der Chat verlässt das System; Match, Intro und Sprache nicht |
| Werbung | Booking-Links als Anzeige gekennzeichnet, `rel="sponsored"` |
| Impressum, Datenschutz, Bedingungen | Seiten sind vorhanden und übersetzt; rechtliche Freigabe der Texte bleibt offen |
| Barrierefreiheit | Intro respektiert `prefers-reduced-motion`; eine vollständige EAA-Prüfung ist nicht Teil dieser Fassung |

---

## 12. Offene Punkte

Aus der Liste von 2.x erledigt sind der Impressum-Platzhalter als Seite, die englischen Elementschlüssel im Atlas und der KI-Hinweis in der Oberfläche.

Weiter offen, unverändert zur Risikoanalyse:

1. Juristische Prüfung von Impressum, Datenschutz und Nutzungsbedingungen.
2. European Accessibility Act vollständig einordnen.
3. AVV/DPA mit OpenAI und der Drittlandtransfer.
4. Nutzer-Feedback für unangemessenen KI-Output.
5. Not-Aus für `/chat` ohne neues Deploy.

---

*Diese Fassung 3.0 ersetzt 2.0 und 2.9 als Beschreibung der laufenden Anwendung. Die älteren Dokumente bleiben als Vorgänger im Ordner `docs/`.*
