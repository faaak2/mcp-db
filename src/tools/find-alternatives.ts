import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { dbGet } from "../api-client.js";

export function registerFindAlternatives(server: McpServer) {
  server.tool(
    "find_alternatives",
    "Find alternative journey connections between two stations. Returns journeys with legs, lines, platforms, stopovers, and remarks.",
    {
      from_id: z.string().describe("Departure station ID (e.g. '8000261' for München Hbf)"),
      to_id: z.string().describe("Arrival station ID (e.g. '8000105' for Frankfurt Hbf)"),
      departure: z.string().describe("ISO departure date/time (e.g. '2026-03-08T14:00')"),
      results: z.number().default(4).describe("Number of journeys to return (default 4)"),
    },
    async ({ from_id, to_id, departure, results }) => {
      const data = await dbGet<unknown>("/journeys", {
        from: from_id,
        to: to_id,
        departure,
        results: String(results),
        stopovers: "true",
        remarks: "true",
      });

      return {
        content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
      };
    },
  );
}
