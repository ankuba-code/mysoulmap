# compliance Specification

## Purpose

Die Anwendung bleibt anonym, kennzeichnet KI-Ausgaben und begrenzt die einzige personenbezogene Speicherung auf die Nutzungsstatistik. Diese Spec beschreibt Anforderungen an das Produkt, keine Rechtsberatung.

## Requirements

### Requirement: KI-Hinweis
Das Frontend SHALL beim ersten erfolgreichen Chat einer Sitzung einen gut sichtbaren Hinweis zeigen, dass die Nutzerin mit einer KI interagiert. Die Antwort SHALL dafür `ai_disclosure` setzen. Der Hinweis MUST NOT nur in AGB stehen.

#### Scenario: Erste Antwort der Sitzung
- **WHEN** die erste Chat-Antwort eintrifft und `ai_disclosure` wahr ist
- **THEN** zeigt die Oberfläche den KI-Hinweis sichtbar über dem Gespräch

### Requirement: Begrenzte Prompt-Speicherung
Das System MUST NOT Nutzerkonten oder ein Endnutzer-Login speichern. Der vollständige Verlauf bleibt beim Client. Die Übermittlung an OpenAI SHALL auf den zur Antwort nötigen Verlauf begrenzt sein. In `usage_events` SHALL beim `result_view` nur die letzte Nutzernachricht stehen, gekürzt auf 500 Zeichen. Assistentenantworten und der übrige Verlauf MUST NOT gespeichert werden.

#### Scenario: Chat-Anfrage
- **WHEN** eine Chat-Anfrage verarbeitet wird
- **THEN** schreibt MySQL höchstens die gekürzte letzte Nutzernachricht und nicht den vollständigen Verlauf

### Requirement: Statistik als berechtigtes Interesse
IP-Adresse, Ländercode und der gekürzte Prompt-Auszug in `usage_events` SHALL nur für Betrieb, Missbrauchsschutz, das Token-Limit und den internen Monatsreport verwendet werden. Die Speicherung SHALL nach 6 Monaten enden. Eine Datenschutzerklärung SHALL Zweck, Rechtsgrundlage, Dauer, diese begrenzte Speicherung und die Weitergabe an OpenAI sowie Booking.com beim Affiliate-Klick benennen.

#### Scenario: Ablauf der Frist
- **WHEN** ein Ereignis älter als 6 Monate ist
- **THEN** wird es gelöscht und steht im Dashboard nicht mehr zur Verfügung

### Requirement: Anbieterkennzeichnung
Vor einem öffentlichen Betrieb SHALL ein Impressum erreichbar sein. Affiliate-Links SHALL als kommerzielle Kommunikation gekennzeichnet sein.

#### Scenario: Öffentliche Seite
- **WHEN** die Anwendung öffentlich erreichbar ist
- **THEN** ist ein Impressum vorhanden und Booking-Links sind als Anzeige markiert
