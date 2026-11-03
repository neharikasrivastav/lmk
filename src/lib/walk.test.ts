import { describe, expect, it } from "vitest";
import {
  ALERT_PROGRESS,
  ARRIVAL_METRES,
  PARTNER_PRICE,
  DEMO_SECONDS,
  CALMER_EXTRA_SECONDS,
  REROUTE_EXTRA_SECONDS,
  remainingRoute,
  calmScore,
  hasArrived,
  routeReports,
  sortedStops,
  reportsLabel,
} from "./walk";
import type { Incident, Stop } from "./walk";
describe("walk rules", () => {
  const route = {
    id: 0,
    distanceM: 1000,
    durationS: 900,
    coordinates: [
      [-122.4, 37.78],
      [-122.4, 37.79],
    ] as [number, number][],
  };
  const incident: Incident = {
    id: "a",
    type: "poor lighting",
    description: "Dim lighting",
    lat: 37.785,
    lng: -122.4,
    severity: 2,
    minutes_ago: 6,
  };
  it("scores recent reports within 50 metres", () => {
    expect(routeReports(route, [incident, { ...incident, id: "b", lng: -122.402 }])).toHaveLength(
      1,
    );
    expect(calmScore(route, [incident])).toBe(87);
  });
  it("does not score reports older than an hour", () =>
    expect(routeReports(route, [{ ...incident, minutes_ago: 61 }])).toHaveLength(0));
  it("ends within 30 metres, not 44 metres", () => {
    expect(ARRIVAL_METRES).toBe(30);
    expect(hasArrived([-122.4, 37.78], [-122.4, 37.7801])).toBe(true);
    expect(hasArrived([-122.4, 37.78], [-122.4, 37.7804])).toBe(false);
  });
  it("shows the report at forty percent", () => expect(ALERT_PROGRESS).toBe(0.4));
  it("runs the demo in sixty seconds", () => expect(DEMO_SECONDS).toBe(60));
  it("adds three minutes to the calmer route", () => expect(CALMER_EXTRA_SECONDS).toBe(180));
  it("adds one minute to the reroute", () => expect(REROUTE_EXTRA_SECONDS).toBe(60));
  it("preserves the current position on a detour", () => {
    const position: [number, number] = [-122.4, 37.785];
    const remaining = remainingRoute(route.coordinates, position);
    expect(remaining[0]).toEqual(position);
    expect(remaining.at(-1)).toEqual([-122.4, 37.79]);
    expect(remaining).not.toContainEqual([-122.4, 37.78]);
  });
  it("prices verified partnership at 49 dollars monthly", () => expect(PARTNER_PRICE).toBe(49));
  it("sorts verified before late-night before other stops", () => {
    const base = {
      id: "",
      name: "",
      lat: 37.78,
      lng: -122.4,
      address: "",
      note: "",
      specialty: "",
    };
    const stops: Stop[] = [
      { ...base, id: "early", verified: false, closes_at: 20 },
      { ...base, id: "late", verified: false, closes_at: 23 },
      { ...base, id: "partner", verified: true, closes_at: 20 },
    ];
    expect(sortedStops(stops, [-122.4, 37.78]).map((s) => s.id)).toEqual([
      "partner",
      "late",
      "early",
    ]);
  });
});
describe("reportsLabel", () => {
  it("shows plain counts instead of a score", () => {
    expect(reportsLabel(0)).toBe("No reports");
    expect(reportsLabel(1)).toBe("1 report");
    expect(reportsLabel(2)).toBe("2 reports");
  });
});
