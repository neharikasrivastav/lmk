import { useEffect, useRef } from "react";
import * as maplibregl from "maplibre-gl";
import type { WalkRoute } from "@/lib/geo.functions";
import type { Incident, Stop } from "@/lib/walk";
import { formatReportTime } from "@/lib/incident-source";

type Props = {
  user: [number, number] | null;
  dest: [number, number] | null;
  routes: WalkRoute[];
  selected: number;
  onSelect: (id: number) => void;
  incidents?: Incident[];
  stops?: Stop[];
  onStop?: (stop: Stop) => void;
  onIncident?: (incident: Incident) => void;
};

// Map styles need rgb, so resolve the theme's oklch token through a canvas.
function cssVar(name: string) {
  const raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  const ctx = document.createElement("canvas").getContext("2d");
  if (!ctx) return raw;
  ctx.fillStyle = raw;
  ctx.fillRect(0, 0, 1, 1);
  const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
  return `rgb(${r}, ${g}, ${b})`;
}

export default function BudMap({
  user,
  dest,
  routes,
  selected,
  onSelect,
  incidents = [],
  stops = [],
  onStop,
  onIncident,
}: Props) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const userMarker = useRef<maplibregl.Marker | null>(null);
  const destMarker = useRef<maplibregl.Marker | null>(null);
  const centered = useRef(false);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  useEffect(() => {
    if (!el.current) return;
    const m = new maplibregl.Map({
      container: el.current,
      style: "https://tiles.openfreemap.org/styles/positron",
      center: [-122.405, 37.785],
      zoom: 15,
      attributionControl: { compact: true },
    });
    map.current = m;
    m.on("load", () => {
      m.addSource("routes", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
      m.addLayer({
        id: "routes-alt",
        type: "line",
        source: "routes",
        filter: ["!=", ["get", "selected"], true],
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": cssVar("--route-alt"), "line-width": 6, "line-opacity": 0.8 },
      });
      m.addLayer({
        id: "routes-main",
        type: "line",
        source: "routes",
        filter: ["==", ["get", "selected"], true],
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": cssVar("--primary"), "line-width": 7 },
      });
      for (const layer of ["routes-alt", "routes-main"]) {
        m.on("click", layer, (e) => {
          const id = e.features?.[0]?.properties?.["id"];
          if (typeof id === "number") onSelectRef.current(id);
        });
      }
      m.fire("budready");
    });
    return () => {
      m.remove();
      map.current = null;
      userMarker.current = null;
      destMarker.current = null;
      centered.current = false;
    };
  }, []);

  useEffect(() => {
    const m = map.current;
    if (!m || !user) return;
    if (!userMarker.current) {
      const d = document.createElement("div");
      d.className = "user-dot";
      userMarker.current = new maplibregl.Marker({ element: d }).setLngLat(user).addTo(m);
    } else userMarker.current.setLngLat(user);
    if (!centered.current) {
      centered.current = true;
      m.easeTo({
        center: user,
        zoom: 15,
        offset: window.innerWidth < 768 ? [0, -window.innerHeight * 0.2] : [150, 0],
      });
    }
  }, [user]);

  useEffect(() => {
    const m = map.current;
    if (!m) return;
    destMarker.current?.remove();
    destMarker.current = null;
    if (dest) {
      const d = document.createElement("div");
      d.className = "dest-pin";
      destMarker.current = new maplibregl.Marker({ element: d }).setLngLat(dest).addTo(m);
    }
  }, [dest]);

  useEffect(() => {
    const m = map.current;
    if (!m) return;
    const markers: maplibregl.Marker[] = [];
    incidents.forEach((i) => {
      const el = document.createElement("div");
      el.className = "map-incident";
      el.title = i.sourceName ? `${i.description} · ${i.sourceName} · updated ${formatReportTime(i.sourceUpdatedAt)}` : `Demo: ${i.description} · ${i.minutes_ago} min ago (illustrative)`;
      el.tabIndex = 0;
      el.setAttribute("role", "button");
      el.addEventListener("click", () => onIncident?.(i));
      el.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onIncident?.(i); }
      });
      markers.push(new maplibregl.Marker({ element: el }).setLngLat([i.lng, i.lat]).addTo(m));
      el.setAttribute("aria-label", i.sourceName ? `View report: ${i.description}, SFPD incident ${i.sourceRecordId}` : `Demo report: ${i.description}`);
    });
    stops.forEach((s) => {
      const el = document.createElement("div");
      el.className = "map-stop";
      el.textContent = s.verified ? "✓" : "☕";
      el.title = `${s.name} · ${s.demo === false ? "OpenStreetMap listing" : `demo ${s.verified ? "verified partner" : "stop"}`}`;
      el.addEventListener("click", () => onStop?.(s));
      markers.push(new maplibregl.Marker({ element: el }).setLngLat([s.lng, s.lat]).addTo(m));
    });
    return () => markers.forEach((marker) => marker.remove());
  }, [incidents, stops, onStop, onIncident]);

  useEffect(() => {
    const m = map.current;
    if (!m) return;
    const apply = () => {
      const src = m.getSource("routes") as maplibregl.GeoJSONSource | undefined;
      if (!src) return;
      src.setData({
        type: "FeatureCollection",
        features: routes.map((r) => ({
          type: "Feature",
          properties: { id: r.id, selected: r.id === selected },
          geometry: { type: "LineString", coordinates: r.coordinates },
        })),
      });
      if (routes.length) {
        const b = new maplibregl.LngLatBounds();
        routes.forEach((r) => r.coordinates.forEach((c) => b.extend(c)));
        const desktop = window.innerWidth >= 768;
        m.fitBounds(b, {
          padding: {
            top: 100,
            left: desktop ? 470 : 35,
            right: 40,
            bottom: desktop ? 80 : Math.min(360, window.innerHeight * 0.43),
          },
          duration: 600,
        });
      }
    };
    if (m.getSource("routes")) apply();
    else m.once("budready", apply);
  }, [routes, selected]);

  return (
    <div className="absolute inset-0">
      <div ref={el} className="h-full w-full" />
    </div>
  );
}
