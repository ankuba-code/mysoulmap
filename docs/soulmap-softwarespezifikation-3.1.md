# Soulmap Softwarespezifikation 3.1

**Datum:** 27.11.2026 · **Status:** beschreibt den laufenden Stand und schließt die zwei offenen Human-in-the-Loop-Lücken  
**Vorgänger:** `soulmap-softwarespezifikation-3.0.md` (24.11.2026)  
**Risikoanalyse:** `soulmap-ki-risikoanalyse.md` bleibt der Katalog. Eskalation E4 (Feedback) und E5 (Not-Aus) sind mit dieser Fassung geschlossen. Die übrigen Fälle daraus bleiben organisatorisch offen.

Feedback-Kanal, der Modellwechsel über OpenRouter und der Not-Aus laufen. Der Schalter liegt in `app_settings` und braucht kein neues Deploy.

---

## 1. Überblick

Soulmap ist eine öffentlich erreichbare, anonyme Web-App. Sie führt durch ein kurzes Ritual und zeigt danach bis zu drei Orte aus einem festen Atlas von 40 spirituell und symbolisch bedeutsamen Orten. Der Chat schärft diese Orte nach. Es gibt kein Nutzerkonto, kein Login für Besucher und kein Abo.

**Kernprinzipien:**

- Der Einstieg ist das Ritual, nicht der leere Chat. `POST /match` bewertet die Antworten deterministisch und ohne Sprachmodell.
- Der Chat bleibt zustandslos. Der Browser hält den Verlauf, der Server speichert keine Nachrichten.
- Empfehlungen bleiben im Atlas. Orte außerhalb von `places.json` werden verworfen.
- Der Chat spricht nur über OpenRouter. Aktiv ist entweder `gpt-5-mini` oder `claude-haiku-5-5`. Die Wahl liegt in der Datenbank und gilt ohne neues Deploy.
- Fällt das Modell aus, ist die Antwort ungültig, oder der Not-Aus ist gezogen, liefert derselbe deterministische Fallback 1–2 Atlas-Orte. Die Ergebnisseite bleibt nutzbar, der Kostenpfad zum Modell stoppt.
- Einzige Persistenz für Besucher: die Tabelle `usage_events` für anonyme Nutzungsstatistik, einschließlich Chat-Feedback. Die Tabelle `app_settings` hält nur Betriebsschalter.
- Oberflächensprache ist Deutsch, Englisch, Spanisch oder Russisch. Ohne erkennbare Systemsprache bleibt Deutsch.

**Stakeholder:** Andre (Product Owner, Betreiber, technische Umsetzung) und Guillermo Rodini (Buchautor, SEELENWEGE-Manuskript als inhaltliche Grundlage des Atlas).

---

## 2. Änderungen gegenüber Spezifikation 3.0

| Thema | Stand 3.0 | Stand 3.1 |
|---|---|---|
| Chat-Anbieter | OpenAI direkt, fest `gpt-5-mini` | nur OpenRouter; Umschalten im Admin zwischen `gpt-5-mini` und `claude-haiku-5-5` |
| Modellwahl | nicht vorgesehen | Zeile `chat_model` in `app_settings`, Standard `gpt-5-mini`, gilt über alle Worker und einen Neustart |
| Not-Aus | offene Lücke | Admin-Schalter `chat_halt` in `app_settings`. Gezogen: `/chat` ruft kein Modell auf und antwortet mit dem Fallback |
| Feedback | offene Lücke | Like und Dislike an jeder Assistentenantwort, optionale Notiz, Ereignis `chat_feedback` in `usage_events` |
| Datenfluss Chat | nur OpenAI | OpenRouter, dahinter je nach Wahl OpenAI oder Anthropic. Match, Intro und Sprache verlassen das System nicht |
| Übriger Umfang | — | unverändert zu 3.0: Ritual, Atlas, Karte, Buchung, Rechtstexte, Deploy |

---

## 3. Nutzerfluss

