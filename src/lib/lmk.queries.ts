import { queryOptions } from "@tanstack/react-query";
import { getDemo } from "./lmk.functions";
import { getOfficialIncidents } from "./incidents.functions";
import { INCIDENT_REFRESH_MS } from "./incident-source";
import { availableDemoContent } from "./demo-content";

export const demoOptions = queryOptions({ queryKey: ["demo"], queryFn: async () => {
  try { return await getDemo(); }
  catch { return availableDemoContent({ stops: [], incidents: [], contacts: [], routes: [] }, true); }
} });
export const incidentOptions = queryOptions({ queryKey: ["official-incidents"], queryFn: () => getOfficialIncidents(), staleTime: INCIDENT_REFRESH_MS, refetchInterval: INCIDENT_REFRESH_MS });