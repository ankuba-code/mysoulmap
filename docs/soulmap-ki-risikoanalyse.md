# Soulmap — Risikoanalyse KI-Funktionen (final)

**Datum:** 16.09.2026 · **Status:** final
**Scope:** Ausschließlich die KI-gestützten Funktionen von Soulmap — der `/chat`-Endpunkt (OpenAI-API-Anbindung) und die deterministische Fallback-Empfehlungslogik. Allgemeine Web-Sicherheitsrisiken ohne KI-Bezug (z. B. reines DDoS auf `/atlas`, Server-Härtung) sind bereits in `soulmap-softwarespezifikation.md` Abschnitt 6/7 behandelt und hier nicht erneut aufgeführt, außer wo sie KI-spezifisch verschärft sind.
**Basis:** `soulmap-softwarespezifikation.md`, Version 2.9 — jede Gegenmaßnahme unten verweist auf den jeweiligen Abschnitt.
**Hinweis:** Diese Analyse ersetzt keine Rechtsberatung und keine formale DSFA/AI-Act-Konformitätsbewertung durch fachkundige Dritte — sie ist eine technische Grundlage dafür.

---

## 1. Methodik

Jedes Risiko wird bewertet nach:
- **Wahrscheinlichkeit** (W): niedrig / mittel / hoch — ohne Gegenmaßnahmen
- **Auswirkung** (A): niedrig / mittel / hoch
- **Risikostufe vor Gegenmaßnahmen** = Kombination aus W × A
- **Restrisiko nach Gegenmaßnahmen** — die tatsächlich relevante Größe für die Entscheidung, ob weitere Maßnahmen nötig sind

| Risikostufe | Bedeutung |
|---|---|
| 🔴 Hoch | erfordert zwingend Gegenmaßnahme vor Go-Live |
| 🟡 Mittel | Gegenmaßnahme empfohlen, vertretbar mit Monitoring |
| 🟢 Niedrig | akzeptables Restrisiko im Regelbetrieb |

---

## 2. Risikokatalog

### R1 — Halluzination / Empfehlung außerhalb der 40 Atlas-Orte

| | |
|---|---|
| Beschreibung | Das Modell empfiehlt einen Ort, Fakt oder eine Eigenschaft, die nicht im kuratierten Atlas existiert oder falsch ist (klassisches LLM-Halluzinationsrisiko) |
| W (vor Maßnahmen) | Hoch — inhärentes LLM-Verhalten |
| A | Mittel — Kernversprechen des Produkts ("nur diese 40 Orte") wird gebrochen, Vertrauensverlust |
| Gegenmaßnahmen | Structured Outputs mit festem JSON-Schema statt Freitext-Parsing; serverseitige Scope-Validierung jeder `place_id` gegen `places.json` unabhängig vom Modell-Output; bei Verstoß Retry mit verschärftem Prompt-Hinweis, danach Fallback (Spec 5.2, 5.9) |
| Restrisiko | 🟢 Niedrig — die Validierung ist ein technischer Backstop, der unabhängig vom Modellverhalten greift, nicht nur ein Prompt-Hinweis |

### R2 — Prompt Injection (Regel-Umgehung, Systemprompt-Exfiltration)

| | |
|---|---|
| Beschreibung | Nutzer:innen versuchen, über geschickt formulierte Eingaben (oder gefälschte `assistant`-Turns im client-gelieferten Verlauf) die Scope-Regel zu umgehen oder den Systemprompt offenzulegen |
| W (vor Maßnahmen) | Hoch — öffentlich erreichbarer, unauthentifizierter Endpunkt |
| A | Mittel — Reputationsschaden, ggf. Wettbewerbsvorteil/Missbrauch, kein direkter Systemzugriff möglich (kein Tool-Zugriff des Modells) |
| Gegenmaßnahmen | Strikte Rollentrennung über API-Struktur (nicht String-Konkatenation); client-gelieferter Verlauf gilt nur als Anzeige, nie als Autorität; Output-Scope-Validierung als Backstop unabhängig vom Verlauf; explizites Exfiltrationsverbot im Systemprompt; Input-Längengrenzen; kein Tool-/Code-Zugriff des Modells (Spec 5.5) |
| Restrisiko | 🟢 Niedrig — mehrschichtige Verteidigung, kein Einzelpunkt-Versagen; ein erfolgreicher Injection-Versuch kann höchstens zu einer unerwünschten Textantwort führen, nicht zu Systemkompromittierung |

