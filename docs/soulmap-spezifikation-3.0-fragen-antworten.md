# Soulmap Spezifikation 3.0 — Fragen und Antworten

**Stand:** 24.11.2026 · **Abgelöst durch** `soulmap-spezifikation-3.1-fragen-antworten.md`  
**Quelle:** `soulmap-softwarespezifikation-3.0.md`  
Die Antworten geben nur wieder, was diese Fassung festlegt.

---

## 1. Überblick

**Was ist Soulmap?**  
Eine öffentlich erreichbare, anonyme Web-App. Sie führt durch ein kurzes Ritual und zeigt danach bis zu drei Orte aus einem festen Atlas von 40 spirituell und symbolisch bedeutsamen Orten. Der Chat schärft diese Orte nach.

**Gibt es ein Nutzerkonto?**  
Nein. Es gibt kein Nutzerkonto, kein Login für Besucher und kein Abo.

**Womit beginnt die Anwendung?**  
Mit dem Ritual. `POST /match` bewertet die Antworten deterministisch und ohne Sprachmodell. Der leere Chat ist nicht der Einstieg.

**Speichert der Server das Gespräch?**  
Nein. Der Chat bleibt zustandslos. Der Browser hält den Verlauf, der Server speichert keine Nachrichten.

**Dürfen beliebige Reiseziele empfohlen werden?**  
Nein. Empfehlungen bleiben im Atlas. Orte außerhalb von `places.json` werden verworfen.

**Was wird dauerhaft gespeichert?**  
Nur die Tabelle `usage_events` für anonyme Nutzungsstatistik.

**Welche Sprachen gibt es?**  
Deutsch, Englisch, Spanisch und Russisch. Ohne erkennbare Systemsprache bleibt Deutsch.

**Wer sind die Stakeholder?**  
Andre ist Product Owner, Betreiber und setzt das Produkt technisch um. Guillermo Rodini ist Buchautor; das SEELENWEGE-Manuskript ist die inhaltliche Grundlage des Atlas.

---

## 2. Änderungen gegenüber Spezifikation 2.x

**Wie hat sich der Einstieg verändert?**  
In 2.x war der Chat die erste Funktion. In 3.0 kommt ein Scroll-Intro, danach acht Fragen, dann die Ergebnisseite.

**Wie werden Orte gewählt?**  
`POST /match` wählt ohne Sprachmodell. Der Chat schärft auf der Ergebnisseite nach. In 2.x lief die Ortswahl nur über `/chat`.

**Wie ist die Sprache umgesetzt?**  
Ein Schalter für `de`, `en`, `es` und `ru`. Der Server wählt die Systemsprache. Standard ist Deutsch.

**Woher kommen die Atlas-Texte?**  
Anzeigenamen und Texte stehen zusätzlich in `place_i18n.json`. In 2.x gab es nur einen Sprachstand in `places.json`.

**Wie ist die Ergebnisseite neu?**  
Sie ist eine eigene Route `/results` und öffnet immer oben.

**Was zeigt die Karte?**  
Eine Leaflet-Karte, den ungefähren Standort über `GET /geo` und das Terrain in einem Dialog.

**Was hat sich an der Buchung geändert?**  
Neben dem Redirect `/go/{id}` gibt es einen Suchlink mit Koordinate, 20 km Radius und Sprache.

**Warum Noto Sans im PDF?**  
Damit Russisch in kyrillischer Schrift lesbar bleibt. Der Export bleibt clientseitig.

**Welche Rechtstexte gibt es?**  
Seiten für Impressum, Datenschutz und Nutzungsbedingungen, jeweils in vier Sprachen.

**Wie wird ausgeliefert?**  
Ein Workflow bei Push auf `main`: Images nach GHCR, danach SSH-Deploy auf den VPS. Die getrennte Dev- und Prod-Pipeline aus 2.x gilt nicht mehr.

---

## 3. Nutzerfluss

**Was passiert im Intro?**  
Die Startseite beginnt mit einer scrollbaren Partikelanimation in sechs Phasen: Stille, Erde, Wasser, Feuer, Luft, Äther. In der letzten Phase bilden die 40 Atlas-Orte eine Konstellation. Texte, Hinweis, Überspringen und „Beginne deine Reise“ folgen der gewählten Sprache.

**Gibt es Ton oder einen Chat im Intro?**  
Nein. Es gibt keinen Ton und keinen Abschnitt „Hier beginnt der Chat“.

**Wie ist das Ritual aufgebaut?**  
Acht Fragen. Sechs davon sind eine Auswahl, zwei sind Freitext: ein Wort und ein Ort. Die Antwort scrollt zur nächsten Frage. Am Ende steht eine Anima-Karte.

