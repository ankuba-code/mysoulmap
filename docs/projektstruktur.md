# Soulmap – Projektstruktur

Soulmap ist eine anonyme Web-App für Kurzreise-Empfehlungen. Sie schlägt Orte aus einem festen Atlas vor: einer kuratierten Liste spirituell und symbolisch bedeutsamer Orte in `backend/data/places.json`. Es gibt kein Nutzerkonto, kein Login für Besucher und kein Abo. Der Gesprächsverlauf bleibt im Browser. Die Datenbank speichert nur anonyme Nutzungsstatistik.

Die Anwendung besteht aus drei laufenden Teilen:

- **Frontend** (`frontend/`): React-Oberfläche, die nginx als statische Dateien ausliefert.
- **API** (`backend/`): Python-Dienst mit FastAPI. Er liest den Atlas, bewertet Antworten, spricht mit OpenAI und schreibt Statistik.
- **Datenbank** (`db` in Docker Compose): MySQL 8, ausschließlich für die Tabelle `usage_events`.

Im Browser spricht das Frontend die API über das Präfix `/api` an. nginx (Produktion) bzw. der Vite-Entwicklungsserver (lokal) streicht dieses Präfix und leitet die Anfrage an die API weiter. Affiliate-Links unter `/go/…` gehen direkt an die API und leiten weiter zu Booking.com.

## Verzeichnisstruktur

```
mysoulmap/
├── frontend/                 Oberfläche (React)
│   ├── index.html            Einstieg der Seite
│   ├── package.json          JavaScript-Abhängigkeiten und npm-Skripte
│   ├── vite.config.js        Dev-Server, API-Proxy, Testumgebung
│   ├── nginx.conf            Produktions-nginx im Web-Image
│   ├── Dockerfile            Baut das Frontend und packt es in nginx
│   ├── public/               Statische Dateien (z. B. Hintergrundbild)
│   ├── scripts/              Hilfsskripte und PDF-Proben, nicht Teil der App
│   └── src/
│       ├── main.jsx          Startet React
│       ├── App.jsx           Routen der Anwendung
│       ├── index.css         Globale Styles (Tailwind)
│       ├── components/       Gemeinsame Bausteine (Chat, Hülle, Exportleiste)
│       ├── ritual/           Fragebogen auf der Startseite
│       ├── results/          Ergebnisseite mit Karte und Empfehlungen
│       ├── chat/             Chat-Client, Texte, Booking-Links
│       ├── export/           PDF- und Screenshot-Export im Browser
│       ├── admin/            Statistik-Dashboard
│       └── legal/            Impressum, Datenschutz, Terms and Conditions
├── backend/                  REST-API (Python)
│   ├── pyproject.toml        Einstellungen für Ruff, mypy und pytest
│   ├── requirements.txt      Laufzeit-Abhängigkeiten
│   ├── requirements-dev.txt  Test- und Prüfwerkzeuge
│   ├── Dockerfile            API-Image (Gunicorn + Uvicorn)
│   ├── alembic.ini           Konfiguration der Datenbankmigrationen
│   ├── data/places.json      Der Atlas, wird beim Start geladen
│   ├── migrations/           Alembic-Migrationen (Schema von usage_events)
│   ├── tests/                pytest-Tests der API
│   └── src/
│       ├── main.py           Routen, CORS, Fehler, Start der Datenbank
│       ├── atlas.py          Laden und Filtern der Orte
│       ├── match.py          Bewertung der Ritual-Antworten
│       ├── chat.py           Chat-Ablauf, inkl. Fallback
│       ├── llm.py            Aufruf der OpenAI-API
│       ├── prompts.py        Systemprompt
│       ├── fallback.py       Empfehlung ohne Sprachmodell
│       ├── booking.py        Booking.com-Suchlinks
│       ├── events.py         Schreiben der Nutzungsereignisse
│       ├── stats.py          Auswertung für das Dashboard
│       ├── models_events.py  Tabellenmodell usage_events
│       ├── models_chat.py    Anfrage- und Antwortform des Chats
│       ├── geoip.py          IP-Adresse zu Ländercode
│       ├── purge.py          Löschen von Ereignissen nach 6 Monaten
│       ├── rate_limit.py     Anfragegrenzen pro IP
│       ├── admin_auth.py     Admin-Login und Sitzungscookie
│       ├── admin_pages.py    Einfache HTML-Seiten der API (parallel zum React-Admin)
│       ├── db.py             Datenbankverbindung
│       ├── logging_config.py JSON-Zugriffsprotokoll
│       └── envfile.py        Liest lokale .env beim Start
├── nginx/default.conf        nginx für die lokale Compose-Umgebung
├── openspec/                 Spezifikationen (OpenSpec)
│   ├── config.yaml           Projektkontext für Specs
│   └── specs/                Fähigkeiten: atlas, chat, export, frontend, …
├── docs/                     Diese Übersicht und die Softwarespezifikation
├── .github/workflows/        CI und Deploy auf den VPS
├── docker-compose.yml        Lokale Umgebung: API, MySQL, nginx
├── docker-compose.prod.yml   Produktion: fertige Images von GHCR
├── Dockerfile                Alternativer Frontend-Build vom Repo-Wurzelverzeichnis
└── .env.example              Platzhalter für Geheimnisse (echte Werte nur in .env)
```

