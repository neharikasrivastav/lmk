export const SEARCH_DEBOUNCE_MS = 500;
export type AddressPlace = { id: string; name: string; address: string; lat: number; lng: number; houseNumber?: string; match: "address" | "place" | "street" };
export type AddressSearchResult = { places: AddressPlace[]; message: string; status: "ready" | "empty" | "error" };

export function requestedHouseNumber(query: string) {
  return query.trim().match(/^(\d+[a-z]?(?:-\d+[a-z]?)?)\s+/i)?.[1]?.toLowerCase();
}
export function normalizeAddressResults(json: unknown, query: string): AddressPlace[] {
  if (!json || typeof json !== "object" || !("features" in json) || !Array.isArray(json.features)) throw new Error("Invalid search results");
  const houseNumber = requestedHouseNumber(query);
  const intersection = /\s(?:&|and|at)\s/i.test(query);
  const seen = new Set<string>();
  const places: AddressPlace[] = [];
  for (const feature of json.features) {
    const p = feature?.properties;
    const c = feature?.geometry?.coordinates;
    if (!p || !Array.isArray(c) || !Number.isFinite(c[0]) || !Number.isFinite(c[1])) continue;
    const number = typeof p.housenumber === "string" ? p.housenumber.split(";")[0]?.trim() : undefined;
    if (houseNumber && number?.toLowerCase() !== houseNumber) continue;
    const street = typeof p.street === "string" ? p.street : "";
    const namedCrossing = intersection && typeof p.name === "string" && /\s(?:&|and|at)\s/i.test(p.name);
    const base = namedCrossing ? p.name : number && street ? `${number} ${street}` : p.name || street || p.display_name?.split(",")[0];
    if (typeof base !== "string" || !base) continue;
    const neighborhood = p.neighbourhood || p.neighborhood || p.locality || p.district;
    const name = neighborhood && neighborhood !== p.city ? `${base}, ${neighborhood}` : base;
    const address = [p.city || p.town || "San Francisco", p.state === "California" ? "CA" : p.state].filter(Boolean).join(", ");
    const key = `${name.toLowerCase()}|${address.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    places.push({ id: `${p.osm_type ?? "osm"}-${p.osm_id ?? places.length}`, name, address, lng: c[0], lat: c[1], houseNumber: number, match: number ? "address" : p.type === "street" ? "street" : "place" });
  }
  return places;
}

export function missingAddressMessage(query: string) {
  return requestedHouseNumber(query)
    ? "That building number wasn’t found in the address data. Try the street without the number, a nearby intersection, or add the city."
    : /\s(?:&|and|at)\s/i.test(query)
      ? "That intersection wasn’t found. Try both full street names and the city, or a nearby street address."
      : "No matching addresses or places found. Try the full street name and city.";
}