### R3 — Nichtverfügbarkeit/Fehler der OpenAI API

| | |
|---|---|
| Beschreibung | OpenAI-API ist nicht erreichbar, antwortet mit Timeout/5xx, oder liefert eine nicht valide strukturierte Antwort |
| W (vor Maßnahmen) | Mittel — externe Abhängigkeit, seltene aber nicht auszuschließende Ausfälle |
| A | Hoch ohne Gegenmaßnahme (Kernfunktion komplett ausgefallen) |
| Gegenmaßnahmen | 20 s Timeout, ein Retry bei transienten Fehlern, danach **deterministische Fallback-Empfehlungslogik ohne jede externe Abhängigkeit** (Spec 5.9) — Nutzer:in bekommt immer eine funktionierende Antwort |
| Restrisiko | 🟢 Niedrig — einziges verbleibendes Risiko ist reduzierte Empfehlungsqualität im Fallback-Fall (siehe R4), nicht Totalausfall |

### R4 — Qualitätsverlust durch Fallback-Empfehlung

| | |
|---|---|
| Beschreibung | Die Fallback-Logik (Keyword-Matching) versteht Nuancen, Verneinungen und Mehrdeutigkeiten deutlich schlechter als das LLM — Nutzer:innen könnten eine unpassende Empfehlung erhalten, ohne zu wissen, dass gerade der Fallback aktiv war |
| W (vor Maßnahmen) | Niedrig-Mittel — abhängig von der tatsächlichen OpenAI-Verfügbarkeit, laut Erfahrungswerten meist < 1 % der Requests |
| A | Niedrig-Mittel — einzelne enttäuschte Nutzer:in, kein Systemschaden |
| Gegenmaßnahmen | `source: "fallback"`-Flag in der Response ermöglicht dem Frontend einen transparenten Hinweis ("KI gerade nicht erreichbar, hier eine Empfehlung basierend auf deiner Anfrage") statt die Herkunft zu verschleiern (Spec 5.2); Fallback-Rate wird im Statistik-Dashboard separat sichtbar gemacht, um Häufung frühzeitig zu erkennen (Spec 5.6) |
| Restrisiko | 🟢 Niedrig — akzeptierter, bewusst dokumentierter Kompromiss zwischen Verfügbarkeit und Empfehlungsqualität (Spec 5.9) |

### R5 — Kostenmissbrauch durch automatisierte Massenanfragen an `/chat`

| | |
|---|---|
| Beschreibung | Jeder `/chat`-Call verursacht OpenAI-API-Kosten; ohne Schutz könnten Bots/Scraper durch massenhafte Anfragen hohe, ungeplante Kosten verursachen — KI-spezifisch verschärft gegenüber rein lesenden Endpunkten, da hier echte Grenzkosten pro Request entstehen |
| W (vor Maßnahmen) | Mittel-Hoch — öffentlich, unauthentifiziert, bekanntes Missbrauchsmuster bei LLM-gestützten Public-APIs |
| A | Mittel — finanzieller Schaden, kein Datenverlust |
| Gegenmaßnahmen | IP-basiertes Rate-Limiting speziell für `/chat` (20/min, strengster Wert aller Endpunkte, siehe Spec 6); Input-Längengrenzen begrenzen zusätzlich die Tokenkosten pro Request; LLM-Monitoring im Dashboard macht Kostenanomalien sichtbar (Spec 5.6) |
| Restrisiko | 🟡 Mittel — Rate-Limiting bremst, verhindert aber keine verteilten Angriffe über viele IPs; sollte nach Go-Live anhand echter Nutzungszahlen nachjustiert werden (siehe Entscheidungsprotokoll, Spec 10) |