1. **Intro.** Die Startseite beginnt mit einer scrollbaren Partikelanimation. Sechs Phasen: Stille, Erde, Wasser, Feuer, Luft, Äther. In der letzten Phase bilden die 40 Atlas-Orte eine Konstellation. Texte, Hinweis, Überspringen und der Aufruf „Beginne deine Reise“ folgen der gewählten Sprache. Es gibt keinen Ton und keinen Abschnitt „Hier beginnt der Chat“.
2. **Ritual.** Acht Fragen. Sechs davon sind eine Auswahl, zwei sind Freitext (ein Wort, ein Ort). Die Antwort scrollt zur nächsten Frage. Am Ende steht eine Anima-Karte.
3. **Ergebnisse.** `POST /match` speichert Karte und Treffer in `sessionStorage` und öffnet `/results` oben. Die Seite zeigt Karte, Orte, Buchungslinks, eine Druckkarte und den Chat.
4. **Nachschärfen.** Der Chat auf der Ergebnisseite bleibt im Atlas. Weitere Orte aus dem Gespräch erscheinen neben den Match-Treffern. Unter jeder Assistentenantwort sitzen „Gefällt mir“ und „Gefällt mir nicht“.
5. **Ohne Ritual** leitet `/results` auf `/` zurück.

Der Stand des Rituals und die gewählte Sprache liegen in `sessionStorage` und enden mit dem Tab. Ob das Intro schon gesehen wurde, merkt sich `localStorage` (`soulmap_splash_seen_v1`): erster Besuch 600 vh Scrollweg, Wiederkehr 260 vh. Bei `prefers-reduced-motion` ist das Intro eine Bildschirmhöhe und zeigt sofort die letzte Phase mit dem Aufruf zur Reise.

---

## 4. Architektur

```
Externe Webseite → (Link) → Soulmap-Frontend (React/Vite/Tailwind)
                                   │ HTTPS/JSON, Präfix /api
                                   ▼
                    REST-API (FastAPI, Chat zustandslos)
                     │          │            │             │
                Atlas +     Match       OpenRouter       GeoIP
                place_i18n  (ohne LLM)  gpt-5-mini oder   (lokal)
                     │                  claude-haiku-5-5
                     │                       │             │
                     └────────── MySQL ──────┴─────────────┘
                            usage_events, app_settings
                                       │
                         /admin (Login) → Statistik, Modell, Not-Aus
```

`places.json` und `place_i18n.json` werden beim Start geladen. Es gibt kein Hot-Reload. MySQL hält Statistik, Feedback und die zwei Betriebsschalter. Keine Gespräche und kein Ritual.

OpenRouter ist der einzige Chat-Transport (`https://openrouter.ai/api/v1`, Schlüssel `OPENROUTER_API_KEY`). Fehlt der Schlüssel, gilt derselbe Fallback wie bei einem Ausfall. Langfuse ist optional und nur Beobachtung: ohne die beiden Langfuse-Schlüssel verlässt der Chat das System nicht dorthin.

---

## 5. Technologie-Stack

| Bereich | Technologie | Rolle in 3.1 |
|---|---|---|
| Backend | Python 3.12+, FastAPI, Gunicorn + Uvicorn | API, Validierung, Matching |
| Atlas | `places.json`, Schema v2, englische Elementschlüssel | 40 Orte, beim Start geprüft |
| Ortstexte | `place_i18n.json` | Namen und Beschreibungen je Sprache, Fallback auf den Atlas-Namen |
| Matching | `match.py` | feste Punkte aus den acht Antworten, kein LLM |
| Statistik-DB | MySQL 8, SQLModel, Alembic | `usage_events` und `app_settings` |
| LLM | OpenRouter | `openai/gpt-5-mini` oder `anthropic/claude-haiku-5.5`, nur `/chat` |
| Antwortform | JSON-Schema, `strict`, danach Pydantic | dieselbe Form für beide Modelle; Längengrenzen prüft Pydantic |
| Fallback | Keyword-Matching in Python | 1–2 Atlas-Orte bei Ausfall, ungültiger Antwort oder Not-Aus |
| GeoIP | `geoip2` + MaxMind GeoLite2, lokal | Land für die Statistik, ungefährer Standort für die Karte |
| Rate-Limit | `slowapi`, pro IP | Schutz ohne Besucher-Login; zusätzlich Token-Deckel und Tagesbudget |
| Admin | Benutzer `aku`, bcrypt, signiertes Cookie | Statistik, Modellwechsel, Not-Aus |
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

