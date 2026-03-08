import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { dbGet } from "../api-client.js";

export function registerGetDepartures(server: McpServer) {
  server.tool(
    "get_departures",
    "Get upcoming departures from a Deutsche Bahn station. Returns raw JSON array of departures with line.name, direction, when, delay, platform, remarks.",
    {
      station_id: z.string().describe("Station ID (e.g. '8000261' for München Hbf)"),
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
            content: [{ type: "text" as const, text: `get_departures failed: Invalid station_id '${station_id}'. Expected a numeric HAFAS ID (e.g. '8000261' for München Hbf). Use find_station to look up the correct ID.` }],
          };
        }

        const params: Record<string, string> = {
          duration: String(duration),
        };
        if (when) {
          params.when = when;
        }

        const data = await dbGet<unknown>(
          `/stops/${station_id}/departures`,
          params,
        );

        const departures = Array.isArray(data)
          ? data
          : (data as Record<string, unknown>).departures ?? data;

        return {
          content: [{ type: "text" as const, text: JSON.stringify(departures, null, 2) }],
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
