import { createServerFn } from "@tanstack/react-start";

export const getOfficialIncidents = createServerFn({ method: "GET" }).handler(async () => {
  const { readOfficialIncidents } = await import("./incidents.server");
  return readOfficialIncidents();
});