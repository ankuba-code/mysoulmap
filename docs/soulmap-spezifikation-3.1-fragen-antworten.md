# Soulmap Spezifikation 3.1 — Fragen und Antworten

**Stand:** 27.11.2026 · **Status:** umgesetzt, läuft auf dem VPS  
**Quelle:** `soulmap-softwarespezifikation-3.1.md`  
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

**Welches Modell spricht der Chat an?**  
Nur über OpenRouter, und nur eines von zwei: `gpt-5-mini` oder `claude-haiku-5-5`. Die Wahl liegt in der Datenbank.

**Was passiert, wenn das Modell ausfällt oder der Not-Aus gezogen ist?**  
Derselbe deterministische Fallback liefert 1–2 Atlas-Orte. Die Ergebnisseite bleibt nutzbar. Ein Modellaufruf und damit Modellkosten finden beim Not-Aus nicht statt.

**Was wird dauerhaft gespeichert?**  
Die Tabelle `usage_events` für anonyme Nutzungsstatistik, einschließlich Chat-Feedback. Die Tabelle `app_settings` hält die Betriebsschalter `chat_model` und `chat_halt`.

**Welche Sprachen gibt es?**  
Deutsch, Englisch, Spanisch und Russisch. Ohne erkennbare Systemsprache bleibt Deutsch.

**Wer sind die Stakeholder?**  
Andre ist Product Owner, Betreiber und setzt das Produkt technisch um. Guillermo Rodini ist Buchautor; das SEELENWEGE-Manuskript ist die inhaltliche Grundlage des Atlas.

---

## 2. Änderungen gegenüber Spezifikation 3.0

**Wohin geht der Chat?**  
Nicht mehr direkt zu OpenAI. Jeder Aufruf geht an OpenRouter. Im Admin wechselt man zwischen `gpt-5-mini` und `claude-haiku-5-5`.

**Wo liegt die Modellwahl?**  
In `app_settings` unter `chat_model`. Standard ohne Zeile ist `gpt-5-mini`. Die Wahl gilt für alle Worker und über einen Neustart, ohne neues Deploy.

**Was ist der Not-Aus?**  
Die Zeile `chat_halt` in `app_settings`. Steht sie auf `on`, ruft `/chat` kein Modell auf und antwortet mit dem Fallback.

**Was ist der Feedback-Kanal?**  
Like und Dislike an jeder Assistentenantwort, dazu eine optionale Notiz. Das Ereignis heißt `chat_feedback` und liegt in `usage_events`.

**Was bleibt gegenüber 3.0 gleich?**  
Ritual, Atlas, Karte, Buchung, Rechtstexte und der Deploy bei Push auf `main`.

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
Er bleibt im Atlas. Weitere Orte aus dem Gespräch erscheinen neben den Match-Treffern. Unter jeder Assistentenantwort sitzen „Gefällt mir“ und „Gefällt mir nicht“.

**Was passiert, wenn jemand `/results` ohne Ritual öffnet?**  
Die Seite leitet auf `/` zurück.

**Wie lange bleiben Ritual und Sprache erhalten?**  
Sie liegen in `sessionStorage` und enden mit dem Tab.

**Wie merkt sich die Seite das Intro?**  
`localStorage` unter `soulmap_splash_seen_v1`. Erster Besuch: 600 vh Scrollweg. Wiederkehr: 260 vh. Bei `prefers-reduced-motion` ist das Intro eine Bildschirmhöhe und zeigt sofort die letzte Phase mit dem Aufruf zur Reise.

---

## 4. Architektur und Backend

**Woraus besteht das System?**  
Eine externe Webseite verlinkt auf das Frontend (React, Vite, Tailwind). Das Frontend spricht per HTTPS und JSON über das Präfix `/api` mit einer FastAPI-REST-API. Die API liest Atlas und `place_i18n`, bewertet das Ritual ohne LLM, ruft für den Chat OpenRouter auf und löst das Land lokal per GeoIP auf. MySQL hält `usage_events` und `app_settings`. `/admin` zeigt Statistik, Modell und Not-Aus hinter einem Login.

**Ist der Chat auf dem Server zustandslos?**  
Ja.

**Wann werden Atlas und Übersetzungen geladen?**  
`places.json` und `place_i18n.json` werden beim Start geladen. Es gibt kein Hot-Reload.

**Was liegt in MySQL?**  
Statistik, Feedback und die zwei Betriebsschalter. Keine Gespräche und kein Ritual.

**Welcher Stack betreibt das Backend?**  
Python 3.12+, FastAPI, Gunicorn und Uvicorn.

