declare module "hafas-client" {
  interface ClientOptions {
    when?: Date;
    duration?: number;
    products?: Record<string, boolean>;
    results?: number;
    stopovers?: boolean;
    remarks?: boolean;
    departure?: Date;
    arrival?: Date;
    transfers?: number;
    transferTime?: number;
    language?: string;
    polyline?: boolean;
    [key: string]: unknown;
  }

  interface Client {
    locations(query: string, opt?: ClientOptions): Promise<unknown[]>;
    departures(station: string, opt?: ClientOptions): Promise<{ departures: unknown[]; realtimeDataUpdatedAt?: number }>;
    arrivals(station: string, opt?: ClientOptions): Promise<{ arrivals: unknown[]; realtimeDataUpdatedAt?: number }>;
    journeys(from: string, to: string, opt?: ClientOptions): Promise<{ journeys: unknown[]; earlierRef?: string; laterRef?: string; realtimeDataUpdatedAt?: number }>;
    trip(id: string, opt?: ClientOptions): Promise<unknown>;
    stop(id: string, opt?: ClientOptions): Promise<unknown>;
    nearby(location: { latitude: number; longitude: number }, opt?: ClientOptions): Promise<unknown[]>;
    refreshJourney(refreshToken: string, opt?: ClientOptions): Promise<unknown>;
  }

  export function createClient(profile: unknown, userAgent: string): Client;
}

declare module "hafas-client/p/rmv/index.js" {
  export const profile: unknown;
}