## Routen der Oberfläche

`frontend/src/App.jsx` legt diese Pfade fest:

| Pfad | Modul | Aufgabe |
|---|---|---|
| `/` | `ritual/RitualApp.jsx` | Fragebogen, danach Aufruf von `POST /api/match` |
| `/results` | `results/ResultsPage.jsx` | Karte, Anima-Karte, Buchungslinks, Chat, Export |
| `/chat` | `components/ChatApp.jsx` | Eigenständiger Chat |
| `/admin` | `admin/AdminApp.jsx` | Login und Statistikdiagramme |
| `/impressum` | `legal/LegalPages.jsx` | Impressum |
| `/datenschutz` | `legal/LegalPages.jsx` | Datenschutzerklärung |
| `/disclaimer` | `legal/LegalPages.jsx` | Terms and Conditions |

Ritual-Antworten, Sprache und das Matchergebnis liegen in `sessionStorage` (`ritual/session.js`). Schließt man den Tab, ist der Stand weg. Es entsteht kein Nutzerprofil.

## Features

### Ritual und Matching

Die Startseite führt durch einen festen Fragebogen (Symbole, Rhythmus, Element, Freitext). Die Antworten gehen an `POST /match`. `match.py` leitet daraus eine Anima-Karte ab (Archetyp, Element, innerer Rhythmus, Reise-Richtung) und bewertet jeden Atlas-Ort mit einer festen Punktelogik. Zurück kommen die besten Treffer, jeweils mit Begründung und einem Buchungslink der Form `/go/{id}`. Dieser Schritt braucht kein Sprachmodell.

### Chat

`POST /chat` ist zustandslos: Der Browser schickt den bisherigen Verlauf mit. Der Server speichert keine Nachrichten. `llm.py` ruft OpenAI (`gpt-5-mini`) mit Structured Outputs auf, damit die Antwort ein festes JSON-Format hat. Empfohlene Orte müssen im Atlas liegen. Fällt die API aus oder ist die Antwort ungültig, wählt `fallback.py` Orte per Schlüsselwortvergleich. Die Antwort enthält dann `source: "fallback"` und einen festen Textbaustein. Beim ersten Kontakt setzt die API ein KI-Hinweis-Flag (`ai_disclosure`, EU AI Act Art. 50).

### Ergebnisseite

`/results` zeigt die Anima-Karte, die Treffer auf einer Leaflet-Karte (Kacheln von OpenStreetMap) und Buchungslinks. Von hier aus kann man weiterchatten; zusätzliche Orte aus dem Chat erscheinen neben den Match-Treffern. Ohne gespeichertes Ritual leitet die Seite auf `/` um.

### Export

PDF (`jspdf`) und Screenshot (`html2canvas`) entstehen nur im Browser. Dafür gibt es keinen API-Endpunkt. `export/flattenColors.js` und `export/oklch.js` bereiten CSS-Farben so auf, dass html2canvas sie zeichnen kann. Ein QR-Code (`qrcode.react`) verweist auf die Ergebnisseite.

### Affiliate

`GET /go/{place_id}` prüft, ob der Ort im Atlas ist, schreibt ein Ereignis `affiliate_click` und antwortet mit einer Weiterleitung (HTTP 302) auf eine Booking.com-Suche. Die Partner-ID kommt aus `BOOKING_AFFILIATE_ID`.

### Statistik und Admin

