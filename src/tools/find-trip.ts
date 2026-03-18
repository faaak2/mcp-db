import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { client } from "../api-client.js";
import { slimTrip, compact } from "../slim.js";

interface Departure {
  tripId?: string;
  line?: { name?: string };
  [key: string]: unknown;
}

const PRODUCT_PREFIXES: Record<string, string[]> = {
  "express-train": ["ICE", "TGV", "RJ", "RJX", "ECE"],
  "long-distance-train": ["IC", "EC", "EN", "IR"],
  "regiona-train": ["RE", "IRE", "RB", "MEX"],
  "s-bahn": ["S"],
  "u-bahn": ["U"],
};

function getProductFilters(trainName: string): Record<string, boolean> | undefined {
  const prefix = trainName.replace(/\s+/g, "").replace(/\d+$/, "").toUpperCase();

  for (const [product, prefixes] of Object.entries(PRODUCT_PREFIXES)) {
    if (prefixes.includes(prefix)) {
      const products: Record<string, boolean> = {
        "express-train": false,
        "long-distance-train": false,
        "regiona-train": false,
        "s-bahn": false,
        "u-bahn": false,
        tram: false,
        bus: false,
        watercraft: false,
        ast: false,
        "cable-car": false,
      };
      products[product] = true;
      return products;
    }
  }

  // Unknown prefix — don't filter
  return undefined;
}

export function registerFindTrip(server: McpServer) {
  server.tool(
    "find_trip",
    "Find a specific train/bus trip by name and station. Fetches all departures for the day, matches the train, then retrieves full trip details with stopovers and remarks.",
    {
      train_name: z.string().describe("Train/line name to search for (e.g. 'S3', 'RE 30', 'U4')"),
      station_id: z.string().describe("Station ID (e.g. '3000010' for Frankfurt Hbf)"),
      date: z.string().describe("ISO date string (e.g. '2026-03-08')"),
    },
    async ({ train_name, station_id, date }) => {
      try {
        if (!/^\d{6,9}$/.test(station_id)) {
          return {
            isError: true,
            content: [{ type: "text" as const, text: `find_trip failed: Invalid station_id '${station_id}'. Expected a numeric HAFAS ID (e.g. '3000010' for Frankfurt Hbf). Use find_station to look up the correct ID.` }],
          };
        }

        // Step 1: Get departures for the day (split into two 12h windows)
        const products = getProductFilters(train_name);
        const baseOpt: Record<string, unknown> = { duration: 720 };
        if (products) baseOpt.products = products;

        const res1 = await client.departures(station_id, {
          ...baseOpt,
          when: new Date(`${date}T00:00`),
        });
        let departures: Departure[] = (res1.departures ?? []) as Departure[];

        // Search second half of day if needed
        const normalize = (s: string) => s.toLowerCase().replace(/\s+/g, "");
        let match = departures.find(
          (d) =>
            d.line?.name != null &&
            normalize(d.line.name) === normalize(train_name),
        );

        if (!match) {
          const res2 = await client.departures(station_id, {
            ...baseOpt,
            when: new Date(`${date}T12:00`),
          });
          const moreDepartures = (res2.departures ?? []) as Departure[];
          departures = [...departures, ...moreDepartures];

          match = moreDepartures.find(
            (d) =>
              d.line?.name != null &&
              normalize(d.line.name) === normalize(train_name),
          );
        }

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

        // Step 2: Fetch full trip details (hafas-client: trip(id, opt) — 2 params)
        const trip = await client.trip(match.tripId, {
          stopovers: true,
          remarks: true,
        });

        const slim = slimTrip(trip as Record<string, unknown>);
        return {
          content: [{ type: "text" as const, text: compact(slim) }],
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
