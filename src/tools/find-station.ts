import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { dbGet } from "../api-client.js";

export function registerFindStation(server: McpServer) {
  server.tool(
    "find_station",
    "Search for a Deutsche Bahn station by name. Returns raw JSON array of matching locations.",
    {
      query: z.string().describe("Station name to search for"),
      results: z
        .number()
        .default(1)
        .describe("Number of results to return (default 1)"),
    },
    async ({ query, results }) => {
      try {
        const data = await dbGet<unknown[]>("/locations", {
          query,
          results: String(results),
        });

        return {
          content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
        };
      } catch (error) {
        return {
          isError: true,
          content: [{ type: "text" as const, text: `find_station failed: ${error instanceof Error ? error.message : String(error)}` }],
        };
      }
    },
  );
}
