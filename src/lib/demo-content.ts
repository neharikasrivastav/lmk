import type { DemoRoute, Incident, Stop } from "./walk";

export type DemoContent = {
  stops: Stop[];
  incidents: Incident[];
  contacts: string[];
  routes: DemoRoute[];
  error: string | null;
};

export function availableDemoContent(content: Omit<DemoContent, "error">, failed = false): DemoContent {
  const routes = content.routes.filter((route) => route.coordinates.length >= 2 && route.durationS > 0);
  return {
    ...content,
    routes,
    error: failed || routes.length === 0
      ? "The demo isn’t ready right now. We’ll try live directions instead."
      : null,
  };
}