Jedes Match, jeder Chat und jeder Affiliate-Klick kann eine Zeile in `usage_events` erzeugen: Zeitpunkt, Ereignisart, IP, Ländercode (lokal über GeoIP), primäre Betriebssystem- oder Browsersprache, optional Ort, LLM-Latenz, Tokenzahlen und Fehlercode. Gesprächsinhalte stehen nicht in der Tabelle. Ein Hintergrundjob löscht Einträge, die älter als sechs Monate sind.

`/admin` im Frontend verlangt den festen Benutzer `aku` und ein Passwort. Das Passwort liegt als bcrypt-Hash in `ADMIN_PASSWORD_HASH`. Nach dem Login setzt die API ein HttpOnly-Sitzungscookie (Bibliothek `itsdangerous`). `GET /admin/stats` liefert die Zahlen; `recharts` zeichnet sie. Dieselbe API kann eine schlichte HTML-Ansicht aus `admin_pages.py` ausliefern.

### Schutz der API

`slowapi` begrenzt Anfragen pro IP (Chat, Atlas, Match, Affiliate, Admin-Login, Statistik). CORS erlaubt nur die in `CORS_ORIGIN` genannten Origins. Das Produktions-nginx setzt Sicherheitsheader (CSP, HSTS, `X-Content-Type-Options`, `Referrer-Policy`).

### Sprachen

Oberflächentexte und Chat gibt es auf Deutsch, Englisch, Spanisch und Russisch.

## API-Endpunkte

Basis der API ist die Wurzel des FastAPI-Prozesses. Von außen hängen die meisten Pfade unter `/api`.

| Methode | Pfad | Zweck |
|---|---|---|
| `GET` | `/health` | Laufstatus und Anzahl geladener Orte |
| `GET` | `/atlas/places` | Atlas, filterbar nach Element, Archetyp, Schlüsselwort |
| `GET` | `/atlas/places/{id}` | Ein Ort |
| `POST` | `/match` | Ritual-Antworten → Anima-Karte und Treffer |
| `POST` | `/chat` | Empfehlung per Sprachmodell, sonst Fallback |
| `GET` | `/go/{id}` | Klick zählen und zu Booking.com weiterleiten |
| `POST` | `/admin/login` | Admin anmelden, Cookie setzen |
| `POST` | `/admin/logout` | Cookie löschen |
| `GET` | `/admin/stats` | Kennzahlen, nur mit gültiger Sitzung |
| `GET` | `/admin` | HTML-Login oder HTML-Statistik |

## Abhängigkeiten

### Frontend (`frontend/package.json`)

Laufzeit, was die Seite im Browser braucht:

| Paket | Rolle |
|---|---|
| `react`, `react-dom` | Oberflächenbibliothek |
| `react-router-dom` | Pfade wie `/`, `/results`, `/admin` |
| `leaflet`, `react-leaflet` | Karte auf der Ergebnisseite |
| `recharts` | Diagramme im Admin-Dashboard |
| `jspdf` | PDF im Browser |
| `html2canvas` | Screenshot eines Seitenausschnitts |
| `qrcode.react` | QR-Code auf der Ergebnisseite |
| `react-markdown` | Darstellung von Chat-Text |

Entwicklung und Tests:

| Paket | Rolle |
|---|---|
| `vite`, `@vitejs/plugin-react` | Dev-Server und Produktions-Build |
| `tailwindcss`, `@tailwindcss/vite` | Utility-CSS |
| `vitest`, `jsdom` | Tests ohne echten Browser |
| `@testing-library/react`, `jest-dom`, `user-event` | Komponenten so anklicken und prüfen, wie ein Nutzer sie sieht |

npm-Skripte: `npm run dev` (Entwicklung), `npm run build` (statisches Bundle nach `frontend/dist`), `npm test` (Vitest).

### Backend (`backend/requirements.txt`)

| Paket | Rolle |
|---|---|
| `fastapi` | HTTP-API, Validierung der Anfragen |
| `uvicorn` | ASGI-Server; in Produktion als Worker unter Gunicorn |
| `gunicorn` | Prozessverwaltung, zwei Worker im Image |
| `pydantic` | Datenmodelle und Prüfung von JSON |
| `sqlmodel` | Tabellenmodell, das Pydantic und SQLAlchemy verbindet |
| `alembic` | Versionierte Änderungen am Datenbankschema |
| `pymysql` | MySQL-Treiber |
| `openai` | Client für die OpenAI-API |
| `geoip2` | Lokale Auflösung IP → Land (MaxMind-Datenbank, Pfad `GEOIP_DB_PATH`) |
| `slowapi` | Rate-Limits |
| `passlib` (mit `bcrypt`) | Prüfen des Admin-Passworts |
| `itsdangerous` | Signierte, zeitlich begrenzte Admin-Cookies |

