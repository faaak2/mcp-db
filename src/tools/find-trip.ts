import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { dbGet } from "../api-client.js";

interface Departure {
  tripId?: string;
  line?: { name?: string };
  [key: string]: unknown;
}

interface DeparturesResponse {
  departures?: Departure[];
  [key: string]: unknown;
}

export function registerFindTrip(server: McpServer) {
  server.tool(
    "find_trip",
    "Find a specific train trip by name and station. Fetches all departures for the day, matches the train, then retrieves full trip details with stopovers and remarks.",
    {
      train_name: z.string().describe("Train name to search for (e.g. 'ICE 599')"),
      station_id: z.string().describe("Station ID (e.g. '8000261' for München Hbf)"),
      date: z.string().describe("ISO date string (e.g. '2026-03-08')"),
    },
    async ({ train_name, station_id, date }) => {
      // Step 1: Get all departures for the day
      const data = await dbGet<DeparturesResponse>(
        `/stops/${station_id}/departures`,
        {
          when: `${date}T00:00`,
          duration: "1440",
        },
      );

      const departures: Departure[] = Array.isArray(data) ? data : (data.departures ?? []);

      // Step 2: Filter by line.name (case-insensitive)
      const match = departures.find(
        (d) =>
          d.line?.name?.toLowerCase() === train_name.toLowerCase(),
      );

      if (!match || !match.tripId) {
        const availableNames = [
          ...new Set(
            departures
              .map((d) => d.line?.name)
              .filter((n): n is string => !!n),
          ),
        ];
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                {
                  error: `No departure found matching '${train_name}' at station ${station_id} on ${date}`,
                  available_trains: availableNames,
                },
                null,
                2,
              ),
            },
          ],
        };
      }

      // Step 3: Fetch full trip details
      const encodedTripId = encodeURIComponent(match.tripId);
      const trip = await dbGet<unknown>(`/trips/${encodedTripId}`, {
        stopovers: "true",
        remarks: "true",
      });

      return {
        content: [{ type: "text" as const, text: JSON.stringify(trip, null, 2) }],
      };
    },
  );
}
