# security Specification

## Purpose

Öffentliche Endpunkte bleiben anonym. Schutz besteht aus Rate-Limits, CORS, Prompt-Injection-Grenzen und Header-Härtung. Statistikzugriff ist davon getrennt und liegt in der Capability `stats`.

## Requirements

### Requirement: Rate-Limits pro IP
Das System SHALL Anfragen pro IP begrenzen: `/chat` 20 pro Minute, Atlas-Lesezugriff 60 pro Minute, `/go/{place_id}` 30 pro Minute, `/admin/stats` 10 pro Minute und `/admin/login` 5 pro Minute.

#### Scenario: Chat-Limit erreicht
- **WHEN** dieselbe IP innerhalb einer Minute mehr als 20 Chat-Anfragen sendet
- **THEN** wird die weitere Anfrage abgewiesen

### Requirement: CORS und weitergeleitete IP
CORS SHALL nur die eigene Domain erlauben. `X-Forwarded-For` SHALL nur akzeptiert werden, wenn nginx den Header setzt. Die Anwendung SHALL Security-Header für Content-Type, Referrer und Transport setzen.

#### Scenario: Fremde Origin
- **WHEN** ein Browser von einer fremden Origin eine API-Anfrage stellt
- **THEN** erlaubt CORS diese Origin nicht

### Requirement: Prompt-Injection-Grenzen
Der Server SHALL Modellantworten unabhängig vom Clientverlauf gegen den Atlas prüfen. Client-Nachrichten SHALL nur Anzeigeverlauf sein. Das Frontend MUST NOT Modellantworten als rohes HTML einsetzen.

#### Scenario: Manipulierter Verlauf
- **WHEN** eine Assistenten-Nachricht im Verlauf behauptet, ein Ort außerhalb des Atlas sei erlaubt
- **THEN** bleibt die serverseitige Prüfung auf die Atlas-IDs beschränkt
