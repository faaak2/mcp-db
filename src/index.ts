import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { instructions } from "./instructions.js";
import { registerFindStation } from "./tools/find-station.js";
import { registerGetDepartures } from "./tools/get-departures.js";
import { registerFindTrip } from "./tools/find-trip.js";
import { registerFindAlternatives } from "./tools/find-alternatives.js";

const server = new McpServer(
  { name: "db-mcp", version: "1.0.0" },
  { instructions },
);

registerFindStation(server);
registerGetDepartures(server);
registerFindTrip(server);
registerFindAlternatives(server);

const transport = new StdioServerTransport();
await server.connect(transport);
