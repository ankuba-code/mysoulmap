# compliance Specification

## Purpose

Die Anwendung bleibt anonym, kennzeichnet KI-Ausgaben und begrenzt die einzige personenbezogene Speicherung auf die Nutzungsstatistik. Diese Spec beschreibt Anforderungen an das Produkt, keine Rechtsberatung.

## Requirements

### Requirement: KI-Hinweis
Das Frontend SHALL beim ersten erfolgreichen Chat einer Sitzung einen gut sichtbaren Hinweis zeigen, dass die Nutzerin mit einer KI interagiert. Die Antwort SHALL dafür `ai_disclosure` setzen. Der Hinweis MUST NOT nur in AGB stehen.

#### Scenario: Erste Antwort der Sitzung
- **WHEN** die erste Chat-Antwort eintrifft und `ai_disclosure` wahr ist
- **THEN** zeigt die Oberfläche den KI-Hinweis sichtbar über dem Gespräch

### Requirement: Keine Konversationsspeicherung
Das System MUST NOT Konversationstext, Nutzerkonten oder ein Endnutzer-Login speichern. Die Übermittlung an OpenAI SHALL auf den zur Antwort nötigen Verlauf begrenzt sein.

#### Scenario: Chat-Anfrage
- **WHEN** eine Chat-Anfrage verarbeitet wird
- **THEN** wird der Nachrichtentext nicht in MySQL geschrieben

### Requirement: Statistik als berechtigtes Interesse
IP-Adresse und Ländercode in `usage_events` SHALL nur für Betrieb, Missbrauchsschutz und technisches Monitoring verwendet werden. Die Speicherung SHALL nach 6 Monaten enden. Eine Datenschutzerklärung SHALL Zweck, Rechtsgrundlage, Dauer, das Fehlen weiterer Konversationsdaten und die Weitergabe an OpenAI sowie Booking.com beim Affiliate-Klick benennen.

#### Scenario: Ablauf der Frist
- **WHEN** ein Ereignis älter als 6 Monate ist
- **THEN** wird es gelöscht und steht im Dashboard nicht mehr zur Verfügung

### Requirement: Anbieterkennzeichnung
Vor einem öffentlichen Betrieb SHALL ein Impressum erreichbar sein. Affiliate-Links SHALL als kommerzielle Kommunikation gekennzeichnet sein.

#### Scenario: Öffentliche Seite
- **WHEN** die Anwendung öffentlich erreichbar ist
- **THEN** ist ein Impressum vorhanden und Booking-Links sind als Anzeige markiert
