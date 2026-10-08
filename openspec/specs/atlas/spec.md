# atlas Specification

## Purpose

Der Atlas ist die einzige Quelle der 40 kuratierten Orte. Er wird aus `places.json` gelesen, beim Start validiert und nicht über die API verändert.

## Requirements

### Requirement: Atlasdatei beim Start laden
Das System SHALL `places.json` beim Serverstart einlesen, gegen Schema v2 validieren und im Speicher halten. Bei fehlender Datei, ungültigem JSON, fehlenden Pflichtfeldern oder doppelten `id`-Werten SHALL der Start fehlschlagen.

#### Scenario: Gültige Datei
- **WHEN** der Server mit einer gültigen `places.json` startet
- **THEN** alle Orte stehen im Speicher bereit

#### Scenario: Ungültiges Schema
- **WHEN** ein Pflichtfeld fehlt oder eine `id` doppelt vorkommt
- **THEN** startet der Server nicht

### Requirement: Atlas nur lesen
Das System SHALL Orte über `GET /atlas/places` und `GET /atlas/places/{id}` ausliefern. Filter SHALL `element`, `archetyp` und `keyword` unterstützen. Es SHALL keinen Schreibzugriff auf den Atlas geben.

#### Scenario: Unbekannte ID
- **WHEN** ein Client eine unbekannte `place_id` abruft
- **THEN** antwortet die API mit 404 und dem Fehlercode `PLACE_NOT_FOUND`

### Requirement: Pflichtfelder
Jeder Ort SHALL `schemaVersion` 2, `id`, `name`, `country`, `coordinates.lat`, `coordinates.lng`, `element`, `archetyp`, `primaervibration`, `correspondence` und `keywords` enthalten. `region` SHALL optional und nullbar sein. `id` SHALL höchstens 20 Zeichen lang sein.

#### Scenario: Optionale Region
- **WHEN** ein Ort kein `region`-Feld hat
- **THEN** gilt die Region als leer und der Ort bleibt gültig