**Welches Modul bewertet das Ritual?**  
`match.py`. Es vergibt feste Punkte aus den acht Antworten und ruft kein Sprachmodell auf.

**Welche OpenRouter-Slugs gelten?**  
`gpt-5-mini` ist `openai/gpt-5-mini`. `claude-haiku-5-5` ist `anthropic/claude-haiku-5.5`. Die Basisadresse ist `https://openrouter.ai/api/v1`. Der Schlüssel heißt `OPENROUTER_API_KEY`.

**Was passiert ohne diesen Schlüssel?**  
Derselbe Fallback wie bei einem Ausfall. Es gibt keinen stillen Direktaufruf bei OpenAI.

**Geht der Chat an Langfuse?**  
Nur wenn beide Langfuse-Schlüssel gesetzt sind. Sonst nicht. Langfuse ist Beobachtung, kein zweiter Empfehlungsweg.

**Wofür ist GeoIP da?**  
`geoip2` mit der lokalen MaxMind-GeoLite2-Datenbank ermittelt das Land für die Statistik und den ungefähren Standort für die Karte.

**Wie ist der Admin geschützt?**  
Fester Benutzer `aku`, Passwort als bcrypt-Hash, signiertes Cookie. Modellwechsel und Not-Aus verlangen dieselbe Sitzung.

---

## 5. Datenmodell

**Welche Felder muss ein Atlas-Ort haben?**  
`schemaVersion` (2), `id`, `name`, `country`, `coordinates.lat`, `coordinates.lng`, `element`, `archetyp`, `primaervibration`, `correspondence` und `keywords`. `region` darf fehlen.

**Welche Elementschlüssel sind erlaubt?**  
`earth`, `water`, `fire`, `air` und `aether`.

**Was passiert bei einer doppelten Orts-ID?**  
Der Start schlägt fehl.

**Wie ist `place_i18n.json` aufgebaut?**  
Die obersten Schlüssel sind `de`, `en`, `es` und `ru`. Darunter steht die Atlas-`id`. Eine Zeile kann `name` und weitere Anzeigefelder tragen. Fehlt die Übersetzung, gilt der Name aus `places.json`.

**Wo liegt das Ritual im Browser?**  
`sessionStorage` unter `soulmap.ritual` und `soulmap.language`. Das Ritual gilt nur, wenn `result.matches` und `result.anima_card` vorhanden sind. Die Sprache ist `de`, `en`, `es` oder `ru`.

**Welche Form haben die acht Antworten?**  
`q0` bis `q4` sind Indizes 0–4. `q5` ist ein Index 0–3. `q6` ist Text mit 1–400 Zeichen. `q7` ist Text mit 2–400 Zeichen.

**Was steht in `usage_events`?**  
Anonyme Ereignisse, Löschung nach 6 Monaten. `os_language` ist die primäre Systemsprache, zum Beispiel `de-DE`. Die Arten sind `form_submission`, `result_view`, `affiliate_click`, `rate_limited` und `chat_feedback`.

**Was speichert ein Feedback?**  
`feedback_vote` ist `like` oder `dislike`. `feedback_text` hat höchstens 500 Zeichen und darf leer sein. Dieselbe Zeile trägt IP, Land und Systemsprache. Den Gesprächsverlauf speichert sie nicht.

**Welche Schalter liegen in `app_settings`?**  
`chat_model` mit `gpt-5-mini` oder `claude-haiku-5-5`, Standard `gpt-5-mini`. `chat_halt` mit `on` oder `off`, Standard `off`. Fehlt die Zeile, gilt der Standard.

---

## 6. REST-API

**Unter welchem Pfad spricht das Frontend die API an?**  
JSON-Endpunkte hängen von außen unter `/api`. `/go/…` geht ohne dieses Präfix an die API. Besucher schicken keinen Auth-Header.

**Was schickt `POST /match`?**  
`{ "answers": { q0…q7 }, "language": "de" }`. Zurück kommen `anima_card` und `matches` mit Buchungslink und fertiger Booking-Suche (20 km, `dest_type=latlong`). Es gibt keinen Modellaufruf. Der Not-Aus lässt `/match` in Ruhe.

**Was ist der Vertrag von `POST /chat`?**  
Verlauf und `shown_place_ids` kommen vom Client. `source` ist `llm` oder `fallback`. `ai_disclosure` kennzeichnet die KI. Ist der Not-Aus an, endet der Aufruf sofort mit dem Fallback und `CHAT_HALTED`. Token-Deckel und Tagesbudget greifen dann nicht. Sonst gelten vor dem Modell der Token-Deckel der IP (50.000 Tokens in 30 Tagen, sonst 429 `TOKEN_LIMIT`) und das globale Tagesbudget.