**Was passiert nach dem Ritual?**  
`POST /match` speichert Karte und Treffer in `sessionStorage` und öffnet `/results` oben. Die Seite zeigt Karte, Orte, Buchungslinks, eine Druckkarte und den Chat.

**Was darf der Chat auf der Ergebnisseite?**  
Er bleibt im Atlas. Weitere Orte aus dem Gespräch erscheinen neben den Match-Treffern.

**Was passiert, wenn jemand `/results` ohne Ritual öffnet?**  
Die Seite leitet auf `/` zurück.

**Wie lange bleiben Ritual und Sprache erhalten?**  
Sie liegen in `sessionStorage` und enden mit dem Tab.

**Wie merkt sich die Seite das Intro?**  
`localStorage` unter `soulmap_splash_seen_v1`. Erster Besuch: 600 vh Scrollweg. Wiederkehr: 260 vh. Bei `prefers-reduced-motion` ist das Intro eine Bildschirmhöhe und zeigt sofort die letzte Phase mit dem Aufruf zur Reise.

---

## 4. Architektur und Backend

**Woraus besteht das System?**  
Eine externe Webseite verlinkt auf das Frontend (React, Vite, Tailwind). Das Frontend spricht per HTTPS und JSON über das Präfix `/api` mit einer FastAPI-REST-API. Die API liest Atlas und `place_i18n`, bewertet das Ritual ohne LLM, ruft für den Chat die OpenAI-API mit Fallback auf und löst das Land lokal per GeoIP auf. MySQL hält `usage_events`. `/admin` ist das Statistik-Dashboard hinter einem Login.

**Ist der Chat auf dem Server zustandslos?**  
Ja. Die REST-API führt den Chat zustandslos.

**Wann werden Atlas und Übersetzungen geladen?**  
`places.json` und `place_i18n.json` werden beim Start geladen. Es gibt kein Hot-Reload.

**Was liegt in MySQL?**  
Nur Statistik. Keine Gespräche und kein Ritual.

**Welcher Stack betreibt das Backend?**  
Python 3.12+, FastAPI, Gunicorn und Uvicorn. Sie übernehmen API, Validierung und Matching.

**Welches Modul bewertet das Ritual?**  
`match.py`. Es vergibt feste Punkte aus den acht Antworten und ruft kein Sprachmodell auf.

**Welches Modell spricht der Chat an?**  
OpenAI `gpt-5-mini` mit Structured Outputs, und nur über `/chat`.

**Was passiert, wenn das Modell ausfällt?**  
Ein Keyword-Matching in Python liefert 1–2 Atlas-Orte.

**Wofür ist GeoIP da?**  
`geoip2` mit der lokalen MaxMind-GeoLite2-Datenbank ermittelt das Land für die Statistik und den ungefähren Standort für die Karte.

**Wie ist der Admin geschützt?**  
Fester Benutzer `aku`, Passwort als bcrypt-Hash, signiertes Cookie. Der Zugang gilt nur für das Statistik-Dashboard.

---

## 5. Datenmodell

**Welche Felder muss ein Atlas-Ort haben?**  
`schemaVersion` (2), `id`, `name`, `country`, `coordinates.lat`, `coordinates.lng`, `element`, `archetyp`, `primaervibration`, `correspondence` und `keywords`. `region` darf fehlen.

**Welche Elementschlüssel sind erlaubt?**  
`earth`, `water`, `fire`, `air` und `aether`.

**Was passiert bei einer doppelten Orts-ID?**  
Der Start schlägt fehl.

**Wie ist `place_i18n.json` aufgebaut?**  
Die obersten Schlüssel sind `de`, `en`, `es` und `ru`. Darunter steht die Atlas-`id`. Eine Zeile kann `name` und weitere Anzeigefelder tragen.

**Welcher Name gilt, wenn die Übersetzung fehlt?**  
Der Name aus `places.json`. Die Übersetzungsdatei wird mit ins API-Image kopiert.

**Wo liegt das Ritual im Browser?**  
`sessionStorage` unter `soulmap.ritual` und `soulmap.language`. Das Ritual gilt nur, wenn `result.matches` und `result.anima_card` vorhanden sind.

**Welche Werte darf die Sprache haben?**  
`de`, `en`, `es` oder `ru`.

**Welche Form haben die acht Antworten?**  
`q0` bis `q4` sind Indizes 0–4 (Landschaft, Bewegung, Spannung, Element, Symbol). `q5` ist ein Index 0–3 (Körperbewegung). `q6` ist Text mit 1–400 Zeichen (Wort). `q7` ist Text mit 2–400 Zeichen (Ort).

