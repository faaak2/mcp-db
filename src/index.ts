import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { instructions } from "./instructions.js";

const server = new McpServer(
  { name: "db-mcp", version: "1.0.0" },
  { instructions },
);

const transport = new StdioServerTransport();
await server.connect(transport);
