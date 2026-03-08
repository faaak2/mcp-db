import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { instructions } from "./instructions.js";
import { registerFindStation } from "./tools/find-station.js";
import { registerGetDepartures } from "./tools/get-departures.js";
import { registerFindTrip } from "./tools/find-trip.js";
import { registerFindJourneys } from "./tools/find-journeys.js";

const server = new McpServer(
  { name: "db-mcp", version: "1.0.0" },
  { instructions },
);

registerFindStation(server);
registerGetDepartures(server);
registerFindTrip(server);
registerFindJourneys(server);

const transport = new StdioServerTransport();
await server.connect(transport);