### R6 — Datenschutz: Übermittlung von Konversationsinhalten an OpenAI (Drittland)

| | |
|---|---|
| Beschreibung | Jede Chat-Nachricht wird zur Verarbeitung an die OpenAI API übermittelt, ggf. mit Verarbeitung außerhalb der EU |
| W (vor Maßnahmen) | Hoch — struktureller Bestandteil jeder LLM-Integration |
| A | Mittel — DSGVO-relevant, aber keine Speicherung auf Soulmap-Seite, keine besonderen Kategorien personenbezogener Daten strukturell vorgesehen |
| Gegenmaßnahmen | Auftragsverarbeitungsvertrag (AVV/DPA) mit OpenAI, Prüfung der Drittlandtransfer-Grundlage (SCC/EU-US Data Privacy Framework); keine Speicherung von Konversationsinhalten auf Soulmap-Seite (zustandsloser `/chat`); Nennung in der Datenschutzerklärung (Spec 8) |
| Restrisiko | 🟡 Mittel — abhängig davon, dass der AVV tatsächlich vor Go-Live abgeschlossen wird (siehe offener Aktionspunkt, Spec 12); technisch bereits minimiert durch fehlende Persistenz |

### R7 — Unzureichende KI-Kennzeichnung (EU AI Act Art. 50)

| | |
|---|---|
| Beschreibung | Nutzer:innen wird nicht klar/deutlich genug offengelegt, dass sie mit einem KI-System interagieren bzw. dass Texte KI-generiert sind |
| W (vor Maßnahmen) | Mittel — abhängig von der konkreten UI-Umsetzung, die außerhalb dieser Spezifikation liegt (Spec 1.4) |
| A | Hoch — direkter Gesetzesverstoß mit Bußgeldrisiko ab 2. August 2026 |
| Gegenmaßnahmen | `ai_disclosure`-Flag zwingt zu einem sichtbaren Hinweis beim ersten Request jeder Sitzung (Spec 5.2, 8); Platzhalterfeld für künftige maschinenlesbare Kennzeichnung vorgesehen |
| Restrisiko | 🟡 Mittel — die **technische Grundlage** ist gelegt, das tatsächliche Restrisiko hängt von der UI-Umsetzung ab, die noch nicht erfolgt ist; vor Go-Live visuell verifizieren (Spec 12) |

### R8 — XSS über gerenderte Modellantwort im Frontend

| | |
|---|---|
| Beschreibung | Falls die Modellantwort ungefiltert als HTML gerendert wird, könnte (auch ohne erfolgreiche Prompt Injection, rein durch Formatierungswünsche oder einen Grenzfall) Schadcode im Browser der Nutzer:in ausgeführt werden |
| W (vor Maßnahmen) | Niedrig-Mittel — erfordert eine konkrete Implementierungslücke im Frontend |
| A | Hoch — klassisches XSS-Risiko, Session-/Datenabgriff im Browser der Nutzer:in |
| Gegenmaßnahmen | Verbot von `dangerouslySetInnerHTML` mit rohem Modelltext; falls Markdown gewünscht, ausschließlich über sanitisierende Bibliothek ohne Raw-HTML-Unterstützung (Spec 5.5, Punkt 8) |
| Restrisiko | 🟢 Niedrig, **vorausgesetzt die Implementierung hält sich an diese Vorgabe** — reine Spezifikationsvorgabe, noch nicht durch Code verifiziert; Code-Review-Punkt vor Go-Live |

### R9 — Bias/Fairness in Empfehlungen

