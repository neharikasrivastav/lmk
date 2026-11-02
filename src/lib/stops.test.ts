import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchRouteBusinesses, openLate } from "./stops.server";
afterEach(() => vi.unstubAllGlobals());
describe("business late-night hours", () => {
  it("marks 24-hour and post-10pm hours late, not 10pm closing", () => {
    expect(openLate("24/7",37.78,-122.4)).toBe(true);
    expect(openLate("Mo-Su 08:00-23:00",37.78,-122.4)).toBe(true);
    expect(openLate("Mo-Su 08:00-22:00",37.78,-122.4)).toBe(false);
  });
  it("never marks missing or malformed hours late", () => {
    expect(openLate(undefined,37.78,-122.4)).toBe(false);
    expect(openLate("unknown hours",37.78,-122.4)).toBe(false);
  });
  it("queries cafes restaurants hotels in a 300m route corridor and preserves unverified status", async () => {
    const mock = vi.fn().mockResolvedValue({ok:true,json:async()=>({elements:[{type:"node",id:1,lat:37.78,lon:-122.4,tags:{name:"Example cafe",amenity:"cafe",opening_hours:"24/7"}}]})});
    vi.stubGlobal("fetch",mock);
    const result = await fetchRouteBusinesses([[-122.4,37.78],[-122.401,37.781]]);
    expect(String(mock.mock.calls[0]?.[1].body)).toContain("around%3A300");
    expect(result.stops[0]?.verified).toBe(false);
    expect(result.stops[0]?.lateNight).toBe(true);
    expect(result.stops[0]?.demo).toBe(false);
  });
  it("returns a clear recoverable state when Overpass is unavailable", async () => {
    vi.stubGlobal("fetch",vi.fn().mockResolvedValue({ok:false,status:406}));
    const result = await fetchRouteBusinesses([[-122.4,37.78],[-122.401,37.781]]);
    expect(result.error).not.toBeNull();
    expect(result.stops).toEqual([]);
  });
});