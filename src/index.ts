import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { instructions } from "./instructions.js";
import { registerFindStation } from "./tools/find-station.js";

const server = new McpServer(
  { name: "db-mcp", version: "1.0.0" },
  { instructions },
);

registerFindStation(server);

const transport = new StdioServerTransport();
await server.connect(transport);