| | |
|---|---|
| Beschreibung | Das Modell (oder die Fallback-Logik) könnte bestimmte Orte, Kulturen oder Regionen systematisch bevorzugen oder unpassend/klischeehaft charakterisieren |
| W (vor Maßnahmen) | Niedrig-Mittel — durch den engen, kuratierten Scope (nur 40 redaktionell festgelegte Orte) strukturell begrenzter als bei offenen Empfehlungssystemen |
| A | Niedrig-Mittel — Reputationsrisiko, kein struktureller Schaden |
| Gegenmaßnahmen | Der geschlossene 40-Orte-Atlas begrenzt die Angriffs-/Fehlerfläche strukturell; redaktionelle Verantwortung für Beschreibungstexte liegt bei der Atlas-Pflege (Spec 4.1), nicht beim Modell selbst |
| Restrisiko | 🟢 Niedrig — kein spezifischer weiterer technischer Mechanismus vorgesehen; falls gewünscht, könnte eine redaktionelle Stichprobenprüfung der generierten Beschreibungstexte ergänzt werden (aktuell nicht Teil der Spezifikation) |

### R10 — Abhängigkeit von einem einzelnen Modellanbieter (Vendor-Lock-in, Modell-Drift)

| | |
|---|---|
| Beschreibung | Soulmap ist strukturell an die OpenAI API gebunden; ein Modellwechsel, eine Preisänderung oder eine Verhaltensänderung bei einem Modell-Update könnte Antwortqualität oder Kosten beeinflussen, ohne dass Soulmap das kontrolliert |
| W (vor Maßnahmen) | Mittel — normales Risiko bei jeder Einzel-Anbieter-LLM-Integration |
| A | Niedrig-Mittel — kein Totalausfall (Fallback greift, siehe R3), aber ggf. spürbare Qualitäts-/Kostenveränderung |
| Gegenmaßnahmen | Fallback-Logik (R3) fängt harte Ausfälle ab; LLM-Monitoring im Dashboard (Latenz, Fehlerquote, siehe Spec 5.6) macht schleichende Verschlechterung früh sichtbar |
| Restrisiko | 🟡 Mittel — strukturelles Risiko jeder Einzelanbieter-Integration, nicht vollständig eliminierbar ohne Multi-Provider-Architektur (aktuell nicht vorgesehen, wäre eine deutlich größere Architekturänderung) |

### R11 — Haftungsrisiko für inhaltlich falsche KI-Aussagen

| | |
|---|---|
| Beschreibung | Falls das Modell (trotz Scope-Validierung) falsche Detailaussagen über einen an sich validen Atlas-Ort trifft (z. B. falsche Öffnungszeiten, falsche geografische Angaben), könnte das als fehlerhafte Auskunft gewertet werden |
| W (vor Maßnahmen) | Niedrig-Mittel — die Scope-Validierung prüft nur, *dass* ein genannter Ort im Atlas existiert, nicht *jedes Detail* der Modellantwort |
| A | Niedrig-Mittel — Reiseempfehlung, kein sicherheitskritischer Kontext, aber potenziell enttäuschte Nutzer:innen |
| Gegenmaßnahmen | Kein spezifischer technischer Mechanismus über die Scope-Validierung hinaus vorgesehen; typischerweise durch einen allgemeinen Haftungsausschluss in den Nutzungsbedingungen abgefedert |
| Restrisiko | 🟡 Mittel — **offener Punkt:** Ein Haftungsausschluss/Disclaimer ("unverbindliche Empfehlung, keine Gewähr für Detailangaben") ist bisher an keiner Stelle dieser Spezifikation vorgesehen — siehe Empfehlung unten |

---

## 3. Zusammenfassung

| Risiko | Restrisiko |
|---|---|
| R1 Halluzination/Scope-Verstoß | 🟢 Niedrig |
| R2 Prompt Injection | 🟢 Niedrig |
| R3 OpenAI-API-Ausfall | 🟢 Niedrig |
| R4 Fallback-Qualitätsverlust | 🟢 Niedrig |
| R5 Kostenmissbrauch | 🟡 Mittel |
| R6 Datenübermittlung an OpenAI | 🟡 Mittel (bis AVV abgeschlossen) |
| R7 KI-Kennzeichnung | 🟡 Mittel (bis UI-Umsetzung verifiziert) |
| R8 XSS über Modellantwort | 🟢 Niedrig (bei Einhaltung der Vorgabe) |
| R9 Bias/Fairness | 🟢 Niedrig |
| R10 Vendor-Lock-in/Modell-Drift | 🟡 Mittel |
| R11 Haftung für Falschaussagen | 🟡 Mittel |