**Was steht in `usage_events`?**  
Anonyme Ereignisse, keine Gesprächsinhalte. Einträge werden nach 6 Monaten gelöscht. Die primäre Systemsprache aus `Accept-Language` wird als `os_language` gespeichert, zum Beispiel `de-DE`, nicht der ganze Header.

---

## 6. REST-API

**Unter welchem Pfad spricht das Frontend die API an?**  
JSON-Endpunkte hängen von außen unter `/api`. `/go/…` geht ohne dieses Präfix an die API. Besucher schicken keinen Auth-Header.

**Was liefert `GET /health`?**  
Laufstatus und die Anzahl geladener Orte.

**Was liefert `GET /language`?**  
Eine von `de`, `en`, `es`, `ru`, abgeleitet aus der primären Systemsprache.

**Wie wird die Systemsprache gelesen?**  
Der Server nimmt den ersten Sprach-Tag von `Accept-Language`. `en-US` wird `en`, `es-MX` wird `es`. Jeder andere Tag, ein leerer Header oder `*` ergibt `de`. Der Browser schickt den Header von selbst.

**Überschreibt die Erkennung eine manuelle Sprachwahl?**  
Nein. Hat der Besucher im Schalter schon eine Sprache gewählt, ignoriert die Oberfläche die Antwort.

**Was liefert `GET /geo`?**  
Einen ungefähren Standort aus der IP, lokal über GeoIP.

**Was liefert der Atlas?**  
`GET /atlas/places` und `GET /atlas/places/{id}`. Die Liste ist filterbar nach Element, Archetyp und Schlüsselwort.

**Was schickt `POST /match`?**  
`{ "answers": { q0…q7 }, "language": "de" }`.

**Was kommt von `POST /match` zurück?**  
`anima_card` und `matches` mit id, Name, Land, Koordinaten, Begründung, `booking_link` als `/go/{id}` und `booking_url` als fertige Booking-Suche. Die Suche setzt Breite, Länge, Radius 20 km, `dest_type=latlong` und Sortierung nach Entfernung. Es gibt keinen OpenAI-Aufruf.

**Was ist der Vertrag von `POST /chat`?**  
Verlauf und `shown_place_ids` kommen vom Client. `source` ist `llm` oder `fallback`. `ai_disclosure` kennzeichnet die KI. Empfohlene Orte tragen ebenfalls `booking_url`. Timeout und Fallback bleiben wie in 2.x.

**Gibt es einen Endpunkt für PDF oder Screenshot?**  
Nein.

**Was macht `GET /go/{place_id}`?**  
Der Klick wird gezählt. Die Antwort ist ein Redirect 302 auf die Booking-Suche. Der Parameter `lang` wählt die Buchungssprache.

**Wie meldet sich der Admin an?**  
`POST /admin/login` und `POST /admin/logout`. `GET /admin/stats` liefert Kennzahlen nur mit Sitzung. `GET /health/signals` ist die Betriebsampel und verlangt ein Monitor-Token.

**Welche Rate-Limits gelten pro IP?**  
`/chat` und `/match` 20 pro Minute. `/atlas/*` 60 pro Minute. `/language` und `/geo` 60 pro Minute. `/go/{id}` 30 pro Minute. `/admin/stats` 10 pro Minute. `/admin/login` 5 pro Minute. Das Limit setzt `slowapi` und ist der einzige Schutz ohne Besucher-Login.

---

## 7. Oberfläche

**Wie ist das Intro gebaut?**  
Eine eigene Canvas-Fläche über die volle Breite, klebend im Viewport, gesteuert vom Scrollfortschritt. Die Partikel-Engine ist framework-frei. Phasen morphen ineinander. Die Äther-Phase zeichnet die Orte aus `GET /atlas/places` und färbt sie nach Element.

**Wohin führen „Überspringen“ und „Beginne deine Reise“?**  
Zur ersten Frage. Der Prototyp-Abschnitt mit einem Schein-Chat und der Schalter „Mit Klang erleben“ gehören nicht zur Anwendung.

**Wo sitzt der Sprachschalter?**  
In der Kopfzeile, in der Reihenfolge es, en, de, ru. Beim ersten Besuch ohne gespeicherte Sprache fragt die Oberfläche `GET /language` und stellt den Schalter darauf. Eine manuelle Wahl gilt für den Tab. Liegt schon ein Ritual mit Sprache vor, bleibt diese. `document.documentElement.lang` folgt der Auswahl. Intro, Fragen, Ergebnisse, Chat, Rechtstexte und Buchungslinks nutzen dieselbe Sprache.

**Warum öffnet die Ergebnisseite oben?**  
Sie setzt beim Öffnen `window.scrollTo(0, 0)`, damit die Scrollposition des langen Rituals nicht unten stehen bleibt. Der KI-Hinweis und der Terrain-Dialog fokussieren ihre Schaltfläche ohne die Seite zu verschieben (`preventScroll`).