Anonyme Ereignisse, Löschung nach 6 Monaten. Die primäre Systemsprache aus `Accept-Language` steht als `os_language` (zum Beispiel `de-DE`), nicht der ganze Header.

Ereignisarten: `form_submission`, `result_view`, `affiliate_click`, `rate_limited`, `chat_feedback`.

Chat-Feedback ergänzt zwei Spalten: `feedback_vote` (`like` oder `dislike`) und `feedback_text` (höchstens 500 Zeichen, leer erlaubt). Die Zeile trägt dieselbe IP, dasselbe Land und dieselbe Systemsprache wie die übrigen Ereignisse. Den Gesprächsverlauf speichert sie nicht, nur die Notiz, die der Besucher selbst schreibt. Die Löschfrist von 6 Monaten gilt auch für diese Notiz.

### 6.5 Betriebsschalter (`app_settings`)

Eine Zeile je Schlüssel. Der Wert gilt für alle Gunicorn-Worker und über einen Neustart. Ein neues Deploy ist dafür nicht nötig.

| Schlüssel | Werte | Standard, wenn die Zeile fehlt |
|---|---|---|
| `chat_model` | `gpt-5-mini`, `claude-haiku-5-5` | `gpt-5-mini` |
| `chat_halt` | `on`, `off` | `off` (Chat ruft das Modell auf) |

Die OpenRouter-Slugs sind fest: `gpt-5-mini` ist `openai/gpt-5-mini`, `claude-haiku-5-5` ist `anthropic/claude-haiku-5.5`.

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
| POST | `/chat` | zustandslose Empfehlung; bei Ausfall, Halt oder ungültiger Antwort Fallback |
| POST | `/feedback` | Like oder Dislike plus optionale Notiz |
| GET | `/go/{place_id}` | Klick zählen, 302 auf die Booking-Suche; `lang` wählt die Buchungssprache |
| POST | `/admin/login`, `/admin/logout` | Admin-Sitzung |
| POST | `/admin/model` | aktives Chat-Modell setzen, nur mit Sitzung |
| POST | `/admin/halt` | Not-Aus setzen oder lösen, nur mit Sitzung |
| GET | `/admin/stats` | Kennzahlen, nur mit Sitzung |
| GET | `/health/signals` | Betriebsampel, nur mit Monitor-Token |

**`GET /language`.** Der Server liest den ersten Sprach-Tag von `Accept-Language`. `en-US` wird `en`, `es-MX` wird `es`. Jeder andere Tag, ein leerer Header oder `*` ergibt `de`. Der Browser schickt den Header von selbst. Hat der Besucher im Schalter schon eine Sprache gewählt, ignoriert die Oberfläche die Antwort.

**`POST /match`.** Body: `{ "answers": { q0…q7 }, "language": "de" }`. Antwort: `anima_card` und `matches` (id, Name, Land, Koordinaten, Begründung, `booking_link` als `/go/{id}`, `booking_url` als fertige Booking-Suche). Die Suche setzt Breite, Länge, Radius 20 km, `dest_type=latlong` und Sortierung nach Entfernung. Kein Modellaufruf. Der Not-Aus berührt `/match` nicht.

**`POST /chat`.** Verlauf und `shown_place_ids` kommen vom Client. `source` ist `llm` oder `fallback`. `ai_disclosure` kennzeichnet die KI. Empfohlene Orte tragen `booking_url`. Vor dem Modell prüfen Token-Deckel der IP (50.000 Tokens in 30 Tagen, sonst 429 `TOKEN_LIMIT`) und das globale Tagesbudget. Danach gilt Abschnitt 9.

