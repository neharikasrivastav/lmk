import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export type { AddressPlace as Place } from "./address-search";
export type WalkRoute = {
  id: number;
  distanceM: number;
  durationS: number;
  coordinates: [number, number][];
  mainStreetMetres?: number;
  busyIntersections?: number;
};

export const searchPlaces = createServerFn({ method: "GET" })
  .inputValidator((d) => z.object({ q: z.string().trim().min(2).max(120), bias: z.tuple([z.number().min(-180).max(180), z.number().min(-90).max(90)]).optional() }).parse(d))
  .handler(async ({ data }) => {
    const { lookupAddress } = await import("./address-search.server");
    return lookupAddress(data.q, data.bias);
  });

export const getWalkingRoutes = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z.object({
      from: z.tuple([z.number(), z.number()]),
      to: z.tuple([z.number(), z.number()]),
    }).parse(d),
  )
  .handler(async ({ data }): Promise<{ routes: WalkRoute[]; error?: string }> => {
    const key = process.env["ORS_API_KEY"];
    if (!key) return { routes: [], error: "missing_key" };
    const res = await fetch("https://api.openrouteservice.org/v2/directions/foot-walking/geojson", {
      method: "POST",
      headers: { Authorization: key, "Content-Type": "application/json" },
      body: JSON.stringify({
        coordinates: [data.from, data.to],
        alternative_routes: { target_count: 3, weight_factor: 1.6, share_factor: 0.6 },
      }),
    });
    if (!res.ok) {
      const body = await res.text();
      console.error(`ORS failed [${res.status}]: ${body}`);
      return { routes: [], error: `Routing failed (${res.status})` };
    }
    const json = (await res.json()) as {
      features: Array<{
        geometry: { coordinates: [number, number][] };
        properties: { summary: { distance: number; duration: number }; segments?: Array<{ steps?: Array<{ name?: string; distance?: number }> }> };
      }>;
    };
    return {
      routes: json.features.slice(0, 3).map((f, i) => ({
        id: i,
        distanceM: f.properties.summary.distance,
        durationS: Math.max(1, Math.round(f.properties.summary.duration)),
        mainStreetMetres: (f.properties.segments ?? []).flatMap((s) => s.steps ?? []).filter((s) => /\b(Market|Mission|Geary|Van Ness|Columbus|Broadway|Chestnut|Haight|Irving|Taraval|California|Folsom|Howard|Valencia)\b/i.test(s.name ?? "")).reduce((sum, s) => sum + (s.distance ?? 0), 0),
        coordinates: f.geometry.coordinates,
      })),
    };
  });