**Was schickt `POST /feedback`?**  
`{ "vote": "like" oder "dislike", "text": "" }`. `text` ist optional und höchstens 500 Zeichen. Ein anderes `vote` ist 422. Die Antwort ist `{ "ok": true }`.

**Wie setzt der Admin das Modell?**  
`POST /admin/model` mit gültiger Sitzung. Ein unbekannter Name wird abgelehnt.

**Wie setzt der Admin den Not-Aus?**  
`POST /admin/halt` mit `{ "halt": true }` oder `{ "halt": false }` und gültiger Sitzung. `true` schreibt `chat_halt=on`. Ein anderer Wert ist 422. `GET /admin/stats` liefert `chat_halt`.

**Was macht `GET /go/{place_id}`?**  
Der Klick wird gezählt. Die Antwort ist ein Redirect 302 auf die Booking-Suche. Der Parameter `lang` wählt die Buchungssprache.

**Gibt es einen Endpunkt für PDF oder Screenshot?**  
Nein.

**Welche Rate-Limits gelten pro IP?**  
`/chat`, `/match` und `/feedback` 20 pro Minute. `/atlas/*`, `/language` und `/geo` 60 pro Minute. `/go/{id}` 30 pro Minute. `/admin/stats`, `/admin/model` und `/admin/halt` 10 pro Minute. `/admin/login` 5 pro Minute.

---

## 7. Chat, Modelle und Not-Aus

**Bekommen beide Modelle dasselbe Schema?**  
Ja. `response_format` ist `json_schema` mit `strict`, alle Felder erforderlich, `additionalProperties` falsch, `provider.require_parameters` wahr. Längengrenzen gehen nicht an den Anbieter. Die prüft danach Pydantic. Eine unbekannte `place_id` führt zum Retry und danach zum Fallback.

**Gibt es einen Unterschied bei Claude?**  
Reasoning ist aus. Sonst ist der Vertrag derselbe. Das Modell hat keine Werkzeuge.

**Was sieht der Admin am Modellnamen?**  
Der aktive Name ist markiert. Ein Punkt ist grün, wenn OpenRouter den Slug listet, rot sonst. Die Prüfung schaltet nichts um.

**Was liefert `/chat`, wenn der Not-Aus an ist?**  
Sofort den bestehenden Fallback: 1–2 Atlas-Orte, fester mehrsprachiger Hinweis, `source` ist `fallback`. OpenRouter wird nicht gerufen, das Tagesbudget wird nicht reserviert, und der Token-Deckel antwortet nicht mit 429. Das Ereignis trägt den Fehlercode `CHAT_HALTED`.

**Was läuft während des Not-Aus weiter?**  
`/match`, Atlas, Karte, Buchung und Feedback.

**Warum gibt es den Schalter neben Rate-Limit und Budget?**  
Rate-Limit, der Token-Deckel je IP und das Tagesbudget begrenzen den einzelnen und den planbaren Verbrauch. Der Not-Aus ist der manuelle Stopp, wenn viele Adressen zusammen Kosten erzeugen oder ein Modell sofort weg muss.

---

## 8. Oberfläche

**Wo sitzt das Feedback?**  
An jeder Assistentenantwort: im Ergebnis-Chat, im Dialog „Mehr erfahren“ und im eigenständigen Chat. Ein Klick öffnet ein Fenster. Die Notiz ist optional. Senden schreibt `POST /feedback`, danach steht ein Dank. Abbrechen speichert nichts. Die Texte folgen der gewählten Sprache.

**Wo sitzt der Sprachschalter?**  
In der Kopfzeile, in der Reihenfolge es, en, de, ru. Intro, Fragen, Ergebnisse, Chat, Rechtstexte, Feedback und Buchungslinks nutzen dieselbe Sprache.

**Warum öffnet die Ergebnisseite oben?**  
Sie setzt beim Öffnen `window.scrollTo(0, 0)`.

**Was ist auf der Ergebnisseite sichtbar?**  
Überschrift, Anima-Karte, Leaflet-Karte, Ortsliste mit Land, QR-Code und Buchungslink, Druckkarte und eingebetteter Chat.

**Wo liegen die Rechtstexte?**  
`/impressum`, `/datenschutz` und `/disclaimer`, in `de`, `en`, `es` und `ru`. Eine juristische Prüfung ist damit nicht ersetzt.

