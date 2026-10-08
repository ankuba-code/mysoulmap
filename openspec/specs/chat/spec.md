# chat Specification

## Purpose

`POST /chat` empfiehlt Atlas-Orte zustandslos. Der Client hält den Verlauf. Bei Ausfall oder ungültiger Modellantwort greift eine deterministische Fallback-Empfehlung.

## Requirements

### Requirement: Zustandsloser Chat
Das System SHALL den vollständigen Verlauf, `shown_place_ids` und die Sprache (`de`, `en`, `es`, `ru`) vom Client entgegennehmen und keine Konversation speichern. Die Antwort SHALL `message`, `shown_place_ids`, `recommended_places`, `source` und `ai_disclosure` enthalten.

#### Scenario: Folgefrage
- **WHEN** der Client den bisherigen Verlauf und bereits gezeigte Ort-IDs sendet
- **THEN** speichert der Server diesen Verlauf nicht und empfiehlt nur neu genannte Atlas-Orte

### Requirement: Nur Atlas-Orte
Das System SHALL ausschließlich `place_id`-Werte aus `places.json` akzeptieren. Unbekannte IDs aus der Modellantwort SHALL einen erneuten Versuch mit verschärftem Prompt auslösen und danach den Fallback.

#### Scenario: Ort außerhalb des Atlas
- **WHEN** das Modell eine unbekannte `place_id` liefert und der Retry ebenfalls ungültig ist
- **THEN** ist `source` `fallback` und jede empfohlene ID gehört zum Atlas

### Requirement: Strukturierte Modellantwort
Das System SHALL das Modell `gpt-5-mini` mit Structured Outputs aufrufen. Der Systemprompt SHALL als Systemnachricht gesetzt werden und MUST NOT aus dem Clientverlauf zusammengesetzt werden. Das Modell SHALL keine Tools haben und MUST NOT den Systemprompt preisgeben.

#### Scenario: Timeout
- **WHEN** die OpenAI-Anfrage das Timeout überschreitet oder die Antwort nicht dem Schema entspricht
- **THEN** liefert der Server eine Fallback-Antwort statt eines leeren Fehlers

### Requirement: Deterministischer Fallback
Der Fallback SHALL die aktuelle Nutzereingabe gegen `keywords`, `element`, `archetyp` und `correspondence` der noch nicht gezeigten Orte bewerten und 1 bis 2 Orte liefern. Bei Score 0 SHALL eine zufällige Auswahl aus den verbleibenden Orten erfolgen. Der Hinweistext SHALL fest und mehrsprachig sein, nicht modellgeneriert.

#### Scenario: Kein Schlüsselwort-Treffer
- **WHEN** kein Ort einen positiven Score hat und noch Orte übrig sind
- **THEN** enthält die Antwort 1 bis 2 Atlas-Orte und `source` ist `fallback`

### Requirement: Eingabegrenzen
Eine Nachricht SHALL höchstens 4000 Zeichen haben, der Verlauf höchstens 20 Nachrichten, und es SHALL mindestens eine Nutzernachricht geben. Die Rolle `system` vom Client SHALL abgelehnt werden.

#### Scenario: Zu langer Verlauf
- **WHEN** der Client mehr als 20 Nachrichten sendet
- **THEN** antwortet die API mit 422 und dem Fehlercode `VALIDATION_ERROR`
