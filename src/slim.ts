/**
 * Strips DB API responses down to the fields the LLM actually needs.
 * Removes coordinates, operator details, ril100 IDs, excessive product info, etc.
 * Also removes undefined/null values to minimize JSON size.
 */

// ── helpers ──────────────────────────────────────────────────────────

interface AnyObj {
  [key: string]: unknown;
}

/** JSON.stringify replacer that drops undefined/null values */
function dropNulls(_key: string, value: unknown): unknown {
  return value === null || value === undefined ? undefined : value;
}

/** Compact JSON without pretty-printing, dropping nulls */
export function compact(obj: unknown): string {
  return JSON.stringify(obj, dropNulls);
}

function pick<T extends AnyObj>(obj: T | undefined | null, keys: string[]): AnyObj {
  if (!obj) return {};
  const out: AnyObj = {};
  for (const k of keys) {
    if (obj[k] !== undefined && obj[k] !== null) out[k] = obj[k];
  }
  return out;
}

function slimStop(stop: AnyObj | undefined | null): AnyObj | null {
  if (!stop) return null;
  return { id: stop.id, name: stop.name };
}

function slimRemarks(remarks: unknown): AnyObj[] | undefined {
  if (!Array.isArray(remarks)) return undefined;
  const kept = remarks
    .filter((r: AnyObj) => r.type === "warning" || r.type === "status")
    .map((r: AnyObj) => pick(r, ["type", "summary", "text", "validFrom", "validUntil"]));
  return kept.length > 0 ? kept : undefined;
}

function slimStopover(s: AnyObj): AnyObj {
  const out: AnyObj = { stop: (s.stop as AnyObj)?.name ?? null };
  // Only include times that exist
  const arr = s.arrival ?? s.plannedArrival;
  if (arr) out.arrival = arr;
  if (s.arrivalDelay) out.arrivalDelay = s.arrivalDelay;
  const dep = s.departure ?? s.plannedDeparture;
  if (dep) out.departure = dep;
  if (s.departureDelay) out.departureDelay = s.departureDelay;
  // Platform only if present
  const plat = s.departurePlatform ?? s.plannedDeparturePlatform;
  if (plat) out.platform = plat;
  if (s.cancelled) out.cancelled = true;
  return out;
}

// ── public API ───────────────────────────────────────────────────────

function slimLeg(leg: AnyObj): AnyObj {
  const out: AnyObj = {
    origin: slimStop(leg.origin as AnyObj),
    destination: slimStop(leg.destination as AnyObj),
    departure: leg.departure ?? leg.plannedDeparture,
    plannedDeparture: leg.plannedDeparture,
    departureDelay: leg.departureDelay ?? undefined,
    arrival: leg.arrival ?? leg.plannedArrival,
    plannedArrival: leg.plannedArrival,
    arrivalDelay: leg.arrivalDelay ?? undefined,
  };

  if (leg.walking) {
    out.walking = true;
    if (leg.distance) out.distance = leg.distance;
  } else {
    out.line = leg.line ? pick(leg.line as AnyObj, ["name", "productName", "mode"]) : undefined;
    out.direction = leg.direction;
    out.departurePlatform = leg.departurePlatform ?? leg.plannedDeparturePlatform;
    out.plannedDeparturePlatform = leg.plannedDeparturePlatform;
    out.arrivalPlatform = leg.arrivalPlatform ?? leg.plannedArrivalPlatform;
    out.plannedArrivalPlatform = leg.plannedArrivalPlatform;

    if (leg.cancelled) out.cancelled = true;

    const remarks = slimRemarks(leg.remarks);
    if (remarks) out.remarks = remarks;

    if (Array.isArray(leg.stopovers)) {
      out.stopovers = (leg.stopovers as AnyObj[]).map(slimStopover);
    }
  }

  return out;
}

export function slimJourneys(data: AnyObj): AnyObj {
  const journeys = (data.journeys as AnyObj[]) ?? [];
  return {
    journeys: journeys.map((j) => ({
      legs: ((j.legs as AnyObj[]) ?? []).map(slimLeg),
      ...(j.price ? { price: j.price } : {}),
    })),
  };
}

export function slimTrip(data: AnyObj): AnyObj {
  const trip = (data.trip as AnyObj) ?? data;
  return {
    trip: {
      ...pick(trip, ["id", "direction", "cancelled"]),
      line: trip.line ? pick(trip.line as AnyObj, ["name", "productName", "mode"]) : undefined,
      origin: slimStop(trip.origin as AnyObj),
      destination: slimStop(trip.destination as AnyObj),
      departure: trip.departure ?? trip.plannedDeparture,
      plannedDeparture: trip.plannedDeparture,
      departureDelay: trip.departureDelay ?? undefined,
      arrival: trip.arrival ?? trip.plannedArrival,
      plannedArrival: trip.plannedArrival,
      arrivalDelay: trip.arrivalDelay ?? undefined,
      remarks: slimRemarks(trip.remarks),
      stopovers: Array.isArray(trip.stopovers)
        ? (trip.stopovers as AnyObj[]).map(slimStopover)
        : undefined,
    },
  };
}

export function slimDeparture(d: AnyObj): AnyObj {
  return {
    tripId: d.tripId,
    line: d.line ? pick(d.line as AnyObj, ["name", "productName", "mode"]) : undefined,
    direction: d.direction,
    when: d.when ?? d.plannedWhen,
    plannedWhen: d.plannedWhen,
    delay: d.delay ?? undefined,
    platform: d.platform ?? d.plannedPlatform,
    plannedPlatform: d.plannedPlatform,
    ...(d.cancelled ? { cancelled: true } : {}),
    remarks: slimRemarks(d.remarks),
  };
}

export function slimDepartures(departures: unknown[]): AnyObj[] {
  return departures.map((d) => slimDeparture(d as AnyObj));
}
