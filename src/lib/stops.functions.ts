import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
export const getRouteBusinesses = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ coordinates: z.array(z.tuple([z.number().min(-122.53).max(-122.34), z.number().min(37.69).max(37.85)])).min(2).max(3000) }).parse(input))
  .handler(async ({ data }) => {
    const { fetchRouteBusinesses } = await import("./stops.server");
    return fetchRouteBusinesses(data.coordinates);
  });