Entwicklung (`requirements-dev.txt`): `pytest` und `httpx` für API-Tests, `ruff` für Stil und einfache Fehler, `mypy` für Typprüfung. Python-Zielversion ist 3.12 (`pyproject.toml`).

### Betrieb

| Werkzeug | Rolle |
|---|---|
| Docker, Docker Compose | API, MySQL und nginx als getrennte Container |
| MySQL 8 | Tabelle `usage_events` |
| nginx | Statische Dateien, Proxy auf die API, Sicherheitsheader |
| GitHub Actions | Workflow `Build & Deploy`: Images bauen, nach GHCR schieben, per SSH auf den VPS `docker compose pull` und `up` |
| GHCR | Container-Registry (`ghcr.io/…-api`, `ghcr.io/…-web`) |
| OpenSpec | Specs unter `openspec/specs/` beschreiben die Fähigkeiten, bevor sie umgesetzt werden |

Geheimnisse (OpenAI-Schlüssel, Datenbankpasswort, Admin-Hash, Booking-Partner-ID) stehen nur in der Umgebung bzw. in `.env`, nicht im Quelltext. `.env.example` listet die Namen.

## Fachbegriff-Legende

Kurze Erklärungen der Werkzeuge und Begriffe, die im Projekt vorkommen.

**React** — Bibliothek für Oberflächen. Die Seite ist ein Baum aus Komponenten (z. B. `RitualApp`, `ResultsPage`). Zustand wie der aktuelle Frageschritt lebt in der Komponente, nicht auf dem Server.

**Vite** — Werkzeug, das die React-Dateien im Entwicklungsserver sofort ausliefert und für die Produktion ein statisches Bundle baut (`npm run build`).

**Tailwind CSS** — CSS-Framework. Gestaltung steht als Klassen direkt am Element (`className`), statt in großen eigenen Stylesheets.

**React Router** — Ordnet URL-Pfade Komponenten zu. `/results` ist dadurch eine eigene Seite, obwohl alles eine einzelne Anwendung ist (SPA, Single Page Application).

**SPA** — Die erste HTML-Datei lädt JavaScript; weitere „Seiten“ tauscht React aus, ohne die ganze Seite neu vom Server zu holen. nginx fällt deshalb mit `try_files … /index.html` auf `index.html` zurück.

**sessionStorage** — Kleiner Speicher im Tab. Soulmap legt dort Ritual und Sprache ab. Anders als `localStorage` überlebt er das Schließen des Tabs nicht. Es ist kein Cookie und kein Konto.

**Leaflet** — Kartenbibliothek. Sie zeichnet die Karte; die Kachelbilder kommen von OpenStreetMap. `react-leaflet` bindet Leaflet in React-Komponenten ein.

**Recharts** — Diagrammbibliothek auf Basis von React, genutzt im Admin-Dashboard.

**jsPDF** — Erzeugt PDF-Dateien in JavaScript, hier vollständig im Browser.

**html2canvas** — Fotografiert einen Ausschnitt der Seite als Bild, indem es das DOM nachzeichnet. Manche CSS-Farben (OKLCH) muss das Projekt vorher in einfachere Werte umrechnen.

**FastAPI** — Python-Framework für HTTP-APIs. Eine Funktion mit `@app.post("/chat")` wird zum Endpunkt. Anfragekörper werden an Pydantic-Modelle gebunden.

**Pydantic** — Prüft Daten gegen ein Schema (Typen, Längen, erlaubte Werte). Ungültige Anfragen beantwortet die API mit Status 422.

**Uvicorn** — Server, der die async-fähige FastAPI-App ausführt. Async heißt: Während auf OpenAI gewartet wird, kann derselbe Prozess andere Anfragen annehmen.

**Gunicorn** — Startet mehrere Uvicorn-Worker-Prozesse und startet sie neu, wenn einer ausfällt. Im API-Image sind es zwei Worker.

**ASGI** — Schnittstelle zwischen Python-Webframework und Server. FastAPI spricht ASGI, Uvicorn und Gunicorn (mit Uvicorn-Worker) ebenfalls.

**SQLModel** — Eine Klasse beschreibt zugleich die Python-Struktur und die Datenbanktabelle. Genutzt für `UsageEvent`.