**`POST /feedback`.** Body: `{ "vote": "like" | "dislike", "text": "" }`. `text` ist optional und höchstens 500 Zeichen. Unbekanntes `vote` ist 422. Antwort: `{ "ok": true }`. Der Endpunkt speichert nur die Bewertung, nicht den Chatverlauf.

**PDF und Screenshot** haben keinen API-Endpunkt.

**Rate-Limits pro IP:**

| Endpunkt | Limit |
|---|---|
| `/chat`, `/match`, `/feedback` | 20/min |
| `/atlas/*` | 60/min |
| `/language`, `/geo` | 60/min |
| `/go/{id}` | 30/min |
| `/admin/stats`, `/admin/model`, `/admin/halt` | 10/min |
| `/admin/login` | 5/min |

---

## 8. Oberfläche

### 8.1 Intro

Die Animation ist eine eigene Canvas-Fläche über die volle Breite, klebend im Viewport, gesteuert vom Scrollfortschritt. Phasen morphen ineinander. Die Äther-Phase zeichnet die Orte aus `GET /atlas/places` und färbt sie nach Element. „Überspringen“ und „Beginne deine Reise“ scrollen zur ersten Frage. Der Prototyp-Abschnitt mit einem Schein-Chat und der Schalter „Mit Klang erleben“ gehören nicht zur Anwendung.

### 8.2 Sprache

Der Schalter sitzt in der Kopfzeile (es, en, de, ru). Beim ersten Besuch ohne gespeicherte Sprache fragt die Oberfläche `GET /language` und stellt den Schalter darauf. Eine manuelle Wahl gilt für den Tab und wird nicht wieder überschrieben. Liegt schon ein Ritual mit Sprache vor, bleibt diese. `document.documentElement.lang` folgt der Auswahl. Intro, Fragen, Ergebnisse, Chat, Rechtstexte, Feedback und Buchungslinks nutzen dieselbe Sprache.

### 8.3 Ergebnisseite

Die Seite setzt beim Öffnen `window.scrollTo(0, 0)`, damit die Scrollposition des langen Rituals nicht unten stehen bleibt. Der KI-Hinweis und der Terrain-Dialog fokussieren ihre Schaltfläche ohne die Seite zu verschieben (`preventScroll`).

Sichtbar sind: Überschrift, Anima-Karte, Leaflet-Karte mit Treffern und optionalem Herkunftskreis, Ortsliste mit Land, QR-Code und Buchungslink, Druckkarte, eingebetteter Chat. „Terrain anzeigen“ öffnet die Karte in einem Dialog. „Mehr erfahren“ öffnet denselben Dialog mit einem Chat, der nur diesen einen Ort vertieft.

### 8.4 Feedback

An jeder Assistentenantwort, im Ergebnis-Chat, im Dialog „Mehr erfahren“ und im eigenständigen Chat, sitzen zwei Schaltflächen: Gefällt mir, Gefällt mir nicht. Ein Klick öffnet ein Fenster. Die Notiz ist optional, höchstens 500 Zeichen, der Hinweis lautet, was an der Antwort gut oder schief war. Senden schreibt `POST /feedback`. Danach steht ein kurzer Dank. Abbrechen schließt das Fenster ohne Speichern. Die Texte des Fensters folgen der gewählten Sprache.

### 8.5 Rechtstexte

`/impressum`, `/datenschutz` und `/disclaimer` sind eigene Routen, Texte in de, en, es und ru, erreichbar aus der Fußzeile. Das ist die Produktumsetzung. Eine juristische Prüfung der Formulierungen ist damit nicht ersetzt.

---

## 9. Chat, Modelle und Not-Aus

### 9.1 Ein Transport, zwei Modelle

`complete_llm` schickt jede Chat-Anfrage an OpenRouter. Es wechselt nur der Slug:

| Admin-Name | OpenRouter-Slug | Zusatz |
|---|---|---|
| `gpt-5-mini` | `openai/gpt-5-mini` | Standard |
| `claude-haiku-5-5` | `anthropic/claude-haiku-5.5` | Reasoning aus |

