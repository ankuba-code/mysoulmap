# frontend Specification

## Purpose

Die Oberfläche ist eine React-Anwendung mit Vite und Tailwind CSS. Sie hält den Gesprächsverlauf im Client und enthält das Admin-Dashboard.

## Requirements

### Requirement: Öffentliche Anwendung
Das Frontend SHALL mit React 18, Vite und Tailwind CSS gebaut werden. Die produktive Auslieferung SHALL nur das gebaute Bundle sein. Eine externe Webseite SHALL Soulmap verlinken und MUST NOT die Anwendung per iframe einbetten.

#### Scenario: Production-Build
- **WHEN** die Pipeline `vite build` ausführt
- **THEN** entsteht ein statisches Bundle, das nginx ausliefert

### Requirement: Gespräch im Client
Der Client SHALL Nachrichten, gezeigte Ort-IDs und den KI-Hinweis im Speicher der Sitzung halten und bei jeder Anfrage den vollständigen Verlauf senden. Sprachen SHALL Deutsch, Englisch, Spanisch und Russisch sein.

#### Scenario: Neue Nutzernachricht
- **WHEN** die Nutzerin eine Nachricht sendet
- **THEN** schickt der Client den bisherigen Verlauf, die neue Nachricht und `shown_place_ids` an `/chat`

### Requirement: Admin-Oberfläche
Die Route `/admin` SHALL Login und die Statistikdiagramme mit recharts bereitstellen. Die Seite SHALL nicht aus der öffentlichen Navigation verlinkt sein.

#### Scenario: Erfolgreicher Login
- **WHEN** `aku` das gültige Passwort eingibt
- **THEN** zeigt das Dashboard die aggregierten Kennzahlen