**SQLAlchemy** — Darunter liegende Bibliothek für Datenbankzugriff. SQLModel baut darauf auf. Alembic nutzt sie für Migrationen.

**Alembic** — Hält Schema-Änderungen als versionierte Skripte in `backend/migrations/`. So ist nachvollziehbar, wie die Tabelle entstanden ist.

**PyMySQL** — Treiber, über den Python mit MySQL spricht.

**OpenAI API / gpt-5-mini** — Externer Dienst für die Chat-Empfehlung. Der Schlüssel `OPENAI_API_KEY` bleibt auf dem Server. Das Modell darf nur Orte aus dem Atlas nennen.

**Structured Outputs** — Die API verlangt vom Modell ein JSON, das zu einem Pydantic-Modell passt. Weicht die Antwort ab, gilt der Aufruf als fehlgeschlagen und der Fallback übernimmt.

**Fallback** — Deterministische Ersatzlogik in `fallback.py`. Sie vergleicht Wörter der Nutzereingabe mit Schlüsselwörtern, Element und Archetyp der Orte. Sie braucht kein Netz außer dem eigenen Server.

**GeoIP / geoip2** — Eine lokale MaxMind-Datenbank übersetzt die IP-Adresse in einen Ländercode. Die IP verlässt dafür den Server nicht. Ohne Datei unter `GEOIP_DB_PATH` bleibt das Land leer.

**Rate-Limit** — Obergrenze, wie oft eine IP einen Endpunkt in einem Zeitfenster aufrufen darf. `slowapi` antwortet bei Überschreitung mit Status 429.

**CORS** — Browser-Regel, welche fremde Herkunft eine API aufrufen darf. Soulmap erlaubt nur die eigene Domain (`CORS_ORIGIN`).

**CSP (Content-Security-Policy)** — Header, der dem Browser sagt, von wo Skripte, Bilder und Verbindungen kommen dürfen. Hier: eigene Origin, OSM-Kacheln, keine Einbettung in fremde Frames.

**HSTS** — Header, der den Browser anweist, die Seite nur noch über HTTPS aufzurufen.

**bcrypt / passlib** — Das Admin-Passwort liegt nicht im Klartext, sondern als Hash. Beim Login wird die Eingabe gegen den Hash geprüft, ohne das Passwort zu speichern.

**itsdangerous** — Signiert den Sitzungscookie. Der Server erkennt eine Fälschung, ohne die Sitzung in der Datenbank abzulegen. `HttpOnly` verhindert, dass Seiten-JavaScript das Cookie liest.

**nginx** — Webserver und Reverse Proxy. Er liefert das Frontend aus und leitet `/api` und `/go` an den API-Container weiter.

**Docker / Compose** — Ein Image ist ein fertiges Paket einer Anwendung. Compose startet API, Datenbank und nginx gemeinsam und setzt Umgebungsvariablen und das Netzwerk `application_internal`.

**GHCR** — GitHub Container Registry. Der Deploy-Workflow lädt die gebauten Images dorthin; der VPS zieht sie mit `docker compose pull`.

**GitHub Actions** — Automatisierung in `.github/workflows/`. `deploy.yml` baut bei Push auf `main` die Images und spielt sie auf dem Server ein. `ci.yml` ist derzeit nur ein Platzhalter ohne Lint oder Tests.

**OpenSpec** — Arbeitsweise im Ordner `openspec/`. Jede Fähigkeit (Atlas, Chat, Export, Sicherheit, Statistik, Frontend, Affiliate, Compliance) hat eine Spec mit Anforderungen. Änderungen werden erst beschrieben, dann umgesetzt.

**Atlas** — Die kuratierte Orteliste in `places.json`. Empfehlungen dürfen diesen Bestand nicht verlassen. Die Datei wird beim API-Start geladen, nicht bei jedem Request neu.

**Affiliate** — Partnerlink. Ein Klick auf `/go/{id}` wird gezählt und leitet zu Booking.com weiter. Die Links sind Werbung (`rel="sponsored"`).

**Anima-Karte** — Aus den Ritual-Antworten abgeleitete Kurzbeschreibung (Symbol, Element, Rhythmus, Intensität, Reiserichtung). Sie steuert die Punktevergabe im Matching und erscheint auf der Ergebnisseite.

**Usage Event** — Eine Zeile Statistik: Formular abgeschickt, Ergebnis angesehen oder Affiliate-Link geklickt. Dazu optional LLM-Status (`success`, `error`, `fallback`).
