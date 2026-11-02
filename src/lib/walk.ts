import { lineString, point } from "@turf/helpers";
import nearestPointOnLine from "@turf/nearest-point-on-line";
import pointToLineDistance from "@turf/point-to-line-distance";
import along from "@turf/along";
import length from "@turf/length";
import type { WalkRoute } from "./geo.functions";

export type Coord = [number, number];
export type Incident = {
  id: string;
  type: string;
  description: string;
  lat: number;
  lng: number;
  severity: number;
  minutes_ago: number;
  occurredAt?: string;
  sourceUpdatedAt?: string | null;
  fetchedAt?: string;
  sourceName?: string;
  sourceUrl?: string;
  sourceRecordId?: string;
  street?: string;
};
export type Stop = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  address: string;
  note: string;
  verified: boolean;
  closes_at: number;
  specialty: string;
  walking_route?: Coord[];
  demo?: boolean;
  opening_hours?: string;
  lateNight?: boolean;
  sourceUrl?: string;
};
export type DemoRoute = WalkRoute & { name: string; busyIntersections?: number; mainStreetMetres?: number };
export const START: Coord = [-122.40785, 37.78443];
export const PARK: Coord = [-122.39773, 37.78565];
export const ARRIVAL_METRES = 30;
export const ALERT_PROGRESS = 0.4;
export const DEMO_SECONDS = 60;
export const CALMER_EXTRA_SECONDS = 180;
export const REROUTE_EXTRA_SECONDS = 60;
export const PARTNER_PRICE = 49;
export const CONTACTS = ["Mom", "Priya", "Alex"];
export function remainingRoute(coordinates: Coord[], position: Coord): Coord[] {
  const nearest = nearestPointOnLine(lineString(coordinates), point(position));
  const index = nearest.properties.index ?? 0;
  const c = nearest.geometry.coordinates;
  const snapped: Coord = [c[0] ?? position[0], c[1] ?? position[1]];
  return [position, snapped, ...coordinates.slice(index + 1)];
}
export function distance(a: Coord, b: Coord) {
  return length(lineString([a, b]), { units: "meters" });
}
export function routeReports(route: WalkRoute, incidents: Incident[], now = Date.now()) {
  return incidents.filter(
    (i) =>
      (i.occurredAt ? now - Date.parse(i.occurredAt) >= 0 && now - Date.parse(i.occurredAt) <= 3600000 : i.minutes_ago <= 60) &&
      pointToLineDistance(point([i.lng, i.lat]), lineString(route.coordinates), {
        units: "meters",
      }) <= 50,
  );
}
export function calmScore(route: WalkRoute, incidents: Incident[]) {
  return Math.max(
    0,
    Math.round(
      100 -
        routeReports(route, incidents).reduce(
          (n, i) => n + i.severity * 7 * (1 - i.minutes_ago / 120),
          0,
        ),
    ),
  );
}
export function routePosition(route: WalkRoute, progress: number): Coord {
  const line = lineString(route.coordinates);
  const coords = along(line, length(line) * Math.max(0, Math.min(1, progress))).geometry
    .coordinates;
  return [coords[0] ?? START[0], coords[1] ?? START[1]];
}
export function hasArrived(position: Coord, destination: Coord) {
  return distance(position, destination) <= ARRIVAL_METRES;
}
export function sortedStops(stops: Stop[], position: Coord) {
  return [...stops].sort(
    (a, b) =>
      Number(b.verified) - Number(a.verified) ||
      Number(b.closes_at > 22) - Number(a.closes_at > 22) ||
      distance(position, [a.lng, a.lat]) - distance(position, [b.lng, b.lat]),
  );
}
export function fmtDistance(m: number) {
  return m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${Math.round(m)} m`;
}
export type PublicTrip = {
  token: string;
  destination: string;
  destination_coords: Coord;
  route: Coord[];
  position: Coord;
  progress: number;
  duration_s: number;
  status: string;
  checkins: string[];
  updated_at: string;
  demo: boolean;
};
