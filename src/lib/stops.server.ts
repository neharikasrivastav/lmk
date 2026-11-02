import OpeningHours from "opening_hours";
import type { Coord, Stop } from "./walk";

export function openLate(raw: string | undefined, lat: number, lng: number, at = new Date()) {
  if (!raw) return false;
  try {
    const parts = new Intl.DateTimeFormat("en-US", { timeZone: "America/Los_Angeles", year: "numeric", month: "numeric", day: "numeric" }).formatToParts(at);
    const part = (key: string) => Number(parts.find((p) => p.type === key)?.value);
    // opening_hours reads host-local getters. Build a wall-clock SF date in host-local time.
    const tonight = new Date(part("year"), part("month") - 1, part("day"), 22, 30);
    const hours = new OpeningHours(raw, { lat, lon: lng, address: { country_code: "us", state: "California" } });
    return !hours.getUnknown(tonight) && hours.getState(tonight);
  } catch { return false; }
}

export async function fetchRouteBusinesses(coordinates: Coord[]): Promise<{ stops: Stop[]; error: string | null }> {
  const step = Math.max(1, Math.ceil(coordinates.length / 64));
  const samples = coordinates.filter((_, i) => i % step === 0 || i === coordinates.length - 1);
  const corridor = samples.map(([lng, lat]) => `${lat},${lng}`).join(",");
  const query = `[out:json][timeout:15][maxsize:16777216];(nwr["amenity"~"^(cafe|restaurant)$"](around:300,${corridor});nwr["tourism"="hotel"](around:300,${corridor}););out body center qt 80;`;
  try {
    const response = await fetch("https://overpass-api.de/api/interpreter", { method: "POST", body: new URLSearchParams({ data: query }), signal: AbortSignal.timeout(20000) });
    if (!response.ok) throw new Error("Business search unavailable");
    const json = await response.json() as { remark?: string; elements?: Array<{ id: number; type: string; lat?: number; lon?: number; center?: { lat: number; lon: number }; tags?: Record<string, string> }> };
    if (json.remark || !Array.isArray(json.elements)) throw new Error("Incomplete business search");
    const seen = new Set<string>();
    const stops: Stop[] = [];
    for (const element of json.elements) {
      const tags = element.tags ?? {};
      const lat = element.lat ?? element.center?.lat, lng = element.lon ?? element.center?.lon;
      if (!tags["name"] || lat === undefined || lng === undefined) continue;
      const key = `${tags["name"].toLowerCase()}|${lat.toFixed(3)}|${lng.toFixed(3)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const rawHours = tags["opening_hours"];
      stops.push({ id: `osm-${element.type}-${element.id}`, name: tags["name"], lat, lng,
        address: [tags["addr:housenumber"], tags["addr:street"]].filter(Boolean).join(" ") || "Near your route",
        note: "OpenStreetMap listing · confirm opening hours and access with the business", verified: false,
        closes_at: 0, lateNight: openLate(rawHours, lat, lng), ...(rawHours ? { opening_hours: rawHours } : {}),
        specialty: tags["amenity"] === "cafe" ? "Coffee" : tags["tourism"] === "hotel" ? "Lobby" : "Food", demo: false,
        sourceUrl: `https://www.openstreetmap.org/${element.type}/${element.id}`,
      });
    }
    return { stops, error: null };
  } catch { return { stops: [], error: "Nearby business listings couldn’t load. Showing available demo stops." }; }
}