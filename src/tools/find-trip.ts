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

const PRODUCT_PREFIXES: Record<string, string[]> = {
  nationalExpress: ["ICE", "TGV", "RJ", "RJX", "ECE"],
  national: ["IC", "EC", "EN", "NJ", "FLX"],
  regionalExpress: ["RE", "IRE", "MEX", "FEX"],
  regional: ["RB", "RS"],
  suburban: ["S"],
};

function getProductFilters(trainName: string): Record<string, string> {
  const prefix = trainName.replace(/\s+/g, "").replace(/\d+$/, "").toUpperCase();

  for (const [product, prefixes] of Object.entries(PRODUCT_PREFIXES)) {
    if (prefixes.includes(prefix)) {
      const filters: Record<string, string> = {};
      for (const key of Object.keys(PRODUCT_PREFIXES)) {
        filters[key] = key === product ? "true" : "false";
      }
      // Also disable non-rail products
      filters.bus = "false";
      filters.ferry = "false";
      filters.subway = "false";
      filters.tram = "false";
      filters.taxi = "false";
      return filters;
    }
  }

  // Unknown prefix — don't filter
  return {};
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
      try {
        if (!/^\d{6,9}$/.test(station_id)) {
          return {
            isError: true,
            content: [{ type: "text" as const, text: `find_trip failed: Invalid station_id '${station_id}'. Expected a numeric HAFAS ID (e.g. '8000261' for München Hbf). Use find_station to look up the correct ID.` }],
          };
        }

        // Step 1: Get all departures for the day, filtered by product type
        const productFilters = getProductFilters(train_name);
        const data = await dbGet<DeparturesResponse>(
          `/stops/${station_id}/departures`,
          {
            when: `${date}T00:00`,
            duration: "1440",
            ...productFilters,
          },
        );

        const departures: Departure[] = Array.isArray(data) ? data : (data.departures ?? []);

        // Step 2: Filter by line.name (case-insensitive, whitespace-normalized)
        const normalize = (s: string) => s.toLowerCase().replace(/\s+/g, "");
        const match = departures.find(
          (d) =>
            d.line?.name != null &&
            normalize(d.line.name) === normalize(train_name),
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
      } catch (error) {
        return {
          isError: true,
          content: [{ type: "text" as const, text: `find_trip failed: ${error instanceof Error ? error.message : String(error)}` }],
        };
      }
    },
  );
}
