# DB MCP Server — Anforderungen & API-Felder

## Architekturprinzip

**Claude** übernimmt alle Intelligenz: Ticket-Parsing, Situationsanalyse, Entscheidungslogik.  
**Der MCP Server** liefert ausschließlich saubere, zuverlässige Daten — keine eigene Logik.

---

## API Basis

```
Base URL: https://v6.db.transport.rest
```

| Tool | Endpoint |
|------|----------|
| `find_station` | `GET /locations?query={query}&results={n}` |
| `find_trip` | `GET /stops/{station_id}/departures` → `tripId` → `GET /trips/{tripId}?stopovers=true&remarks=true` |
| `find_connections` | `GET /journeys?from={id}&to={id}&departure={iso}&results={n}&stopovers=true&remarks=true` |
| `get_departures` | `GET /stops/{station_id}/departures?when={iso}&duration={min}` |

**Hinweis `find_trip`:** Die API hat keinen direkten Zugnummer-Endpoint. Ablauf:
1. `/stops/{station_id}/departures` abfragen und nach `line.name` filtern → `tripId` extrahieren
2. Mit `tripId` den vollständigen Trip laden: `/trips/{tripId}?stopovers=true&remarks=true`
3. `tripId` muss URL-encoded werden (`encodeURIComponent`) da sie Sonderzeichen enthält

---

## Tools

### 1. `find_trip`
Zugnummer + Datum → Trip-ID + alle Stopovers mit Echtzeit-Daten.

**Input:**
```
train_name   string   z.B. "ICE 225", "RE3 33823"
date         string   ISO-Datum, z.B. "2026-03-07"
```

**Output pro Stopover:**
```
stop.id                  string   HAFAS-Bahnhof-ID
stop.name                string   Klartextname
plannedArrival           ISO      Geplante Ankunft
arrival                  ISO      Tatsächliche Ankunft (null = noch nicht eingetroffen)
arrivalDelay             int      Verspätung Ankunft in Sekunden
plannedDeparture         ISO      Geplante Abfahrt
departure                ISO      Tatsächliche Abfahrt (null = noch nicht abgefahren)
departureDelay           int      Verspätung Abfahrt in Sekunden
arrivalPlatform          string   Aktuelles Gleis Ankunft
plannedArrivalPlatform   string   Geplantes Gleis Ankunft
departurePlatform        string   Aktuelles Gleis Abfahrt
plannedDeparturePlatform string   Geplantes Gleis Abfahrt
cancelled                bool     Halt ausgefallen
remarks[]                array    Störungen, Hinweise (siehe Remarks)
```

**Kritische Logik für Claude:**
- "Noch vor mir" = `departure` (tatsächlich) > jetzt ODER `departure` ist null
- Niemals `plannedDeparture` für diese Bestimmung verwenden
- Gleiswechsel = `platform != plannedPlatform` → explizit warnen

---

### 2. `find_alternatives`
Von Bahnhof X, ab Uhrzeit Y → Verbindungen nach Ziel Z.

**Input:**
```
from_id      string   HAFAS-Bahnhof-ID
to_id        string   HAFAS-Bahnhof-ID
departure    ISO      Frühestmögliche Abfahrt (tatsächliche Ankunft im Zug!)
results      int      Anzahl Ergebnisse (default: 4)
```

**Output pro Journey → pro Leg:**
```
line.name                string   z.B. "RE3", "Bus RE5"
line.product             string   "nationalExpress" | "regional" | "bus" etc.
origin.name              string   Startbahnhof des Legs
destination.name         string   Zielbahnhof des Legs
departure                ISO      Tatsächliche Abfahrt
plannedDeparture         ISO      Geplante Abfahrt
departureDelay           int      Verspätung in Sekunden
arrival                  ISO      Tatsächliche Ankunft
departurePlatform        string   Aktuelles Abfahrtsgleis ← PFLICHTFELD in Antwort
plannedDeparturePlatform string   Geplantes Gleis
remarks[]                array    Störungen, Bauarbeiten, SEV-Hinweise
```

**Kritische Logik für Claude:**
- `departure`-Zeit für `from_id` = tatsächliche Ankunft im aktuellen Zug (mit Verspätung!)
- Gleis immer ausgeben, Gleiswechsel explizit markieren
- `remarks` auf `type: "warning"` und `"status"` prüfen → dem Nutzer zeigen

---

### 3. `get_departures`
Alle Abfahrten eines Bahnhofs — für Echtzeit-Gleis-Check direkt vor Abfahrt.

**Input:**
```
station_id   string   HAFAS-Bahnhof-ID
when         ISO      Ab wann (default: jetzt)
duration     int      Zeitfenster in Minuten (default: 60)
```

**Output pro Abfahrt:**
```
line.name                string
direction                string
plannedWhen              ISO
when                     ISO      Tatsächliche Abfahrt
delay                    int      Sekunden
platform                 string   ← Aktuelles Gleis
plannedPlatform          string
remarks[]                array
```

---

### 4. `find_station`
Bahnhofname → HAFAS-ID. Wird von Claude aufgerufen wenn Nutzer einen Klartextnamen nennt.

**Input:**
```
query        string   z.B. "Ulm Hbf", "Friedrichshafen"
results      int      default: 1
```

**Output:**
```
id           string   HAFAS-ID
name         string   Normierter Name
```

---

