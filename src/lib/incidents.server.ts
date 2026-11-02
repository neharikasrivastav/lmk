import { INCIDENT_API_URL, INCIDENT_REFRESH_MS, normalizeOfficialReports, type IncidentFeed } from "./incident-source";

let cached: IncidentFeed | null = null;
let pending: Promise<IncidentFeed> | null = null;

async function refresh(): Promise<IncidentFeed> {
  try {
    const now = new Date();
    const since = new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Los_Angeles", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" }).format(new Date(now.getTime() - 7 * 86400000)).replace(" ", "T");
    const url = new URL(INCIDENT_API_URL);
    url.searchParams.set("$select", "incident_id,incident_datetime,incident_category,latitude,longitude,:updated_at as record_updated_at");
    url.searchParams.set("$where", `incident_datetime >= '${since}' AND latitude between 37.70 and 37.84 AND longitude between -122.52 and -122.35`);
    url.searchParams.set("$order", "incident_datetime DESC,row_id ASC");
    url.searchParams.set("$limit", "5000");
    const [response, metadataResponse] = await Promise.all([
      fetch(url, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(12000) }),
      fetch("https://data.sf.gov/api/views/wg3w-h783.json", { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(12000) }),
    ]);
    if (!response.ok || !metadataResponse.ok) throw new Error("Official feed unavailable");
    const [rows, metadata] = await Promise.all([response.json(), metadataResponse.json()]) as [unknown, { rowsUpdatedAt?: number }];
    const fetchedAt = new Date().toISOString();
    cached = {
      incidents: normalizeOfficialReports(rows, fetchedAt), status: "available", fetchedAt,
      datasetUpdatedAt: typeof metadata.rowsUpdatedAt === "number" ? new Date(metadata.rowsUpdatedAt * 1000).toISOString() : null,
      message: Array.isArray(rows) && rows.length >= 5000 ? "Results are limited to the newest 5,000 source rows." : "Police reports from the past 7 days. Published daily, with reporting delays; locations are approximate. Not live alerts or a measure of current conditions.",
    };
    return cached;
  } catch {
    return cached ? { ...cached, status: "stale", message: "The source could not refresh. Showing the last retrieved reports; current conditions are unknown." } : {
      incidents: [], status: "unavailable", fetchedAt: null, datasetUpdatedAt: null,
      message: "Official reports are unavailable. No illustrative reports are shown; current conditions are unknown.",
    };
  }
}

export async function readOfficialIncidents(): Promise<IncidentFeed> {
  if (cached?.fetchedAt && Date.now() - Date.parse(cached.fetchedAt) < INCIDENT_REFRESH_MS) return cached;
  if (pending) return pending;
  pending = refresh();
  try { return await pending; } finally { pending = null; }
}