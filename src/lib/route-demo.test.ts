import { describe, expect, it } from "vitest";
import { alertAhead, calmerReason, extraMinutes, nearbyRouteStops, rankedRoutes, visibleDemoIncidents } from "./route-demo";
import { calmScore, routePosition, type DemoRoute, type Incident, type Stop } from "./walk";
const fastest: DemoRoute = { id: 9, name: "", durationS: 900, distanceM: 1000, coordinates: [[-122.4,37.78],[-122.4,37.79]], mainStreetMetres: 0 };
const calmer: DemoRoute = { ...fastest, id: 2, durationS: 1080, coordinates: [[-122.402,37.78],[-122.402,37.79]], mainStreetMetres: 900 };
const incident: Incident = { id: "a", type: "aggressive behavior", description: "Shouting", severity: 3, minutes_ago: 6, lat: 37.785, lng: -122.4, street: "Market St" };
describe("seeded route rules", () => {
  it("sorts by time and defaults to higher seeded calm score, not route ID", () => {
    const rank = rankedRoutes([calmer,fastest],[incident]);
    expect(rank.routes.map((r)=>r.id)).toEqual([9,2]);
    expect(rank.calmerId).toBe(2);
    expect(calmScore(fastest,[incident])).toBe(80);
    expect(calmerReason([fastest,calmer],[incident])).toBe("Calmer route, +3 min. Avoids 1 recent reports of aggressive behavior on Market St.");
  });
  it("computes nonnegative displayed-time differences relative to fastest", () => {
    expect(extraMinutes(1080,900)).toBe(3);
    expect(extraMinutes(850,900)).toBe(0);
    expect(extraMinutes(901,900)).toBe(0);
  });
  it("breaks tied scores with fewer busy intersections then main streets", () => {
    expect(rankedRoutes([{...fastest,busyIntersections:8},{...calmer,busyIntersections:2}],[]).calmerId).toBe(2);
    expect(rankedRoutes([fastest,calmer],[]).calmerId).toBe(2);
  });
  it("shows at most eight dots and none beyond 100 metres", () => {
    const incidents=Array.from({length:12},(_,i)=>({...incident,id:String(i)}));
    expect(visibleDemoIncidents(fastest,incidents)).toHaveLength(8);
    expect(visibleDemoIncidents(fastest,[{...incident,lng:-122.402}])).toHaveLength(0);
  });
  it("selects nearest incident ahead within 300 metres, never behind", () => {
    const ahead={...incident,lat:37.785};
    expect(alertAhead(fastest,0.4,[{...incident,id:"behind",lat:37.782},ahead]).id).toBe("a");
  });
  it("generates a demo alert ahead for any empty route", () => {
    const report=alertAhead(calmer,0.4,[]);
    const position=routePosition(calmer,0.4);
    expect(report.id).toBe("generated-demo-alert");
    expect(report.lat).toBeGreaterThan(position[1]);
  });
  it("filters stops within 300 metres", () => {
    const stop: Stop={id:"s",name:"Cafe",lat:37.785,lng:-122.4,address:"",note:"",verified:true,closes_at:23,specialty:"Coffee"};
    expect(nearbyRouteStops(fastest,[stop,{...stop,id:"far",lng:-122.41}]).map(s=>s.id)).toEqual(["s"]);
  });
});