Beide bekommen dasselbe JSON-Schema aus `LlmOutput`: alle Felder erforderlich, `additionalProperties: false`, `response_format.type` ist `json_schema`, `strict` ist wahr, `provider.require_parameters` ist wahr. Längengrenzen wie `minLength` und `maxLength` gehen nicht an den Anbieter. Sie prüft danach `LlmOutput.model_validate`. Eine unbekannte `place_id` löst einen Retry mit verschärftem Prompt aus. Scheitert auch der, gilt der Fallback. Das Modell hat keine Werkzeuge und setzt den Systemprompt nicht aus dem Clientverlauf zusammen.

Der Systemprompt bleibt die Systemrolle. Der Verlauf ist keine Autorität. Aus der Modellantwort entsteht kein HTML. Timeout, ein Retry bei Verbindungs- und Anbieterfehlern, danach Fallback: unverändert.

`POST /admin/model` mit der Admin-Sitzung setzt `chat_model`. Ein unbekannter Name wird abgelehnt. Die HTML-Ansicht unter `/admin` zeigt beide Namen. Der aktive Name ist markiert und trägt einen Punkt: grün, wenn OpenRouter den Slug in `/models` listet, rot sonst. Die Prüfung ist nur Anzeige, sie schaltet das Modell nicht um.

### 9.2 Not-Aus

Der Not-Aus ist der Schalter für den Fall, den Rate-Limit, der Token-Deckel je IP und das Tagesbudget nicht fangen: ein verteilter Kostenanstieg über viele Adressen, oder ein Modell, das abgeschaltet werden muss, bevor ein Deploy fertig ist.

`POST /admin/halt` verlangt die Admin-Sitzung. Der Body ist `{ "halt": true }` oder `{ "halt": false }`. `true` schreibt `chat_halt=on`, `false` schreibt `off`. In der HTML-Ansicht ist es eine Schaltfläche: bei laufendem Chat „Not-Aus“, bei Halt „Chat wieder an“.

Ist `chat_halt` `on`, gilt für `POST /chat`:

- OpenRouter wird nicht aufgerufen. Es entstehen keine Modellkosten.
- Die Antwort ist der bestehende Fallback: 1–2 Atlas-Orte, fester mehrsprachiger Hinweis, `source` ist `fallback`.
- Das Ereignis trägt den Fehlercode `CHAT_HALTED`, damit der Halt in der Statistik von einem Modellausfall unterscheidbar ist.
- `/match`, Atlas, Karte, Buchung und Feedback bleiben erreichbar.

Fehlt die Zeile oder steht ein anderer Wert als `on`, läuft der Chat normal.

---

## 10. Admin

`/admin` verlangt den Benutzer `aku`. Das Passwort liegt als bcrypt-Hash in der Umgebung, die Sitzung ist ein signiertes HttpOnly-Cookie.

Die Ansicht zeigt die Kennzahlen aus 3.0 (Formulare, Ergebnisse, Conversion, Affiliate, Fallback-Rate, Latenz, Herkunft, Rohdaten). Rohdaten haben die Spalten Bewertung und Feedback. Darüber sitzen der Modellschalter (9.1) und der Not-Aus (9.2). Ein optionaler Langfuse-Block zeigt Aufrufe, Kosten, Tokens und Latenz, wenn die Schlüssel gesetzt sind.

---

## 11. Sicherheit

Die Chat-Regeln aus 3.0 bleiben: Systemprompt nur als Systemrolle, Verlauf ist keine Autorität, Ausgabe nur gegen den Atlas, kein HTML aus der Modellantwort, Längengrenzen, kein Werkzeugzugriff des Modells.

CORS nur auf die eigene Domain. nginx setzt CSP, HSTS, `X-Content-Type-Options` und `Referrer-Policy`. `X-Forwarded-For` gilt nur, wenn der Proxy ihn setzen darf.

Modellwechsel und Not-Aus sind nur mit gültiger Admin-Sitzung schreibbar. Der Besucher kann den Schalter nicht setzen. `OPENROUTER_API_KEY` steht nur in der Umgebung.

---

## 12. Deployment