## Remarks — Typen & Bedeutung

| `type`    | Bedeutung | Beispiel |
|-----------|-----------|---------|
| `warning` | Aktive Störung | "Medical emergency", "Gleissperrung" |
| `status`  | Bauarbeiten / Dauerinfo | "Bauarbeiten 06. März – 08. Juni" |
| `warning` + `replacement service` | Schienenersatzverkehr | Bus statt Zug |
| `hint`    | Service-Info | WLAN, Fahrrad, Bordrestaurant |

**Regel:** `warning` und `status` mit `summary` + `text` immer an Claude übergeben. `hint` optional.

---

## Kernregel: Tatsächliche vs. geplante Zeiten

```
find_trip      → stopovers[n].departure        (tatsächlich, nicht planned)
find_alternatives → departure-Parameter        = stopovers[n].arrival (tatsächlich)
get_departures → when                          = stopovers[n].departure (tatsächlich)
```

Wenn `arrival` / `departure` = `null`:  
→ Zug noch nicht eingetroffen / abgefahren  
→ `plannedArrival` / `plannedDeparture` + Delay-Wert als Schätzung verwenden  
→ In Antwort an Nutzer als Schätzung kennzeichnen

---

## Pflichtfelder in jeder Antwort an den Nutzer

Jede Verbindungsempfehlung von Claude **muss** enthalten:

1. Abfahrtszeit (tatsächlich, mit Verspätungshinweis falls > 0)
2. **Gleis** (aktuell) + Warnung bei Gleiswechsel
3. Linie + Richtung
4. Umstiegsbahnhof(e)
5. Ankunftszeit Ziel
6. Aktive Störungshinweise (`remarks` vom Typ `warning` / `status`)

---

## System Prompt — Auslieferung via `instructions`

Der Prompt wird über die `instructions`-Property im MCP-Initialisierungs-Response übertragen — der einzige Kanal der garantiert beim LLM ankommt, unabhängig vom Client (Claude, ChatGPT, etc.).

```javascript
server.setRequestHandler(InitializeRequestSchema, async () => ({
  protocolVersion: "2024-11-05",
  capabilities: { tools: {} },
  serverInfo: { name: "db-reise-assistant", version: "1.0.0" },
  instructions: `... siehe Prompt unten ...`
}));
```

**Inhalt:**

```
Du bist ein Reiseassistent für Bahnreisen in Deutschland.
Du hast Zugriff auf Echtzeit-Daten der Deutschen Bahn über einen MCP Server.

ZEITBERECHNUNG
- Verwende für alle Berechnungen ("Liegt dieser Halt noch vor mir?") ausschließlich
  die tatsächlichen Zeiten (departure/arrival), niemals die geplanten.
- Wenn departure/arrival = null: Schätzung aus plannedDeparture + departureDelay verwenden
  und als Schätzung kennzeichnen.

PFLICHTANGABEN BEI JEDER VERBINDUNGSAUSKUNFT
- Abfahrtszeit (tatsächlich)
- Gleis (aktuell) — immer angeben, nie weglassen
- Linie und Richtung
- Umstiegsbahnhöfe
- Ankunftszeit am Ziel
- Aktive Störungshinweise (remarks vom Typ warning/status)

GLEISWECHSEL
- Wenn departurePlatform != plannedDeparturePlatform: explizit warnen.
- Beispiel: "⚠️ Gleiswechsel! Abfahrt jetzt Gleis 4 (geplant: Gleis 7)"

SCHIENENERSATZVERKEHR
- Wenn remarks einen Eintrag mit summary "replacement service" enthält:
  Nutzer darauf hinweisen dass es sich um einen Ersatzbus handelt und
  Bauarbeiten-Zeitraum aus dem status-Remark nennen.

FAHRGASTRECHTE — 60-MINUTEN-REGEL
- Wenn arrivalDelay oder departureDelay >= 3600 Sekunden (60 Minuten):
  Folgenden Hinweis ausgeben:
  "⚖️ Fahrgastrechte: Bei dieser Verspätung hast du Anspruch auf 25% Erstattung
  des Ticketpreises. Ab 120 Minuten sind es 50%. Erstattung über bahn.de/fahrgastrechte
  oder direkt am Serviceschalter."

ALTERNATIVE VERBINDUNGEN
- Immer alle noch erreichbaren Zwischenhalte des aktuellen Zuges prüfen,
  nicht nur den Endbahnhof.
- departure-Parameter für find_alternatives = tatsächliche Ankunft am jeweiligen
  Halt (mit Verspätung), nicht die geplante Zeit.
```

---

## Identifizierter Fehlerfall aus der Analyse

| Fehler | Ursache | Lösung |
|--------|---------|--------|
| Mannheim übersehen | Filter auf geplante statt tatsächliche Zeiten | Immer `departure` (actual) mit `now` vergleichen |
| Gleis nicht ausgegeben | Feld nicht aus API extrahiert | `departurePlatform` Pflichtfeld |
| Nicht alle Stopps abgefragt | Manuelle Auswahl | Systematisch alle Stopps mit `departure > now` |
| Verspätung nicht eingerechnet | `departure`-Parameter zu früh gesetzt | `from`-Zeit = tatsächliche Ankunft inkl. Delay |
| SEV nicht erkannt | `remarks` ignoriert | `replacement service` Warning → Nutzer warnen |
