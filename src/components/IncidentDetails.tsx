import { formatReportTime } from "@/lib/incident-source";
import type { Incident } from "@/lib/walk";

export function IncidentDetails({ incident }: { incident: Incident }) {
  return <article className="border-b border-border py-4 last:border-0">
    <h3 className="text-sm font-semibold">{incident.description}</h3>
    <p className="mt-1 text-xs text-muted-foreground">SFPD incident #{incident.sourceRecordId} · approximate location</p>
    <dl className="mt-3 space-y-2 text-xs">
      <div><dt className="font-medium">Source</dt><dd><a className="text-primary underline underline-offset-2" href={incident.sourceUrl} target="_blank" rel="noopener noreferrer">{incident.sourceName}</a></dd></div>
      <div><dt className="font-medium">Last updated by source</dt><dd><time dateTime={incident.sourceUpdatedAt ?? undefined}>{formatReportTime(incident.sourceUpdatedAt)}</time></dd></div>
      <div><dt className="font-medium">Incident time</dt><dd><time dateTime={incident.occurredAt}>{formatReportTime(incident.occurredAt)}</time></dd></div>
    </dl>
  </article>;
}