**Gesamteinschätzung:** Kein Risiko in dieser Analyse erreicht die Stufe 🔴 Hoch im Restrisiko — die in der Spezifikation bereits verankerten Mechanismen (Scope-Validierung, Prompt-Injection-Schutz, Fallback-Logik, Rate-Limiting) greifen ineinander und reduzieren die technischen Kernrisiken (R1–R4) auf ein niedriges Niveau. Die verbleibenden 🟡-Mittel-Einstufungen sind überwiegend **keine technischen Lücken, sondern offene organisatorische Schritte** (AVV abschließen, UI-Umsetzung verifizieren, Rate-Limits nachjustieren) — das deckt sich mit den bereits in Spec Abschnitt 12 dokumentierten Aktionspunkten.

**Neu identifizierter, bisher nicht dokumentierter Punkt:** R11 (Haftungsausschluss für KI-Aussagen) taucht in der bisherigen Spezifikation nirgends auf — ich empfehle, einen kurzen Disclaimer in die Datenschutzerklärung/Nutzungsbedingungen aufzunehmen (z. B. „Empfehlungen sind unverbindlich, Detailangaben ohne Gewähr"). Das wäre als Ergänzung zu Abschnitt 12 der Hauptspezifikation sinnvoll.

---

## 4. Einflüsse & mögliche Schäden im Detail

Wer/was kann durch die KI-Funktion beeinträchtigt werden — unabhängig von der Risikostufe, als vollständige Wirkungsübersicht:

**Auf Nutzer:innen:**
- Enttäuschung/Vertrauensverlust durch eine spürbar schlechtere Fallback-Antwort, ohne zu erkennen, dass gerade nicht das eigentliche KI-System geantwortet hat (R4)
- Fehlgeleitete Reiseentscheidung durch eine inhaltlich falsche Detailaussage zu einem an sich validen Atlas-Ort (R11)
- Browserseitiger Schaden im XSS-Fall (R8) — theoretisch bis hin zu Datenabgriff im eigenen Browser
- Keine direkte Rückmeldemöglichkeit bei unangemessenem oder falschem KI-Output (siehe Lücke in Abschnitt 6 unten)

**Auf den Betreiber (Andre):**
- Finanzieller Schaden durch Kostenmissbrauch (R5) — unmittelbar bei OpenAI-API-Gebühren
- Bußgeldrisiko bei unzureichender KI-Kennzeichnung (R7, EU AI Act Art. 50) oder unzureichender Datenschutz-Dokumentation (R6)
- Reputationsschaden durch sichtbare Scope-Verstöße, erfolgreiche Prompt-Injection-Vorführungen (z. B. öffentlich geteilte Screenshots) oder wahrgenommenen Bias (R2, R9)
- Betriebsunterbrechung bei anhaltendem OpenAI-Ausfall über den reinen Einzelrequest-Fallback hinaus (R3, siehe Eskalationsfall E6 unten)

**Auf Dritte (OpenAI, Booking.com):**
- OpenAI: Missbrauch der API für Zwecke außerhalb der Nutzungsbedingungen, falls Prompt-Injection-Schutz umgangen wird (R2) — vertragliches Risiko für Soulmap als Kunde, nicht nur technisches
- Booking.com: Reputationsrisiko für Booking.com, falls die Werbekennzeichnung fehlt oder Partner-Richtlinien verletzt werden (nicht direkt KI-bezogen, aber am selben `/go/`-Pfad hängend, siehe Spec 5.8)

**Regulatorisch/rechtlich:**
- Verstoß gegen EU AI Act Art. 50 (R7)
- Verstoß gegen DSGVO bei fehlendem/unvollständigem AVV (R6)
- Mögliche Haftungsansprüche aus Falschauskünften (R11)

---

## 5. Gegenmaßnahmen im Überblick

Konsolidierte Sicht auf das, was **bereits implementiert bzw. spezifiziert** ist (Details/Fundstellen siehe Abschnitt 2):

| Schadenskategorie | Implementierte Gegenmaßnahme | Fundstelle |
|---|---|---|
| Scope-Verstoß/Halluzination | Structured Outputs + serverseitige Validierung gegen `places.json`, Retry mit verschärftem Prompt | Spec 5.2 |
| Prompt Injection | Rollentrennung, Verlauf ohne Autorität, Output-Backstop, Exfiltrationsverbot, Input-Grenzen, kein Tool-Zugriff | Spec 5.5 |
| API-Ausfall | Timeout, ein Retry, deterministischer Fallback ohne externe Abhängigkeit | Spec 5.9 |
| Fallback-Transparenz | `source`-Flag in der Response, getrennte Fallback-Rate im Dashboard | Spec 5.2, 5.6 |
| Kostenmissbrauch | IP-Rate-Limiting speziell für `/chat` (striktester Wert), Input-Längengrenzen | Spec 6 |
| Datenübermittlung an OpenAI | Keine Persistenz auf Soulmap-Seite, AVV geplant, Drittlandtransfer-Prüfung | Spec 8, 12 |
| KI-Kennzeichnung | `ai_disclosure`-Flag erzwingt sichtbaren Hinweis | Spec 5.2, 8 |
| XSS über Modellantwort | Verbot von Raw-HTML-Rendering, sanitisierte Markdown-Bibliothek vorgeschrieben | Spec 5.5 |
| Bias/Fairness | Struktureller Scope-Deckel (nur 40 redaktionelle Orte) | Spec 4.1 |
| Vendor-Lock-in/Modell-Drift | LLM-Monitoring (Latenz, Fehlerquote) im Dashboard | Spec 5.6 |

**Bewusst NICHT implementiert (Lücken, siehe Abschnitt 6):** kein Nutzer-Feedback-/Meldemechanismus für unangemessenen KI-Output, kein manueller "Not-Aus" für `/chat`, kein automatisiertes IP-Sperren bei wiederholten Injection-Versuchen (nur Rate-Limiting).

---

## 6. Eskalationskatalog — wann ist Human-in-the-Loop nötig?

Automatisierte Gegenmaßnahmen (Abschnitt 5) lösen die meisten Einzelfälle selbst. Es gibt jedoch Situationen, in denen die Automatik zwar den unmittelbaren Schaden begrenzt, aber eine **menschliche Entscheidung** (i. d. R. Andre) zusätzlich nötig ist. Status **„vorhanden"** heißt: der Auslöse-Mechanismus ist bereits spezifiziert; **„Lücke"** heißt: aktuell nicht in der Spezifikation vorgesehen.

| # | Eskalationsfall | Auslöser | Erforderliche menschliche Aktion | Status                                                                                                                                     |
|---|---|---|---|--------------------------------------------------------------------------------------------------------------------------------------------|
| E1 | Fehlerquote/Fallback-Rate über Schwellenwert | `/health`-Alert bzw. Fehlerquote > 5 % über 15 Min. (Spec 7) | Prüfen, ob OpenAI-seitiger Vorfall vorliegt; ggf. Hinweisbanner im Frontend aktivieren | ✅ Vorhanden (Alert), Reaktion liegt bei Andre                                                                                              |
| E2 | Anhaltender OpenAI-Totalausfall (Stunden, nicht nur Einzelrequests) | Wiederholte `llm_status='fallback'`-Häufung über Stunden | Entscheidung: Nutzer:innen aktiv informieren, dass aktuell nur Fallback-Empfehlungen laufen | 🔶 Lücke — kein expliziter Schwellenwert/Playbook für „andauernder" vs. „einzelner" Ausfall definiert                                      |
| E3 | Wiederholte Prompt-Injection-Versuche von derselben IP | Muster in Logs (z. B. mehrere `OUT_OF_SCOPE_PLACE`/Injection-Marker kurz hintereinander) | Entscheidung: IP dauerhaft sperren (über Rate-Limiting hinaus) | 🔶 Lücke — aktuell nur zeitlich begrenztes Rate-Limiting, keine IP-Sperrliste/manuelle Sperrfunktion vorgesehen                            |
| E4 | Nutzer:in meldet unangemessenen/falschen KI-Output | — | Inhalt prüfen, ggf. Systemprompt nachschärfen | 🔶 Lücke — **kein Feedback-/Melde-Mechanismus im Frontend vorgesehen**; aktuell kein Kanal, über den so etwas überhaupt bei Andre ankommt |
| E5 | Kostenexplosion trotz Rate-Limiting (verteilter Angriff über viele IPs) | OpenAI-Rechnungsbetrag/Tokenverbrauch weicht stark vom erwarteten Muster ab | Temporäre Drosselung/Abschaltung von `/chat` | 🔶 Lücke — **kein "Not-Aus"-Schalter** für `/chat` spezifiziert (nur Redeploy/manueller Server-Eingriff möglich)                           |
| E6 | OpenAI kündigt Modell-Deprecation oder Breaking Change an | externe Ankündigung (OpenAI-Changelog/E-Mail) | Systemprompt/Modellversion prüfen und ggf. anpassen, bevor das alte Modell abgeschaltet wird | 🔶 Lücke — kein Monitoring externer OpenAI-Ankündigungen vorgesehen, rein organisatorisch zu lösen                                      |
| E7 | Anfrage einer Aufsichtsbehörde (Datenschutz oder AI Act) | extern | Rechtliche Prüfung, Auskunft erteilen | ✅ Grundlage vorhanden (AVV, Datenschutzerklärung, Nicht-Hochrisiko-Dokumentation, Spec 8, 10)                                              |
| E8 | GeoIP-Datenbank-Update schlägt fehl (Cron bricht ab) | stiller Fehler, keine automatische Meldung vorgesehen | Cron-Fehler beheben, Statistikgenauigkeit prüfen | 🔶 Lücke — kein Alert bei fehlgeschlagenem `geoipupdate`-Cronjob spezifiziert (nur der Cronjob selbst, Spec 7)                             |
| E9 | Booking.com sperrt/ändert die Affiliate-ID | Redirects über `/go/` schlagen plötzlich fehl | Neue Affiliate-ID im Partner Hub klären, Secret aktualisieren | 🔶 Lücke — kein spezifisches Monitoring für fehlschlagende `/go/`-Redirects (nur allgemeine Fehlerquote)                                   |
| E10 | Systematischer Bias-/Fairness-Verdacht in Nutzer-Feedback oder Presse | extern/Beobachtung | Atlas-Beschreibungstexte redaktionell prüfen | 🔶 Lücke — hängt an E4 (Feedback-Kanal fehlt), damit ein solcher Verdacht überhaupt strukturiert ankommt                                   |

**Zusammenfassung:** Zwei der zehn Eskalationsfälle (E1, E7) sind durch bereits spezifizierte Mechanismen abgedeckt — die Automatik erkennt das Ereignis und ein Mensch reagiert darauf. Die übrigen acht sind **organisatorische Lücken, keine technischen Fehler** der bisherigen Spezifikation: Es fehlt durchgängig ein Weg, wie ein Ereignis überhaupt zuverlässig bei Andre ankommt (Feedback-Kanal, IP-Sperrfunktion, Not-Aus-Schalter, Redirect-Fehlerquote, externes OpenAI-Monitoring). Die wichtigsten davon für Go-Live: **E4** (Feedback-Kanal, da E10 davon abhängt) und **E5** (Not-Aus für `/chat`, da dies der einzige Fall mit potenziell unbegrenztem finanziellen Schaden ist).

---

*Ende der Risikoanalyse.*
