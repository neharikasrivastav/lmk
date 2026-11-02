import { describe, expect, it, vi, afterEach } from "vitest";
import { normalizeOfficialReports, sourceLocalTime, INCIDENT_SOURCE_NAME, INCIDENT_SOURCE_URL } from "./incident-source";
import { readOfficialIncidents } from "./incidents.server";
import { routeReports } from "./walk";

const fetchedAt = "2026-10-24T22:12:00.000Z";
const row = { incident_id: "1609322", incident_datetime: "2026-10-23T23:40:00.000", incident_category: "Assault", latitude: "37.785", longitude: "-122.4", record_updated_at: "2026-10-24T17:02:49.289Z" };
afterEach(() => vi.unstubAllGlobals());
describe("official incident provenance", () => {
  it("uses SFPD DataSF provenance and preserves upstream update separately from fetch time", () => {
    const report = normalizeOfficialReports([row], fetchedAt)[0];
    expect(report?.sourceName).toBe(INCIDENT_SOURCE_NAME);
    expect(report?.sourceUrl?.startsWith(INCIDENT_SOURCE_URL)).toBe(true);
    expect(report?.sourceRecordId).toBe("1609322");
    expect(report?.sourceUpdatedAt).toBe("2026-10-24T17:02:49.289Z");
    expect(report?.fetchedAt).toBe("2026-10-24T22:12:00.000Z");
    expect(report?.occurredAt).toBe("2026-10-24T06:40:00.000Z");
  });
  it("never substitutes retrieval time when upstream update is absent", () => {
    expect(normalizeOfficialReports([{ ...row, record_updated_at: undefined }], fetchedAt)[0]?.sourceUpdatedAt).toBeNull();
  });
  it("rejects unlocated and person-type categories instead of inventing behaviors", () => {
    expect(normalizeOfficialReports([{ ...row, latitude: undefined }, { ...row, incident_category: "Missing Person" }], fetchedAt)).toHaveLength(0);
  });
  it("deduplicates offense rows for one police incident", () => {
    expect(normalizeOfficialReports([row, { ...row, record_updated_at: "2026-10-24T18:00:00Z" }], fetchedAt)).toHaveLength(1);
    expect(normalizeOfficialReports([row, { ...row, record_updated_at: "2026-10-24T18:00:00Z" }], fetchedAt)[0]?.sourceUpdatedAt).toBe("2026-10-24T18:00:00.000Z");
  });
  it("accounts for Pacific standard and daylight time", () => {
    expect(sourceLocalTime("2026-01-23T23:40:00.000")).toBe("2026-01-24T07:40:00.000Z");
    expect(sourceLocalTime("2026-10-23T23:40:00.000")).toBe("2026-10-24T06:40:00.000Z");
  });
  it("never treats a recently updated old incident as occurring within the last hour", () => {
    const route = { id: 0, durationS: 900, distanceM: 1000, coordinates: [[-122.4, 37.78], [-122.4, 37.79]] as [number, number][] };
    const reports = normalizeOfficialReports([row], fetchedAt);
    expect(routeReports(route, reports, Date.parse(fetchedAt))).toHaveLength(0);
  });
  it("returns no illustrative incidents when the official source fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("Unavailable")));
    const feed = await readOfficialIncidents();
    expect(feed.status).toBe("unavailable");
    expect(feed.incidents).toEqual([]);
    expect(feed.fetchedAt).toBeNull();
  });
});