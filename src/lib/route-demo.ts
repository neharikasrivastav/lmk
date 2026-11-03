import { lineString, point } from "@turf/helpers";
import nearestPointOnLine from "@turf/nearest-point-on-line";
import pointToLineDistance from "@turf/point-to-line-distance";
import { calmScore, distance, routeReports, routePosition, type Coord, type DemoRoute, type Incident, type Stop } from "./walk";

export const DEMO_DOT_RADIUS = 100;
export const DEMO_DOT_LIMIT = 8;
export const STOP_RADIUS = 300;
export function routeDistance(coordinates: Coord[], coordinate: Coord) {
  return pointToLineDistance(point(coordinate), lineString(coordinates), { units: "meters" });
}
export function extraMinutes(duration: number, fastest: number) { return Math.max(0, Math.round(duration / 60) - Math.round(fastest / 60)); }
export function rankedRoutes(routes: DemoRoute[], incidents: Incident[]) {
  const sorted = [...routes].sort((a, b) => a.durationS - b.durationS);
  const calmer = [...sorted].sort((a, b) => calmScore(b, incidents) - calmScore(a, incidents) || (a.busyIntersections ?? 100000) - (b.busyIntersections ?? 100000) || (b.mainStreetMetres ?? 0) - (a.mainStreetMetres ?? 0) || a.durationS - b.durationS)[0];
  const fastest = sorted[0];
  return { routes: sorted.map((r) => ({ ...r, name: r.id === calmer?.id && r.id === fastest?.id ? "Fastest · Calmer" : r.id === calmer?.id ? "Calmer" : r.id === fastest?.id ? "Fastest" : "Alternative" })), calmerId: calmer?.id ?? 0, fastest };
}
export function calmerReason(routes: DemoRoute[], incidents: Incident[]) {
  const rank = rankedRoutes(routes, incidents);
  const calmer = routes.find((r) => r.id === rank.calmerId);
  if (!calmer || !rank.fastest) return "Stays on well-traveled streets.";
  const fastestReports = routeReports(rank.fastest, incidents);
  const calmerReports = routeReports(calmer, incidents);
  // Match the counts shown on the route cards: fastest minus calmer.
  const fewer = fastestReports.length - calmerReports.length;
  const avoided = fastestReports.filter((i) => !calmerReports.some((other) => other.id === i.id));
  const groups = new Map<string, Incident[]>();
  for (const i of avoided) groups.set(`${i.type}|${i.street}`, [...(groups.get(`${i.type}|${i.street}`) ?? []), i]);
  const top = [...groups.values()].sort((a, b) => b.length - a.length || (b[0]?.severity ?? 0) - (a[0]?.severity ?? 0))[0]?.[0];
  const extra = extraMinutes(calmer.durationS, rank.fastest.durationS);
  if (fewer > 0 && top) {
    const where = `${top.type} on ${top.street || "the faster route"}`;
    return fewer === 1
      ? `Calmer route, +${extra} min. 1 fewer report in the last hour: ${where}.`
      : `Calmer route, +${extra} min. ${fewer} fewer reports in the last hour, mostly ${where}.`;
  }
  return `Calmer route, +${extra} min. ${typeof calmer.busyIntersections === "number" && typeof rank.fastest.busyIntersections === "number" && calmer.busyIntersections < rank.fastest.busyIntersections ? "Passes fewer busy intersections." : "Stays on well-traveled streets."}`;
}
export function visibleDemoIncidents(route: DemoRoute | undefined, incidents: Incident[]) {
  if (!route) return [];
  return incidents.filter((i) => i.minutes_ago <= 60 && routeDistance(route.coordinates, [i.lng, i.lat]) <= DEMO_DOT_RADIUS).sort((a, b) => b.severity - a.severity || a.minutes_ago - b.minutes_ago).slice(0, DEMO_DOT_LIMIT);
}
export function nearbyRouteStops(route: DemoRoute | undefined, stops: Stop[]) {
  return route ? stops.filter((s) => routeDistance(route.coordinates, [s.lng, s.lat]) <= STOP_RADIUS) : stops;
}
export function alertAhead(route: DemoRoute, progress: number, incidents: Incident[]): Incident {
  const location = routePosition(route, progress);
  const line = lineString(route.coordinates);
  const current = nearestPointOnLine(line, point(location)).properties.location ?? 0;
  const candidates = incidents.filter((i) => {
    const snapped = nearestPointOnLine(line, point([i.lng, i.lat]));
    return (snapped.properties.location ?? 0) > current && distance(location, [i.lng, i.lat]) <= 300;
  }).sort((a, b) => distance(location, [a.lng, a.lat]) - distance(location, [b.lng, b.lat]));
  const nearest = candidates[0];
  if (nearest) return nearest;
  const ahead = routePosition(route, Math.min(0.8, progress + 0.15));
  return { id: "generated-demo-alert", type: "blocked sidewalk", description: "Temporary sidewalk obstruction in this demo", lng: ahead[0], lat: ahead[1], severity: 1, minutes_ago: 6, street: "the route ahead" };
}