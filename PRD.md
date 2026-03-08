# DB MCP Server — Implementation Plan

## Context
Build a Deutsche Bahn MCP Server from scratch. The server relays real-time train data from `https://v6.db.transport.rest` through 4 tools. No business logic — Claude handles all intelligence. The server delivers a system prompt via the MCP `instructions` field.

## Project Structure
```
DB-MCP/
  package.json
  tsconfig.json
  src/
    index.ts              # McpServer setup, tool registration, stdio transport
    instructions.ts       # System prompt string
    api-client.ts         # HTTP client for v6.db.transport.rest
    tools/
      find-station.ts
      get-departures.ts
      find-trip.ts
      find-alternatives.ts
```

## Dependencies
- `@modelcontextprotocol/sdk`, `zod` (runtime)
- `typescript`, `@types/node` (dev)
- Built-in `fetch` (Node 18+) — no HTTP library needed

---

## Step 1: Project Scaffolding + Empty MCP Server
**Create:** `package.json`, `tsconfig.json`, `src/index.ts`
- `package.json`: `type: "module"`, scripts for `build` (tsc) and `start` (node build/index.js)
- `tsconfig.json`: target ES2022, module Node16, strict, outDir `./build`
- `src/index.ts`: Minimal McpServer with name/version, StdioServerTransport, connect

**Test:** `npm install && npm run build` compiles. Pipe an `initialize` JSON-RPC message to `node build/index.js` → get valid response with `serverInfo.name === "db-mcp"`.

---

## Step 2: System Prompt via `instructions`
**Create:** `src/instructions.ts` — export the system prompt from the requirements doc
**Modify:** `src/index.ts` — pass `instructions` to McpServer constructor

**Test:** Pipe `initialize` request → verify `result.instructions` contains the prompt text.

---

## Step 3: API Client Module
**Create:** `src/api-client.ts` — `dbGet<T>(path, params?)` using `fetch`, base URL, error handling with response body in error messages

**Test:** Quick script: `npx tsx -e "import {dbGet} from './src/api-client.js'; dbGet('/locations', {query:'Berlin',results:'1'}).then(console.log)"` → returns location with id and name.

---

## Step 4: `find_station` Tool
**Create:** `src/tools/find-station.ts` — `GET /locations?query={query}&results={n}`, returns raw JSON
**Modify:** `src/index.ts` — register tool

**Input:** `query: string`, `results: number (default 1)`
**Output:** Raw JSON array of locations

**Test:** Call tool with `{"query":"München Hbf","results":1}` → response contains station id `"8000261"`.

---

## Step 5: `get_departures` Tool
**Create:** `src/tools/get-departures.ts` — `GET /stops/{station_id}/departures?when={iso}&duration={min}`
**Modify:** `src/index.ts` — register tool

**Input:** `station_id: string`, `when: string (optional)`, `duration: number (default 60)`
**Output:** Raw JSON array of departures with `line.name`, `direction`, `when`, `delay`, `platform`, `remarks`

**Test:** Call with `{"station_id":"8000261"}` → returns departure array.

---

## Step 6: `find_trip` Tool (Two-Step)
**Create:** `src/tools/find-trip.ts`
**Modify:** `src/index.ts` — register tool

**Input:** `train_name: string`, `station_id: string`, `date: string (ISO date)`
**Logic:**
1. `GET /stops/{station_id}/departures?when={date}T00:00&duration=1440`
2. Filter by `line.name` matching `train_name` (case-insensitive)
3. Extract `tripId`, URL-encode it
4. `GET /trips/{encodedTripId}?stopovers=true&remarks=true`
5. Return full trip JSON

**Error cases:** No matching departure → return available line names as hint.

**Test:** Call with a known train (e.g. ICE 599, station_id for München) → response has `stopovers[]` with all required fields (arrival, departure, delay, platform, cancelled, remarks).

---

## Step 7: `find_alternatives` Tool
**Create:** `src/tools/find-alternatives.ts` — `GET /journeys?from={id}&to={id}&departure={iso}&results={n}&stopovers=true&remarks=true`
**Modify:** `src/index.ts` — register tool

**Input:** `from_id: string`, `to_id: string`, `departure: string (ISO)`, `results: number (default 4)`
**Output:** Raw JSON with `journeys[]` containing `legs[]` with all required fields

**Test:** Call with München→Frankfurt → returns journeys with legs containing line, platform, remarks.

---

## Step 8: Error Handling
**Modify:** All 4 tool files + `api-client.ts`
- Wrap each tool handler in try/catch → return `isError: true` with descriptive message
- `api-client.ts`: Include response body in error messages

**Test:** Call with invalid station_id `"999999999"` → get `isError: true` response, server doesn't crash. Call with malformed date → graceful error.

---

## Step 9: End-to-End Test with Claude
**Create:** Claude Desktop/Code MCP config pointing to `build/index.js`

**Test scenarios:**
1. "Wann fährt der ICE 599 heute?" → find_station + find_trip
2. "Alternativen von München nach Frankfurt ab 14 Uhr" → find_station × 2 + find_alternatives
3. "Abfahrten Berlin Hbf" → find_station + get_departures

---

## Testing Strategy
- **Primary:** Live API testing against `v6.db.transport.rest` (public, free, no auth)
- **Method:** Pipe JSON-RPC messages to built server OR use MCP Inspector (`npx @modelcontextprotocol/inspector`)
- **No unit tests for MVP** — 4-tool relay server with zero business logic, live tests have higher ROI
