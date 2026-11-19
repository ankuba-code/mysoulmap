# stats Specification

## Purpose

MySQL speichert anonyme Nutzungsereignisse und die gekürzte letzte Nutzernachricht. Das Dashboard zeigt Aggregationen, den LLM-Status und den Monatsreport.

## Requirements

### Requirement: Nutzungsereignisse
Das System SHALL `form_submission`, `result_view` und `affiliate_click` in `usage_events` schreiben. Gespeichert SHALL die IP, der daraus abgeleitete Ländercode, die primäre Betriebssystem- oder Browsersprache und bei Klicks die `place_id` werden. `result_view` aus dem Chat SHALL zusätzlich die letzte Nutzernachricht, gekürzt auf 500 Zeichen, in `user_prompt` führen. Der übrige Verlauf MUST NOT gespeichert werden. `result_view` SHALL `llm_status` als `success`, `error` oder `fallback` führen.

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
`/admin` SHALL einen Login mit dem festen Benutzer `aku` und einem bcrypt-gehashten Passwort verlangen. Die Session SHALL per Cookie höchstens 12 Stunden gelten. Das Dashboard SHALL Zeitreihe, Herkunft, beliebte Orte, Fallback-Nutzung, den Monatsreport, Seaborn-Grafiken und einen zusätzlich geschützten Rohdatenmodus anzeigen. Die Grafiken SHALL eine Weltkarte der Länderzentren, den Tagesverlauf, das Themen-Ranking und den Tokenverbrauch zeigen. Der Monatsreport SHALL pro Kalendermonat und IP die Token-Summe gegen das Limit von 50.000, die Spanne vom ersten bis zum letzten Ereignis, ein Themen-Ranking der Prompt-Auszüge und Hinweise auf auffällige Nutzung zeigen. Diese Hinweise MUST NOT als Bot-Urteil dargestellt werden. Der Rohdatenmodus SHALL den Prompt-Auszug enthalten.

#### Scenario: Fehlendes Login
- **WHEN** eine Anfrage an `/admin/stats` ohne gültige Session kommt
- **THEN** werden die Kennzahlen nicht ausgeliefert

### Requirement: GeoIP
Der Ländercode SHALL lokal mit MaxMind GeoLite2 aus der IP abgeleitet werden. Die IP SHALL dafür nicht an einen weiteren Geolokalisierungsdienst gesendet werden.

#### Scenario: Auflösbare IP
- **WHEN** ein Ereignis geschrieben wird und die GeoIP-Datenbank die IP kennt
- **THEN** enthält `country_code` den zweistelligen Ländercode

### Requirement: Post-Monitoring
Das System SHALL jeden Chat-Turn als `result_view` schreiben, auch ohne empfohlenen Ort. Rate-Limit-Antworten SHALL als `rate_limited` gespeichert werden. `GET /health` SHALL 503 liefern, wenn die Datenbank nicht erreichbar ist oder kein Atlas-Ort geladen ist. `GET /health/signals` SHALL mit `MONITOR_TOKEN` die letzten 15 Minuten prüfen und `degraded` melden, wenn bei mindestens 3 Chat-Turns die Fehler- oder Fallback-Rate über 5 % liegt oder mindestens 50 Rate-Limits anfielen. Ein separater Wächterprozess SHALL diese Prüfungen ausführen und bei anhaltendem Ausfall eine E-Mail an `ALERT_EMAIL` senden. Konversationstext MUST NOT in der Mail stehen.

#### Scenario: Fallback-Häufung
- **WHEN** in 15 Minuten mindestens 3 Chat-Turns liegen und die Fallback-Rate über 5 % liegt
- **THEN** ist das Signal `degraded` mit Grund `fallback_rate`