Ein GitHub-Actions-Workflow `Build & Deploy` startet bei Push auf `main`. Er baut das API-Image und das Web-Image für `linux/amd64`, schiebt sie nach GHCR und zieht sie per SSH auf dem VPS (`docker compose -f docker-compose.prod.yml pull && up -d`).

`hostinger-up.sh` ist der manuelle Weg auf dem Server: Repository nach `/opt/mysoulmap`, `.env` bleibt liegen, Images werden gezogen und gestartet. Geheimnisse stehen nur in der Umgebung, nicht im Quelltext. `OPENROUTER_API_KEY` gehört in diese Umgebung. `OPENAI_API_KEY` ist für den Chat nicht mehr der Transport.

Öffentlich ist die Anwendung unter `https://app.mithertz.online`.

Modellwechsel und Not-Aus brauchen diesen Workflow nicht. Sie schreiben nur `app_settings`.

---

## 13. Rechtliches (keine Rechtsberatung)

| Thema | Stand 3.1 |
|---|---|
| AI Act Art. 50 | KI-Hinweis auf der Ergebnisseite, bevor der Chat genutzt wird; `ai_disclosure` in der Chat-Antwort. Der Fallback bei Not-Aus ist kein Modelltext |
| DSGVO | `usage_events` mit IP, Land, Systemsprache und, bei Feedback, der selbst geschriebenen Notiz; Rechtsgrundlage weiter berechtigtes Interesse; 6 Monate Löschfrist |
| Anbieter des Chats | nur der Chat verlässt das System, und nur über OpenRouter an das gewählte Modell (OpenAI oder Anthropic). Match, Intro und Sprache nicht |
| Werbung | Booking-Links als Anzeige gekennzeichnet, `rel="sponsored"` |
| Impressum, Datenschutz, Bedingungen | Seiten sind vorhanden und übersetzt; rechtliche Freigabe der Texte bleibt offen |
| Barrierefreiheit | Intro respektiert `prefers-reduced-motion`; eine vollständige EAA-Prüfung ist nicht Teil dieser Fassung |

---

## 14. Geschlossene und offene Punkte

Mit 3.1 geschlossen, gegenüber der offenen Liste in 3.0 und den Eskalationen E4 und E5:

1. **Feedback.** Der Besucher kann eine Assistentenantwort bewerten und eine Notiz hinterlassen. Sie liegt in `usage_events` neben IP und Land und erscheint in den Admin-Rohdaten. Damit hat ein Hinweis auf unangemessenen oder falschen Output einen Weg zu Andre. Ein Verdacht auf systematische Schieflage (E10) kann über denselben Kanal ankommen; die redaktionelle Prüfung der Atlas-Texte bleibt eine menschliche Entscheidung.
2. **Not-Aus.** `/chat` lässt sich ohne Deploy vom Modell nehmen. Die Seite fällt auf den Atlas-Fallback zurück. Das schließt den Fall, in dem viele Adressen das IP-Limit und das Budget zusammen übersteigen.
3. **Zweiter Modellweg.** Beide Modelle laufen über denselben OpenRouter-Vertrag. Ein Anbieterausfall oder eine Abschaltung lässt sich durch den anderen Slug oder durch den Not-Aus auffangen, ohne den Promptvertrag zu ändern.

Weiter offen:

1. Juristische Prüfung von Impressum, Datenschutz und Nutzungsbedingungen.
2. European Accessibility Act vollständig einordnen.
3. AVV/DPA mit OpenRouter und den beiden Modellanbietern, einschließlich Drittlandtransfer. Die frühere offene Prüfung „nur OpenAI“ ist damit zu eng.
4. Die übrigen Eskalationen der Risikoanalyse, die diese Fassung nicht anfasst: andauernder Totalausfall als eigenes Playbook, dauerhafte IP-Sperre, Beobachtung externer Modell-Abkündigungen, Alert beim GeoIP-Cron, Monitoring fehlschlagender Booking-Redirects.

---

*Diese Fassung 3.1 ersetzt 3.0 als Beschreibung der Anwendung. 3.0 und die älteren Dokumente bleiben als Vorgänger im Ordner `docs/`.*
