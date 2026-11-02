import { describe, expect, it, vi, afterEach } from "vitest";
import { normalizeAddressResults, requestedHouseNumber } from "./address-search";
import { lookupAddress } from "./address-search.server";

const feature = (props: object, coordinates = [-122.4150921, 37.7781558]) => ({ properties: { osm_type: "N", osm_id: 1, ...props }, geometry: { type: "Point", coordinates } });
afterEach(() => vi.unstubAllGlobals());
describe("full address lookup", () => {
  it("preserves building number and street instead of replacing an address with a POI name", () => {
    const result = normalizeAddressResults({ features: [feature({ name: "Hotel Whitcomb", housenumber: "1231", street: "Market Street", city: "San Francisco" })] }, "1231 Market Street");
    expect(result[0]?.name).toBe("1231 Market Street");
    expect(result[0]?.houseNumber).toBe("1231");
    expect(result[0]?.lng).toBe(-122.4150921);
  });
  it("keeps Bay Area addresses outside the old SF bounds", () => {
    const results = normalizeAddressResults({ features: [feature({ housenumber: "1600", street: "Shattuck Avenue", city: "Berkeley" }, [-122.269, 37.879])] }, "1600 Shattuck Avenue Berkeley");
    expect(results[0]?.address).toBe("Berkeley");
    expect(results).toHaveLength(1);
  });
  it("labels the first semicolon-separated number and neighborhood and removes duplicates", () => {
    const row = feature({housenumber:"1215;1217",street:"Market Street",locality:"Civic Center",city:"San Francisco",state:"California"});
    const results = normalizeAddressResults({features:[row,row]},"1215 Market Street");
    expect(results).toHaveLength(1);
    expect(results[0]?.name).toBe("1215 Market Street, Civic Center");
    expect(results[0]?.address).toBe("San Francisco, CA");
  });
  it("never passes a different number or street centroid off as a missing requested building", () => {
    expect(normalizeAddressResults({ features: [feature({ housenumber: "101", street: "Market Street" }), feature({ name: "Market Street", type: "street" })] }, "999999 Market Street")).toHaveLength(0);
    expect(requestedHouseNumber("123A Market Street")).toBe("123a");
  });
  it("biases the upstream query without a restrictive bounding box", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ features: [] }) });
    vi.stubGlobal("fetch", fetchMock);
    await lookupAddress("1600 Shattuck Avenue Berkeley", [-122.4, 37.78]);
    const url = new URL(fetchMock.mock.calls[0]?.[0]);
    expect(url.hostname).toBe("photon.komoot.io");
    expect(url.searchParams.get("lat")).toBe("37.78");
    expect(url.searchParams.get("lon")).toBe("-122.4");
    expect(url.searchParams.has("bbox")).toBe(false);
    expect(url.searchParams.has("bounded")).toBe(false);
  });
  it("distinguishes no address match from a provider failure", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ features: [] }) }));
    expect((await lookupAddress("999999 Market Street")).status).toBe("empty");
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("Offline")));
    expect((await lookupAddress("1231 Market Street")).status).toBe("error");
  });
});