**Was ist auf der Ergebnisseite sichtbar?**  
Überschrift, Anima-Karte, Leaflet-Karte mit Treffern und optionalem Herkunftskreis, Ortsliste mit Land, QR-Code und Buchungslink, Druckkarte und eingebetteter Chat. Kacheln kommen von OpenStreetMap.

**Was öffnen „Terrain anzeigen“ und „Mehr erfahren“?**  
„Terrain anzeigen“ öffnet die Karte in einem Dialog. „Mehr erfahren“ öffnet denselben Dialog mit einem Chat, der nur diesen einen Ort vertieft.

**Welche Frontend-Technik trägt die Seiten?**  
React 18, Vite, Tailwind und React Router als eine SPA. Karte über Leaflet und react-leaflet. Export über jsPDF, html2canvas und Noto Sans, nur im Browser.

**Wo liegen die Rechtstexte?**  
`/impressum`, `/datenschutz` und `/disclaimer`, Texte in `de`, `en`, `es` und `ru`, erreichbar aus der Fußzeile. Eine juristische Prüfung der Formulierungen ist damit nicht ersetzt.

---

## 8. Sicherheit

**Wie ist der Chat gegen Eingriffe abgesichert?**  
Der Systemprompt geht nur als Systemrolle. Der Verlauf ist keine Autorität. Die Ausgabe gilt nur gegen den Atlas. Aus der Modellantwort wird kein HTML erzeugt. Es gibt Längengrenzen und keinen Werkzeugzugriff des Modells.

**Welche Netzgrenzen gelten?**  
CORS nur auf die eigene Domain. nginx setzt CSP, HSTS, `X-Content-Type-Options` und `Referrer-Policy`. `X-Forwarded-For` gilt nur, wenn der Proxy ihn setzen darf.

---

## 9. Deployment

**Wann startet das Ausrollen?**  
Der GitHub-Actions-Workflow `Build & Deploy` startet bei Push auf `main`.

**Was baut der Workflow?**  
Das API-Image und das Web-Image für `linux/amd64`. Er schiebt sie nach GHCR und zieht sie per SSH auf dem VPS mit `docker compose -f docker-compose.prod.yml pull && up -d`.

**Wie spielt man manuell auf dem Server aus?**  
`hostinger-up.sh` legt das Repository nach `/opt/mysoulmap`. Die Datei `.env` bleibt liegen. Images werden gezogen und gestartet. Geheimnisse stehen nur in der Umgebung, nicht im Quelltext.

**Unter welcher Adresse läuft die Anwendung?**  
`https://app.mithertz.online`.

---

## 10. Rechtliches

**Ist dieser Abschnitt eine Rechtsberatung?**  
Nein.

**Wie ist die KI gekennzeichnet?**  
Nach AI Act Art. 50 erscheint der KI-Hinweis auf der Ergebnisseite, bevor der Chat genutzt wird. Die Chat-Antwort trägt `ai_disclosure`.

**Welche personenbezogenen Daten sammelt die Statistik?**  
`usage_events` speichert IP, Land und Systemsprache. Die Rechtsgrundlage bleibt das berechtigte Interesse. Die Löschfrist beträgt 6 Monate.

**Welche Teile verlassen das eigene System in Richtung OpenAI?**  
Nur der Chat. Match, Intro und Sprache nicht.

**Wie sind Buchungslinks gekennzeichnet?**  
Als Anzeige, mit `rel="sponsored"`.

**Sind die Rechtstexte freigegeben?**  
Die Seiten sind vorhanden und übersetzt. Die rechtliche Freigabe der Texte bleibt offen.

**Wie weit ist die Barrierefreiheit spezifiziert?**  
Das Intro respektiert `prefers-reduced-motion`. Eine vollständige Prüfung nach dem European Accessibility Act ist nicht Teil dieser Fassung.

---

## 11. Offene Punkte

**Was bleibt offen?**  
Die juristische Prüfung von Impressum, Datenschutz und Nutzungsbedingungen. Die vollständige Einordnung zum European Accessibility Act. AVV/DPA mit OpenAI und der Drittlandtransfer. Ein Nutzer-Feedback für unangemessenen KI-Output. Ein Not-Aus für `/chat` ohne neues Deploy.

**Gilt die Risikoanalyse weiter?**  
Ja. `soulmap-ki-risikoanalyse.md` bleibt für den Chat gültig. Die offenen Punkte sind gegenüber dieser Analyse unverändert.

**Welche Fassung beschreibt die laufende Anwendung?**  
Spezifikation 3.0. Sie ersetzt 2.0 und 2.9 als Beschreibung. Die älteren Dokumente bleiben als Vorgänger im Ordner `docs/`.
