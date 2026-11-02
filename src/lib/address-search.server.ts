import { normalizeAddressResults, missingAddressMessage, type AddressSearchResult } from "./address-search";

export async function lookupAddress(q: string, bias?: [number, number]): Promise<AddressSearchResult> {
  const center = bias ?? [-122.40785, 37.78443];
  const url = new URL("https://photon.komoot.io/api/");
  url.searchParams.set("q", q.trim());
  url.searchParams.set("lat", String(center[1]));
  url.searchParams.set("lon", String(center[0]));
  url.searchParams.set("location_bias_scale", "0.4");
  url.searchParams.set("limit", "12");
  url.searchParams.set("lang", "en");
  // Bias only: don't discard Oakland, Berkeley, or other matching addresses.
  try {
    const response = await fetch(url, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(10000) });
    if (!response.ok) throw new Error(`Search unavailable (${response.status})`);
    const places = normalizeAddressResults(await response.json(), q);
    return { places, status: places.length ? "ready" : "empty", message: places.length ? (/\s(?:&|and|at)\s/i.test(q) ? "Nearby named places are shown; crossing points may be approximate." : "") : missingAddressMessage(q) };
  } catch {
    return { places: [], status: "error", message: "Address search couldn’t connect. Please try again in a moment." };
  }
}