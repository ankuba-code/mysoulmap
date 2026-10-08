# affiliate Specification

## Purpose

Unterkunftssuche läuft über Booking.com. Links werden serverseitig erzeugt, Klicks laufen über die eigene Domain und sind als Werbung gekennzeichnet.

## Requirements

### Requirement: Redirect nur für Atlas-Orte
`GET /go/{place_id}` SHALL die ID gegen den Atlas prüfen, einen `affiliate_click` schreiben und mit Status 302 auf eine Booking.com-Suche nach Name und Land weiterleiten. Unbekannte IDs SHALL 404 liefern und MUST NOT weiterleiten.

#### Scenario: Gültiger Ort
- **WHEN** ein Client `/go/mp` aufruft und `mp` im Atlas existiert
- **THEN** antwortet der Server mit 302 auf die Booking.com-Suche für diesen Ort

#### Scenario: Unbekannter Ort
- **WHEN** die `place_id` nicht im Atlas steht
- **THEN** gibt es keine Weiterleitung und der Status ist 404

### Requirement: Werbekennzeichnung
Jeder Affiliate-Link im Frontend SHALL als Anzeige erkennbar sein und `rel="sponsored"` tragen. `booking_link` in der Chat-Antwort SHALL ein relativer Pfad `/go/{id}` auf der eigenen Domain sein.

#### Scenario: Empfohlener Ort
- **WHEN** die Chat-Antwort einen empfohlenen Ort enthält
- **THEN** zeigt die Oberfläche den Namen, die Kennzeichnung „Anzeige“ und einen Link auf `/go/{id}`
