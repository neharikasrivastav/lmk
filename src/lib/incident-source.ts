import type { Incident } from "./walk";

export const INCIDENT_SOURCE_NAME = "SFPD · DataSF";
export const INCIDENT_SOURCE_URL = "https://data.sf.gov/Public-Safety/Police-Department-Incident-Reports-2018-to-Present/wg3w-h783";
export const INCIDENT_API_URL = "https://data.sf.gov/resource/wg3w-h783.json";
export const INCIDENT_REFRESH_MS = 5 * 60 * 1000;
export type IncidentFeed = {
  incidents: Incident[];
  status: "available" | "stale" | "unavailable";
  fetchedAt: string | null;
  datasetUpdatedAt: string | null;
  message: string;
};

// DataSF floating datetimes are San Francisco local time, not UTC.
export function sourceLocalTime(value: unknown): string | null {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?$/.test(value)) return null;
  const naive = Date.parse(`${value}Z`);
  if (!Number.isFinite(naive)) return null;
  const summerGuess = new Date(naive + 7 * 3600000);
  const zone = new Intl.DateTimeFormat("en-US", { timeZone: "America/Los_Angeles", timeZoneName: "shortOffset" }).formatToParts(summerGuess).find((part) => part.type === "timeZoneName")?.value;
  return new Date(naive + (zone === "GMT-7" ? 7 : 8) * 3600000).toISOString();
}

const behaviors: Record<string, string> = {
  Assault: "Assault reported",
  Robbery: "Robbery reported",
  Burglary: "Burglary reported",
  "Larceny Theft": "Theft reported",
  "Malicious Mischief": "Property damage reported",
  Arson: "Arson reported",
  "Weapons Offense": "Weapons-related incident reported",
  "Weapons Carrying Etc": "Weapons-related incident reported",
  "Disorderly Conduct": "Disorderly behavior reported",
};

export function normalizeOfficialReports(rows: unknown, fetchedAt: string): Incident[] {
  if (!Array.isArray(rows)) throw new Error("Invalid incident feed");
  const reports = new Map<string, Incident>();
  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    const r = row as Record<string, unknown>;
    const category = typeof r["incident_category"] === "string" ? r["incident_category"] : "";
    const description = behaviors[category];
    const lat = Number(r["latitude"]), lng = Number(r["longitude"]);
    const occurredAt = sourceLocalTime(r["incident_datetime"]);
    const updated = r["record_updated_at"];
    const sourceUpdatedAt = typeof updated === "string" && /(?:Z|[+-]\d{2}:\d{2})$/.test(updated) && Number.isFinite(Date.parse(updated)) ? new Date(updated).toISOString() : null;
    const id = r["incident_id"];
    if (!description || typeof id !== "string" || !/^\d+$/.test(id) || !occurredAt || lat < 37.7 || lat > 37.84 || lng < -122.52 || lng > -122.35 || !Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    if (Date.parse(occurredAt) > Date.parse(fetchedAt)) continue;
    const report: Incident = {
      id: `sfpd-${id}`, type: category, description, lat, lng,
      severity: 0, minutes_ago: Math.floor((Date.parse(fetchedAt) - Date.parse(occurredAt)) / 60000),
      occurredAt, sourceUpdatedAt, fetchedAt, sourceName: INCIDENT_SOURCE_NAME,
      sourceUrl: `${INCIDENT_SOURCE_URL}?$where=${encodeURIComponent(`incident_id='${id}'`)}`,
      sourceRecordId: id,
    };
    const previous = reports.get(report.id);
    if (!previous || (sourceUpdatedAt ?? "") > (previous.sourceUpdatedAt ?? "")) reports.set(report.id, report);
  }
  return [...reports.values()].sort((a, b) => (b.occurredAt ?? "").localeCompare(a.occurredAt ?? ""));
}

export function formatReportTime(value: string | null | undefined): string {
  if (!value || !Number.isFinite(Date.parse(value))) return "Not supplied by source";
  return new Intl.DateTimeFormat("en-US", { timeZone: "America/Los_Angeles", month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit", timeZoneName: "short" }).format(new Date(value));
}