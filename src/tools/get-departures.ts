import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { client } from "../api-client.js";
import { slimDepartures, compact } from "../slim.js";

export function registerGetDepartures(server: McpServer) {
  server.tool(
    "get_departures",
    "Get upcoming departures from an RMV station. Returns raw JSON array of departures with line.name, direction, when, delay, platform, remarks.",
    {
      station_id: z.string().describe("Station ID (e.g. '3000010' for Frankfurt Hbf)"),
      when: z
        .string()
        .optional()
        .describe("ISO 8601 datetime string (optional, defaults to now)"),
      duration: z
        .number()
        .default(60)
        .describe("Duration in minutes to query (default 60)"),
    },
    async ({ station_id, when, duration }) => {
      try {
        if (!/^\d{6,9}$/.test(station_id)) {
          return {
            isError: true,
            content: [{ type: "text" as const, text: `get_departures failed: Invalid station_id '${station_id}'. Expected a numeric HAFAS ID (e.g. '3000010' for Frankfurt Hbf). Use find_station to look up the correct ID.` }],
          };
        }

        const opt: Record<string, unknown> = { duration };
        if (when) opt.when = new Date(when);

        const res = await client.departures(station_id, opt);

        const slim = slimDepartures((res.departures ?? []) as Record<string, unknown>[]);
        return {
          content: [{ type: "text" as const, text: compact(slim) }],
        };
      } catch (error) {
        return {
          isError: true,
          content: [{ type: "text" as const, text: `get_departures failed: ${error instanceof Error ? error.message : String(error)}` }],
        };
      }
    },
  );
}