**Was zeigt `/admin` zusätzlich zur Statistik?**  
Den Modellschalter und darunter den Not-Aus. Bei Halt heißt die Schaltfläche „Chat wieder an“ und daneben steht „Chat ist aus“. In den Rohdaten gibt es die Spalten Bewertung und Feedback. Dieselbe Bedienung liegt in der HTML-Ansicht der API. Langfuse erscheint nur, wenn die Schlüssel gesetzt sind.

---

## 9. Sicherheit und Deployment

**Wie ist der Chat gegen Eingriffe abgesichert?**  
Der Systemprompt geht nur als Systemrolle. Der Verlauf ist keine Autorität. Die Ausgabe gilt nur gegen den Atlas. Aus der Modellantwort wird kein HTML erzeugt. Es gibt Längengrenzen und keinen Werkzeugzugriff.

**Kann ein Besucher den Not-Aus setzen?**  
Nein. Schreiben dürfen nur Requests mit gültiger Admin-Sitzung.

**Welche Netzgrenzen gelten?**  
CORS nur auf die eigene Domain. nginx setzt CSP, HSTS, `X-Content-Type-Options` und `Referrer-Policy`. `X-Forwarded-For` gilt nur, wenn der Proxy ihn setzen darf.

**Braucht der Modellwechsel ein Deploy?**  
Nein. Auch der Not-Aus nicht. Beide schreiben nur `app_settings`. Der Schlüssel `OPENROUTER_API_KEY` steht in der Umgebung. `OPENAI_API_KEY` ist für den Chat nicht mehr der Transport.

**Wann startet das Ausrollen?**  
Der Workflow `Build & Deploy` startet bei Push auf `main`, baut API- und Web-Image für `linux/amd64`, schiebt sie nach GHCR und zieht sie per SSH auf dem VPS.

**Unter welcher Adresse läuft die Anwendung?**  
`https://app.mithertz.online`.

---

## 10. Rechtliches

**Ist dieser Abschnitt eine Rechtsberatung?**  
Nein.

**Wie ist die KI gekennzeichnet?**  
Nach AI Act Art. 50 erscheint der KI-Hinweis auf der Ergebnisseite, bevor der Chat genutzt wird. Die Chat-Antwort trägt `ai_disclosure`. Der Text beim Not-Aus ist der feste Fallback, kein Modelltext.

**Welche personenbezogenen Daten sammelt die Statistik?**  
IP, Land, Systemsprache und bei Feedback die selbst geschriebene Notiz. Rechtsgrundlage bleibt das berechtigte Interesse. Die Löschfrist beträgt 6 Monate.

**Welche Teile verlassen das eigene System?**  
Nur der Chat, und nur über OpenRouter an das gerade gewählte Modell, also OpenAI oder Anthropic. Match, Intro und Sprache nicht.

**Was bleibt rechtlich offen?**  
Die Freigabe von Impressum, Datenschutz und Nutzungsbedingungen. Die vollständige Einordnung zum European Accessibility Act. AVV/DPA mit OpenRouter und beiden Modellanbietern einschließlich Drittlandtransfer.

---

## 11. Offene Punkte

**Welche Lücken aus 3.0 sind geschlossen?**  
Der Feedback-Kanal (Eskalation E4) und der Not-Aus für `/chat` ohne neues Deploy (Eskalation E5). Ein Hinweis auf Schieflage in den Empfehlungen kann über dasselbe Feedback ankommen (E10); die Prüfung der Atlas-Texte bleibt eine Entscheidung von Andre.

**Was bleibt offen?**  
Die juristische Prüfung der Rechtstexte. Die vollständige EAA-Einordnung. Der Vertrag mit OpenRouter und den beiden Anbietern. Außerdem die Eskalationen, die diese Fassung nicht anfasst: Playbook für einen stundenlangen Totalausfall, dauerhafte IP-Sperre, Beobachtung externer Modell-Abkündigungen, Alert beim GeoIP-Cron, Monitoring fehlschlagender Booking-Redirects.

**Läuft der Not-Aus schon?**  
Ja, auf dem VPS. `POST /admin/halt` schreibt `chat_halt`. Ist er `on`, antwortet `/chat` sofort mit dem Fallback und ruft OpenRouter nicht auf.

**Welche Fassung beschreibt die Anwendung?**  
Spezifikation 3.1. Sie ersetzt 3.0 als Beschreibung. Die älteren Dokumente bleiben als Vorgänger im Ordner `docs/`.
