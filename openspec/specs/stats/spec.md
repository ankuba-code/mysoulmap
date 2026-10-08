# stats Specification

## Purpose

MySQL speichert nur anonyme Nutzungsereignisse. Das Dashboard zeigt Aggregationen und den LLM-Status. Konversationen werden nicht gespeichert.

## Requirements

### Requirement: Nutzungsereignisse
Das System SHALL `form_submission`, `result_view` und `affiliate_click` in `usage_events` schreiben. Gespeichert SHALL die IP, der daraus abgeleitete Ländercode und bei Klicks die `place_id` werden. Konversationstext MUST NOT gespeichert werden. `result_view` SHALL `llm_status` als `success`, `error` oder `fallback` führen.

#### Scenario: Erfolgreiche Modellantwort
- **WHEN** `/chat` eine gültige Modellantwort mit Ort liefert
- **THEN** entsteht ein `result_view` mit `llm_status` `success` und den Token- und Latenzwerten

#### Scenario: Affiliate-Klick
- **WHEN** ein gültiger Aufruf von `/go/{place_id}` erfolgt
- **THEN** entsteht ein `affiliate_click` mit dieser `place_id`

### Requirement: Aufbewahrung
Ereignisse SHALL 6 Monate nach `occurred_at` automatisch gelöscht werden. Der Löschlauf SHALL regelmäßig und ohne manuelles Eingreifen laufen.

#### Scenario: Ereignis älter als 6 Monate
- **WHEN** der Löschlauf ein Ereignis findet, dessen `occurred_at` länger als 6 Monate zurückliegt
- **THEN** wird dieses Ereignis gelöscht

### Requirement: Admin-Dashboard
`/admin` SHALL einen Login mit dem festen Benutzer `aku` und einem bcrypt-gehashten Passwort verlangen. Die Session SHALL per Cookie höchstens 12 Stunden gelten. Das Dashboard SHALL Zeitreihe, Herkunft, beliebte Orte, Fallback-Nutzung und einen zusätzlich geschützten Rohdatenmodus anzeigen.

#### Scenario: Fehlendes Login
- **WHEN** eine Anfrage an `/admin/stats` ohne gültige Session kommt
- **THEN** werden die Kennzahlen nicht ausgeliefert

### Requirement: GeoIP
Der Ländercode SHALL lokal mit MaxMind GeoLite2 aus der IP abgeleitet werden. Die IP SHALL dafür nicht an einen weiteren Geolokalisierungsdienst gesendet werden.

#### Scenario: Auflösbare IP
- **WHEN** ein Ereignis geschrieben wird und die GeoIP-Datenbank die IP kennt
- **THEN** enthält `country_code` den zweistelligen Ländercode
