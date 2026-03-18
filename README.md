# rmv-mcp

A [Model Context Protocol](https://modelcontextprotocol.io) server providing real-time RMV (Rhein-Main-Verkehrsverbund) travel data — departures, journeys, trip details, and station search.

## Quick Start

### Local (stdio)

```bash
git clone <repo-url> && cd mcp-rmv
npm install && npm run build
```

Then add to your client config:

```json
{
  "mcpServers": {
    "rmv-mcp": {
      "command": "node",
      "args": ["/absolute/path/to/mcp-rmv/build/index.js"]
    }
  }
}
```

## Tools

### `find_station`

Search for an RMV station by name.

| Parameter | Type   | Required | Description                   |
|-----------|--------|----------|-------------------------------|
| `query`   | string | yes      | Station name to search for    |
| `results` | number | no       | Number of results (default 1) |

### `get_departures`

Get upcoming departures from a station.

| Parameter    | Type   | Required | Description                                      |
|--------------|--------|----------|--------------------------------------------------|
| `station_id` | string | yes      | Station ID (e.g. `3000010` for Frankfurt Hbf)    |
| `when`       | string | no       | ISO 8601 datetime (defaults to now)              |
| `duration`   | number | no       | Duration in minutes to query (default 60)        |

### `find_trip`

Get full trip details for a specific train/line, including all stopovers and remarks.

| Parameter    | Type   | Required | Description                                      |
|--------------|--------|----------|--------------------------------------------------|
| `train_name` | string | yes      | Train/line name (e.g. `S3`, `RE 30`, `U4`)      |
| `station_id` | string | yes      | Station ID (e.g. `3000010` for Frankfurt Hbf)    |
| `date`       | string | yes      | ISO date (e.g. `2026-03-08`)                     |

### `find_journeys`

Find journey connections between two stations.

| Parameter   | Type   | Required | Description                                      |
|-------------|--------|----------|--------------------------------------------------|
| `from_id`   | string | yes      | Departure station ID                             |
| `to_id`     | string | yes      | Arrival station ID                               |
| `departure` | string | yes      | ISO datetime (e.g. `2026-03-08T14:00`)           |
| `results`   | number | no       | Number of journeys to return (default 4)         |

## Server Instructions

The server includes built-in instructions that guide the LLM to:

- Always show actual (not planned) times, platforms, and line info
- Warn about platform changes
- Flag replacement bus services
- Inform about passenger rights when delays exceed 60 minutes
- Check reachable intermediate stops when suggesting alternatives

## Transport Modes

The server auto-selects its transport based on the `PORT` environment variable:

| `PORT` set?  | Transport        | Use case              |
|--------------|------------------|-----------------------|
| Yes          | Streamable HTTP  | Remote / hosted       |
| No           | stdio            | Local via MCP client  |

## Development

```bash
npm install
npm run build
npm run serve     # starts HTTP on port 3000
```

## License

MIT
