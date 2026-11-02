import { describe, expect, it } from "vitest";
import { availableDemoContent } from "./demo-content";

describe("unavailable demo content", () => {
  it("returns empty collections and an error for a missing database", () => {
    const result = availableDemoContent({ stops: [], incidents: [], contacts: [], routes: [] }, true);
    expect(result.routes).toEqual([]);
    expect(result.error).not.toBeNull();
  });
  it("rejects empty route geometry so the map cannot crash", () => {
    const result = availableDemoContent({ stops: [], incidents: [], contacts: [], routes: [{ id: 0, name: "Fastest", coordinates: [], durationS: 900, distanceM: 1000 }] });
    expect(result.routes).toHaveLength(0);
    expect(result.error).not.toBeNull();
  });
  it("preserves valid routes with an empty incident collection", () => {
    const route = { id: 0, name: "Fastest", coordinates: [[-122.40785, 37.78443], [-122.39773, 37.78565]] as [number, number][], durationS: 900, distanceM: 1000 };
    const result = availableDemoContent({ stops: [], incidents: [], contacts: [], routes: [route] });
    expect(result.routes).toEqual([route]);
    expect(result.error).toBeNull();
  });
});