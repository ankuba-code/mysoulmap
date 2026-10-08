# export Specification

## Purpose

PDF- und Screenshot-Export laufen im Browser. Der Server speichert keine Exportdatei und bietet dafür keinen Endpunkt.

## Requirements

### Requirement: Clientseitiger Export
Das Frontend SHALL einen Screenshot und ein PDF aus dem sichtbaren Gespräch erzeugen. Dafür SHALL es jsPDF und html2canvas verwenden und MUST NOT den Export an die API senden.

#### Scenario: Ergebnis vorhanden
- **WHEN** die Sitzung mindestens eine Assistentenantwort mit empfohlenem Ort enthält
- **THEN** kann die Nutzerin Screenshot und PDF lokal herunterladen

#### Scenario: Noch kein Ergebnis
- **WHEN** noch keine exportierbare Assistentenantwort vorliegt
- **THEN** bleiben die Exportaktionen inaktiv

### Requirement: Lesbarer Export
Der Export SHALL den KI-Hinweis enthalten, wenn er in der Sitzung angezeigt wurde, sowie die empfohlenen Orte. Farben, die der Screenshot nicht direkt zeichnen kann, SHALL vor dem Rendern in eine unterstützte Form gebracht werden.

#### Scenario: Hinweis wurde gezeigt
- **WHEN** `ai_disclosure` in der Sitzung wahr ist und ein PDF erzeugt wird
- **THEN** enthält das PDF den sichtbaren KI-Hinweis
