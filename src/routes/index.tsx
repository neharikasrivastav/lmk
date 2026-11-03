import { createFileRoute, Link } from "@tanstack/react-router";
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowLeft,
  ArrowUpRight,
  Check,
  ChevronRight,
  Coffee,
  Copy,
  Footprints,
  Heart,
  LocateFixed,
  Menu,
  MessageCircle,
  Navigation,
  Play,
  Search,
  Send,
  ShieldCheck,
  X,
  Moon,
  Phone,
  Pause,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { createTrip, updateTrip, askCompanion } from "@/lib/lmk.functions";
import { getWalkingRoutes, type Place } from "@/lib/geo.functions";
import { useAddressSearch } from "@/lib/use-address-search";
import { demoOptions, incidentOptions } from "@/lib/lmk.queries";
import { formatReportTime, INCIDENT_SOURCE_NAME, INCIDENT_SOURCE_URL } from "@/lib/incident-source";
import { IncidentDetails } from "@/components/IncidentDetails";
import { rankedRoutes, calmerReason, extraMinutes, visibleDemoIncidents, nearbyRouteStops, alertAhead } from "@/lib/route-demo";
import { optionalShare } from "@/lib/walk-start";
import { getRouteBusinesses } from "@/lib/stops.functions";
import { shareLink } from "@/lib/share-link";
import { nearestCompanionStops, needsStop, stopGuidance } from '@/lib/companion-stops';
import { applySafetyRules, type CompanionAction } from '@/lib/companion-safety';
import { Message, MessageContent, MessageResponse } from '@/components/ai-elements/message';
import { CONTACTS_STORAGE_KEY, DEMO_CONTACTS, parseStoredContacts, shareMessageUrl, type WalkContact } from '@/lib/walk-contacts';
import {
  START,
  PARK,
  DEMO_SECONDS,
  ALERT_PROGRESS,
  routeReports,
  reportsLabel,
  remainingRoute,
  routePosition,
  sortedStops,
  distance,
  fmtDistance,
  hasArrived,
  type Coord,
  type DemoRoute,
  type Stop,
  type Incident,
} from "@/lib/walk";
const Map = lazy(() => import("@/components/BudMap"));
export const Route = createFileRoute("/")({
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData(demoOptions);
  },
  head: () => ({
    meta: [
      { title: "Lmk — lmk when you get home, handled." },
      {
        name: "description",
        content:
          "Your San Francisco walking companion. Calmer routes, verified stops and a shared walk home.",
      },
      { property: "og:title", content: "Lmk — Your walk home, together" },
      {
        property: "og:description",
        content: "Calmer routes, a little company, and someone in the loop.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Home,
});
type Panel = "home" | "routes" | "share" | "walk" | "stops" | "chat" | "arrival" | "menu" | "reports";
function Home() {
  const { data } = useSuspenseQuery(demoOptions);
  const [policeLayer, setPoliceLayer] = useState(false);
  const policeQuery = useQuery({ ...incidentOptions, enabled: policeLayer });
  const incidentFeed = policeQuery.data ?? { incidents: [], message: "Turn on police reports to load official source data.", fetchedAt: null, datasetUpdatedAt: null, status: "unavailable" };
  const refreshReports = policeQuery.refetch, refreshingReports = policeQuery.isFetching;
  const [walkStarted, setWalkStarted] = useState(false);
  const [shareBusy, setShareBusy] = useState(false);
  const [alert, setAlert] = useState<Incident | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [businesses, setBusinesses] = useState<Stop[]>([]);
  const [stopsBusy, setStopsBusy] = useState(false);
  const [stopsError, setStopsError] = useState("");
  const [stopsAttempt, setStopsAttempt] = useState(0);
  const journey = useRef<{ destination: string; dest: Coord; route: DemoRoute } | null>(null);
  const [focusedIncident, setFocusedIncident] = useState<Incident | null>(null);
  const [mounted, setMounted] = useState(false),
    [panel, setPanel] = useState<Panel>("home"),
    [expanded, setExpanded] = useState(false),
    [position, setPosition] = useState<Coord>(START),
    [routes, setRoutes] = useState<DemoRoute[]>([]),
    [selected, setSelected] = useState(1),
    [destination, setDestination] = useState("Salesforce Park"),
    [dest, setDest] = useState<Coord>(PARK),
    [query, setQuery] = useState(""),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState(data.error ?? ""),
    [sharing, setSharing] = useState(true),
    [contacts, setContacts] = useState(["Mom"]),
    [savedContacts, setSavedContacts] = useState<WalkContact[]>([]),
    [trip, setTrip] = useState<{ token: string; owner: string } | null>(null),
    [progress, setProgress] = useState(0),
    [running, setRunning] = useState(false),
    [checkins, setCheckins] = useState<string[]>([]),
    [stopTarget, setStopTarget] = useState<Stop | null>(null),
    [isDemo, setIsDemo] = useState(true),
    [chatInput, setChatInput] = useState(""),
    [messages, setMessages] = useState<{ role: 'you' | 'lmk'; text: string; actions?: CompanionAction[] }[]>([]),
    [chatBusy, setChatBusy] = useState(false),
    [chatError, setChatError] = useState("");
  const startTrip = useServerFn(createTrip),
    sync = useServerFn(updateTrip),
    getRoutes = useServerFn(getWalkingRoutes),
    loadBusinesses = useServerFn(getRouteBusinesses),
    ask = useServerFn(askCompanion);
  const { results, state: searchState, message: searchMessage, retry: retrySearch } = useAddressSearch(query, position);
  const route = routes.find((r) => r.id === selected) ?? routes[0];
  const reports = [...incidentFeed.incidents].sort((a, b) => distance(position, [a.lng, a.lat]) - distance(position, [b.lng, b.lat]));
  const sorted = sortedStops(nearbyRouteStops(route, [...data.stops, ...businesses]), position);
  const rank = useMemo(() => rankedRoutes(routes, data.incidents), [routes, data.incidents]);
  const demoDots = useMemo(() => visibleDemoIncidents(route, data.incidents), [route, data.incidents]);
  const routeReason = useMemo(() => calmerReason(routes, data.incidents), [routes, data.incidents]);
  const nearest = sorted.find((s) => s.verified);
  const companionStops = nearestCompanionStops(data.stops, position);
  const nearestCompanion = companionStops[0];
  const link = mounted && trip ? shareLink(trip.token) : "";
  const progressRef = useRef(progress);
  progressRef.current = progress;
  const drag = useRef(0),
    lastSync = useRef(0),
    inFlight = useRef(false),
    geoWatch = useRef<number | null>(null),
    current = useRef({ route, dest, trip, sharing, checkins, destination, isDemo });
  current.current = { route, dest, trip, sharing, checkins, destination, isDemo };
  const allContacts = [...DEMO_CONTACTS, ...savedContacts];
  useEffect(() => {
    setSavedContacts(parseStoredContacts(localStorage.getItem(CONTACTS_STORAGE_KEY)));
  }, []);
  useEffect(() => {
    setMounted(true);
    return () => {
      if (geoWatch.current !== null) navigator.geolocation.clearWatch(geoWatch.current);
    };
  }, []);
  useEffect(() => {
    let active = true;
    setBusinesses([]);
    setStopsError("");
    setStopsBusy(false);
    if (!route || panel !== "stops" || nearbyRouteStops(route, data.stops).length >= 3) return;
    setStopsBusy(true);
    void loadBusinesses({ data: { coordinates: route.coordinates } }).then((result) => {
      if (active) { setBusinesses(result.stops); setStopsError(result.error ?? ""); }
    }).catch(() => { if (active) setStopsError("Nearby businesses couldn’t load."); }).finally(() => { if (active) setStopsBusy(false); });
    return () => { active = false; };
  }, [route, panel, stopsAttempt]);
  async function persist(
    p: Coord,
    value: number,
    status: "walking" | "paused" | "arrived" | "ended",
    force = false,
  ) {
    const c = current.current;
    if (!c.trip || !c.route || (!force && Date.now() - lastSync.current < 2000)) return;
    if (inFlight.current) {
      if (force) setTimeout(() => void persist(p, value, status, true), 500);
      return;
    }
    inFlight.current = true;
    lastSync.current = Date.now();
    try {
      const result = await sync({
        data: {
          ...c.trip,
          position: p,
          progress: value,
          status,
          destination: c.destination,
          destinationCoords: c.dest,
          route: c.route.coordinates,
          duration: c.route.durationS,
          checkins: c.checkins,
          sharing: c.sharing,
        },
      });
      if (result.token !== c.trip.token)
        setTrip((old) => (old ? { ...old, token: result.token } : old));
    } catch {
      setNotice("Shared walk could not update. Check your connection.");
    } finally {
      inFlight.current = false;
    }
  }
  useEffect(() => {
    if (!running || !route) return;
    const startedAt = Date.now();
    const startingProgress = progressRef.current;
    const id = setInterval(() => {
      const next = Math.min(1, startingProgress + (Date.now() - startedAt) / (DEMO_SECONDS * 1000));
      progressRef.current = next;
      setProgress(next);
      const p = routePosition(route, next);
      setPosition(p);
      if (next >= ALERT_PROGRESS && !dismissed && !stopTarget) {
        setAlert(alertAhead(route, next, data.incidents));
        setDismissed(true);
        setRunning(false);
      }
      if (next >= 1 || hasArrived(p, dest)) {
        clearInterval(id);
        setRunning(false);
        progressRef.current = 1;
        setProgress(1);
        if (stopTarget) {
          const c = `Lmk: Neha stopped at ${stopTarget.name.replace(" · ", ", ")}`;
          setCheckins((old) => (old.includes(c) ? old : [...old, c]));
          setPanel("walk");
          setNotice("You’re at your stop. Your shared viewer will see your check-in.");
          setStopTarget(null);
          void persist(p, 1, "paused", true);
        } else {
          setPanel("arrival");
          setCheckins((old) =>
            old.includes("Home 💜 Neha arrived.") ? old : [...old, "Home 💜 Neha arrived."],
          );
          void persist(p, 1, "arrived", true);
        }
        return;
      }
      void persist(p, next, "walking");
    }, 250);
    return () => clearInterval(id);
  }, [running, route, dest, stopTarget, dismissed]);
  useEffect(() => {
    if (!trip || !route) return;
    void persist(
      position,
      progress,
      panel === "arrival" ? "arrived" : running ? "walking" : "paused",
      true,
    );
  }, [sharing, checkins]);
  async function demo() {
    setIsDemo(true);
    setPosition(START);
    const ranked = rankedRoutes(data.routes.filter((r) => r.id < 2), data.incidents);
    setRoutes(ranked.routes);
    setSelected(ranked.calmerId);
    setDestination("Salesforce Park");
    setDest(PARK);
    setPanel(ranked.routes.length ? "routes" : "home");
    setQuery("");
    setNotice(data.error ?? "");
    setProgress(0);
    if (!ranked.routes.length) {
      await choosePlace({ id: "salesforce-park", match: "place", name: "Salesforce Park", address: "San Francisco, CA", lng: PARK[0], lat: PARK[1] }, START);
    }
  }
  async function choosePlace(p: Place, from = position) {
    setBusy(true);
    setNotice(data.error ?? "");
    setQuery("");
    try {
      const r = await getRoutes({ data: { from, to: [p.lng, p.lat] } });
      if (!r.routes.length) throw new Error();
      const ranked = rankedRoutes(r.routes.map((v) => ({ ...v, name: "" })), data.incidents);
      setRoutes(ranked.routes);
      setSelected(ranked.calmerId);
      setDest([p.lng, p.lat]);
      setDestination(p.name);
      setPanel("routes");
    } catch {
      setPanel("home");
      setNotice("Directions couldn’t load right now. Please try again or choose another destination.");
    } finally {
      setBusy(false);
    }
  }
  function locate() {
    setNotice("Finding your location…");
    if (!navigator.geolocation) {
      setNotice("Location isn’t available. The Powell St demo is ready.");
      return;
    }
    if (geoWatch.current !== null) navigator.geolocation.clearWatch(geoWatch.current);
    geoWatch.current = navigator.geolocation.watchPosition(
      (p) => {
        const loc: Coord = [p.coords.longitude, p.coords.latitude];
        if (loc[0] < -122.52 || loc[0] > -122.35 || loc[1] < 37.7 || loc[1] > 37.84) {
          setNotice("Lmk currently covers San Francisco. Showing the Powell St demo.");
          return;
        }
        setPosition(loc);
        setIsDemo(false);
        setNotice("Using your live location.");
        if (current.current.trip && hasArrived(loc, current.current.dest)) {
          setRunning(false);
          setPanel("arrival");
          void persist(loc, 1, "arrived", true);
        } else void persist(loc, progress, "walking");
      },
      () => setNotice("Location is off. The Powell St demo is ready."),
      { enableHighAccuracy: true },
    );
  }
  async function begin() {
    if (!route) return;
    setWalkStarted(true);
    setPanel("walk");
    setProgress(0);
    setCheckins([]);
    setDismissed(false);
    setAlert(null);
    setMessages([]);
    journey.current = { destination, dest, route };
    if (sharing) void createShare();
  }
  async function createShare() {
    const c = current.current;
    if (!c.route || shareBusy) return;
    const selectedRoute = c.route;
    setShareBusy(true);
    const t = await optionalShare(() => startTrip({
        data: {
          destination: c.destination.slice(0, 100),
          destinationCoords: c.dest,
          route: selectedRoute.coordinates,
          duration: Math.round(selectedRoute.durationS),
          position,
          sharing: true,
          demo: isDemo,
        },
      }));
    if (t) {
      setTrip(t);
      setSharing(true);
      setPanel((p) => p === "walk" ? "share" : p);
    } else {
      setNotice("Your walk has started. Sharing couldn’t connect; you can try Share link again anytime.");
    }
    setShareBusy(false);
  }
  async function stopAt(s: Stop) {
    if (!stopTarget && route) journey.current = { destination, dest, route };
    setBusy(true);
    try {
      let v: DemoRoute;
      if (isDemo && s.walking_route && s.walking_route.length > 1) {
        const coordinates = remainingRoute(s.walking_route, position);
        const distanceM = coordinates
          .slice(1)
          .reduce((sum, c, i) => sum + distance(coordinates[i] ?? position, c), 0);
        v = {
          id: 4,
          name: "To your stop",
          coordinates,
          distanceM,
          durationS: Math.max(60, Math.round(distanceM / 1.2)),
        };
      } else {
        const r = await getRoutes({ data: { from: position, to: [s.lng, s.lat] } });
        const first = r.routes[0];
        if (!first) throw new Error();
        v = { ...first, id: 4, name: "To your stop" };
      }
      setRoutes([v]);
      setSelected(4);
      setDestination(s.name);
      setDest([s.lng, s.lat]);
      setStopTarget(s);
      setProgress(0);
      setRunning(false);
      setAlert(null);
      setDismissed(true);
      setPanel(walkStarted ? "walk" : "routes");
      setNotice("Route changed to your stop. Check-in appears when you arrive.");
    } catch {
      setNotice("Could not find the stop route. Your current route is unchanged.");
    } finally {
      setBusy(false);
    }
  }
  async function chat(text: string) {
    if (!text.trim() || chatBusy) return;
    setChatInput("");
    setChatBusy(true);
    setChatError("");
    setMessages((m) => [...m, { role: "you", text }]);
    const history = messages.map(({ role, text }) => ({ role, text }));
    const walk = { active: walkStarted, sharing: Boolean(trip), canReroute: rank.routes.some((r) => r.id !== selected) };
    try {
      const r = await ask({ data: { message: text, position, destination, history, walk } });
      if (r.error) setChatError(r.error);
      setMessages((m) => [...m, { role: "lmk", text: `${r.error ? 'Scripted response: ' : ''}${r.text}`, actions: r.actions }]);
    } catch {
      // Offline: the same guardrails still give the nearest stop, an alert and 911.
      setChatError("The companion could not connect.");
      const stop = needsStop(text, history) ? nearestCompanion : undefined;
      const scripted = applySafetyRules({ text: '', actions: stop ? [{ type: 'go_to_stop', stop }] : [], message: text, history, nearest: nearestCompanion, walk });
      setMessages((m) => [...m, { role: "lmk", text: `Scripted response: ${scripted.text}`, actions: scripted.actions }]);
    } finally {
      setChatBusy(false);
    }
  }
  function back() {
    setPanel(walkStarted ? "walk" : routes.length ? "routes" : "home");
  }
  async function continueJourney() {
    const saved = journey.current;
    if (!saved) return;
    setBusy(true);
    try {
      if (isDemo) {
        const coordinates = remainingRoute(saved.route.coordinates, position);
        setRoutes([{ ...saved.route, coordinates }]); setSelected(saved.route.id);
        setDestination(saved.destination); setDest(saved.dest); setProgress(0);
        setPanel("walk"); setNotice(""); setStopTarget(null);
        return;
      }
      const result = await getRoutes({ data: { from: position, to: saved.dest } });
      const first = result.routes[0];
      if (!first) throw new Error();
      setRoutes([{ ...first, name: "Calmer" }]); setSelected(first.id);
      setDestination(saved.destination); setDest(saved.dest); setProgress(0);
      setPanel("walk"); setNotice(""); setStopTarget(null);
    } catch { setNotice("The onward route couldn’t load. Please try again."); }
    finally { setBusy(false); }
  }
  function rerouteDemo() {
    const alternatives = rank.routes.filter((r) => r.id !== selected);
    const next = alternatives[0];
    if (next) {
      setRoutes([{ ...next, coordinates: remainingRoute(next.coordinates, position) }]);
      setSelected(next.id); setProgress(0);
    }
    setAlert(null); setDismissed(true); setRunning(true);
  }
  function sms(alertContact = false) {
    const text = alertContact
      ? `I’d like some company. My current location: ${position[1].toFixed(5)}, ${position[0].toFixed(5)}.${link ? ` Follow my Lmk: ${link}` : ''}`
      : `Walking home 💜 follow my Lmk: ${link}`;
    window.location.href = shareMessageUrl(contacts, text, allContacts);
  }
  return (
    <main className="relative h-dvh w-full overflow-hidden bg-background">
      {mounted && (
        <Suspense fallback={null}>
          <Map
            user={position}
            dest={routes.length ? dest : null}
            routes={routes}
            selected={selected}
            onSelect={setSelected}
            incidents={policeLayer ? incidentFeed.incidents : demoDots}
            onIncident={(incident) => { if (incident.sourceName) { setFocusedIncident(incident); setPanel("reports"); } else setNotice(`Demo report: ${incident.description} · ${incident.minutes_ago} min ago (illustrative)`); }}
            stops={sorted.filter((s) => s.verified || panel === "stops")}
            onStop={stopAt}
          />
        </Suspense>
      )}
      <header className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between p-5 md:p-7">
        <div className="pointer-events-auto rounded-2xl bg-card/95 px-5 py-4 shadow-float">
          <div className="lmk-logo flex items-center gap-2">
            lmk
            <Heart className="size-5 fill-accent-foreground text-accent-foreground" />
          </div>
          <p className="mt-2 text-xs text-muted-foreground">lmk when you get home, handled.</p>
        </div>
        <Button
          variant="secondary"
          size="icon"
          className="pointer-events-auto size-12 rounded-full shadow-float"
          onClick={() => setPanel("menu")}
          aria-label="Open menu"
        >
          <Menu />
        </Button>
      </header>
      <div className="absolute right-5 top-32 flex flex-col gap-3">
        <Button
          variant="secondary"
          size="icon"
          className="size-12 rounded-full shadow-float"
          onClick={locate}
          aria-label="Use my location"
          title="Use my location"
        >
          <LocateFixed />
        </Button>
        <Button
          variant="secondary"
          size="icon"
          className="size-12 rounded-full shadow-float"
          onClick={() => setPanel("stops")}
          aria-label="Verified stops"
          title="Verified stops"
        >
          <Coffee />
        </Button>
      </div>
      <section className={`lmk-sheet ${expanded ? "min-h-[65dvh]" : ""}`}>
        <div
          onPointerDown={(e) => {
            drag.current = e.clientY;
            e.currentTarget.setPointerCapture(e.pointerId);
          }}
          onPointerUp={(e) => {
            if (drag.current - e.clientY > 20) setExpanded(true);
            else if (e.clientY - drag.current > 20) setExpanded(false);
          }}
          className="flex h-7 touch-none items-center justify-center"
          aria-label="Drag to expand sheet"
        >
          <span className="h-1 w-10 rounded-full bg-border" />
        </div>
        <div className="lmk-inner">
          {notice && (
            <div
              role="status"
              className="mb-3 flex items-start justify-between gap-2 rounded-lg bg-muted p-3 text-xs text-muted-foreground"
            >
              <span>{notice}</span>
              <Button
                variant="ghost"
                size="icon"
                className="size-5 shrink-0"
                aria-label="Dismiss notice"
                onClick={() => setNotice("")}
              >
                <X />
              </Button>
            </div>
          )}
          {panel === "home" && (
            <>
              <p className="mb-2 flex items-center gap-2 text-xs font-medium text-muted-foreground">
                <Moon className="size-3" />
                SAN FRANCISCO · YOUR WALK, TOGETHER
              </p>
              <h2>
                Where are you walking
                <br />
                tonight?
              </h2>
              <label className="mb-5 mt-5 flex h-14 items-center gap-3 rounded-xl border border-border bg-background px-4">
                <Search className="size-5 text-muted-foreground" />
                <input
                  aria-label="Search destination"
                  placeholder="A place, an address, home…"
                  value={query}
                  maxLength={120}
                  autoComplete="off"
                  onChange={(e) => setQuery(e.target.value)}
                  className="w-full bg-transparent text-sm outline-none"
                />
                {query && (
                  <Button
                    size="icon"
                    variant="ghost"
                    className="size-7"
                    onClick={() => setQuery("")}
                    aria-label="Clear search"
                  >
                    <X />
                  </Button>
                )}
              </label>
              <div aria-live="polite" aria-busy={searchState === "searching"}>
                {searchState === "searching" && <p className="mb-3 text-sm text-muted-foreground">Searching addresses…</p>}
                {searchMessage && <p className="mb-3 text-sm text-muted-foreground">{searchMessage}</p>}
                {searchState === "error" && <Button variant="ghost" size="sm" onClick={retrySearch}>Try again</Button>}
              </div>
              <div className="max-h-[32dvh] overflow-y-auto">
              {results.map((p) => (
                  <Button
                    key={p.id}
                    variant="ghost"
                    className="tap h-auto w-full justify-between gap-3 py-3 text-left whitespace-normal"
                    onClick={() => choosePlace(p)}
                    disabled={busy}
                  >
                    <span className="min-w-0"><span className="block font-medium">{p.name}</span><span className="mt-1 block text-xs text-muted-foreground">{p.address}</span></span>
                    <ChevronRight className="shrink-0" />
                  </Button>
                ))}
              </div>
              {results.length > 0 && <p className="mt-2 text-xs text-muted-foreground">Address data: Photon · OpenStreetMap</p>}
              {!query && (
                <>
                  <p className="mb-2 text-xs font-semibold text-muted-foreground">
                    A LITTLE INSPIRATION
                  </p>
                  <Button
                    variant="ghost"
                    onClick={() => void demo()}
                    disabled={busy}
                    className="tap h-auto w-full justify-between px-0 py-3"
                  >
                    <span className="flex items-center gap-3">
                      <span className="grid size-11 place-items-center rounded-xl bg-secondary">
                        <Navigation className="text-primary" />
                      </span>
                      <span className="text-left">
                        <span className="block font-semibold">Salesforce Park</span>
                        <span className="text-xs text-muted-foreground">
                          A little green in the city · 18 min
                        </span>
                      </span>
                    </span>
                    <ChevronRight />
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => setPanel("stops")}
                    className="tap h-auto w-full justify-between px-0 py-3"
                  >
                    <span className="flex items-center gap-3">
                      <span className="grid size-11 place-items-center rounded-xl bg-accent">
                        <Coffee className="text-accent-foreground" />
                      </span>
                      <span className="text-left">
                        <span className="block font-semibold">A coffee on the way</span>
                        <span className="text-xs text-muted-foreground">
                          Find a welcoming place to pause
                        </span>
                      </span>
                    </span>
                    <ChevronRight />
                  </Button>
                </>
              )}
              <div className="mt-4 flex items-center justify-between border-t border-border pt-4">
                <span className="text-xs text-muted-foreground">
                  {isDemo ? "Demo · Powell St BART" : "Your live location"}
                </span>
                <Button
                  variant="ghost"
                  onClick={() => setPanel("chat")}
                  className="h-9 text-primary"
                >
                  <MessageCircle />A little company
                </Button>
              </div>
            </>
          )}
          {panel === "routes" && route && (
            <>
              <div className="mb-4 flex items-center gap-3">
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Back to search"
                  onClick={() => {
                    setPanel("home");
                    setRoutes([]);
                  }}
                >
                  <ArrowLeft />
                </Button>
                <div>
                  <p className="text-xs text-muted-foreground">LET’S GET YOU THERE</p>
                  <h2>{destination}</h2>
                </div>
              </div>
              {routes.map((r) => (
                <Button
                  variant={selected === r.id ? "secondary" : "outline"}
                  key={r.id}
                  onClick={() => setSelected(r.id)}
                  className="mb-3 h-auto w-full justify-between rounded-xl px-4 py-4"
                >
                  <span className="flex items-center gap-3">
                    <Footprints />
                    <span className="text-left">
                      <span className="block font-semibold">
                        {r.name}
                        {rank.fastest && r.durationS > rank.fastest.durationS ? ` · +${extraMinutes(r.durationS, rank.fastest.durationS)} min` : ""}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {Math.round(r.durationS / 60)} min · {fmtDistance(r.distanceM)}
                      </span>
                    </span>
                  </span>
                  <span className="shrink-0 text-right"><span className="block font-semibold">{reportsLabel(routeReports(r, data.incidents).length)}</span><span className="text-xs text-muted-foreground">along route · last hour</span></span>
                </Button>
              ))}
              <p className="mb-4 flex items-start gap-2 text-sm text-muted-foreground"><ShieldCheck className="mt-0.5 size-4 shrink-0 text-calm" />{routeReason}</p>
              <label className="my-4 flex items-center justify-between text-sm font-medium">
                Share this walk
                <input
                  aria-label="Share this walk"
                  type="checkbox"
                  checked={sharing}
                  onChange={(e) => setSharing(e.target.checked)}
                  className="size-5 accent-primary"
                />
              </label>
              <Button className="tap w-full rounded-xl" disabled={busy} onClick={begin}>
                {busy ? "Starting…" : "Start my walk"}
                <ArrowUpRight />
              </Button>
              <p className="mt-3 text-center text-xs text-muted-foreground">
                Seeded demo reports · illustrative, not a guarantee of safety
              </p>
            </>
          )}
          {panel === "routes" && !route && (
            <div role="status">
              <h2>Let’s try that again.</h2>
              <p className="my-4 text-sm text-muted-foreground">Directions aren’t available right now. Choose a destination to try live directions.</p>
              <Button onClick={() => setPanel("home")}><ArrowLeft />Back to search</Button>
            </div>
          )}
          {panel === "share" && (
            <>
              <div className="mb-3 flex justify-between">
                <Heart className="size-8 text-accent-foreground" />
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Close share sheet"
                  onClick={() => setPanel("walk")}
                >
                  <X />
                </Button>
              </div>
              <h2>Someone in your corner.</h2>
              <p className="my-3 text-sm text-muted-foreground">
                Keep someone in the loop until you arrive.
              </p>
              <div className="my-5 grid grid-cols-2 gap-3">
                {[...new Set(allContacts.map((c) => c.name))].map((c) => (
                  <Button
                    key={c}
                    variant={contacts.includes(c) ? "secondary" : "outline"}
                    className="h-16 flex-1 flex-col"
                    onClick={() =>
                      setContacts((old) =>
                        old.includes(c) ? old.filter((v) => v !== c) : [...old, c],
                      )
                    }
                  >
                    <span>{c}</span>
                    {contacts.includes(c) && <Check className="size-3" />}
                  </Button>
                ))}
              </div>
              <form
                className="mb-3 flex gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  const f = new FormData(e.currentTarget);
                  const name = String(f.get("name") ?? "").trim().slice(0, 40);
                  const phone = String(f.get("phone") ?? "").replace(/[^\d+]/g, "").slice(0, 16);
                  if (!name || phone.length < 7) return;
                  const next = [...savedContacts.filter((c) => c.name !== name), { name, phone }];
                  setSavedContacts(next);
                  localStorage.setItem(CONTACTS_STORAGE_KEY, JSON.stringify(next));
                  setContacts((old) => [...new Set([...old, name])]);
                  e.currentTarget.reset();
                }}
              >
                <input name="name" aria-label="Contact name" placeholder="Name" className="h-11 min-w-0 flex-1 rounded-md border border-input bg-background px-3 text-sm" />
                <input name="phone" aria-label="Contact phone" type="tel" placeholder="Phone" className="h-11 min-w-0 flex-1 rounded-md border border-input bg-background px-3 text-sm" />
                <Button type="submit" variant="outline" className="h-11">Add</Button>
              </form>
              <p className="mb-3 text-xs text-muted-foreground">
                Mom, Priya and Alex are demo contacts with fictional numbers. Contacts you add stay only on this device.
              </p>
              {!trip && <Button className="tap w-full" disabled={shareBusy} onClick={createShare}>{shareBusy ? "Creating link…" : "Try sharing again"}</Button>}
              <Button className="tap w-full" disabled={!trip} onClick={() => sms()}>
                <Send />
                Send Lmk link
              </Button>
              <Button
                variant="ghost"
                disabled={!trip}
                className="tap w-full"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(link);
                    setNotice("Lmk link copied.");
                  } catch {
                    setNotice(link);
                  }
                }}
              >
                <Copy />
                Copy link
              </Button>
              <Button variant="secondary" className="tap w-full" onClick={() => setPanel("walk")}>
                Continue to walk
                <ChevronRight />
              </Button>
            </>
          )}
          {panel === "walk" && route && (
            <>
              <p className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
                <span className="size-2 rounded-full bg-calm" />
                {isDemo ? "DEMO WALK" : "LIVE WALK"} · {destination}
              </p>
              <div className="flex items-end justify-between">
                <h2 className="text-4xl">
                  {Math.max(1, Math.ceil((route.durationS * (1 - progress)) / 60))}{" "}
                  <span className="text-lg font-medium">min left</span>
                </h2>
                <span className="mb-1 text-sm text-muted-foreground">
                  {fmtDistance(route.distanceM * (1 - progress))}
                </span>
              </div>
              <progress value={progress} max={1} className="my-4 h-1.5 w-full accent-primary" />
              <p className="mb-5 flex items-center gap-2 text-sm">
                <Heart className="size-4 fill-secondary text-primary" />
                {sharing && trip
                  ? `${contacts[0] ?? "Your contact"} is in the loop${isDemo ? " · demo" : ""}`
                  : "Just you and your walk"}
              </p>
              {alert && <div className="mb-4 rounded-xl border border-accent-foreground/20 bg-accent p-4">
                <p className="mb-2 text-xs font-semibold text-accent-foreground">A LITTLE HEADS-UP · DEMO REPORT</p>
                <p className="text-sm">{alert.description} · {alert.minutes_ago} min ago (illustrative)</p>
                <div className="mt-3 grid gap-2"><Button variant="secondary" onClick={rerouteDemo}>Reroute <Navigation /></Button><Button variant="outline" onClick={() => setPanel("stops")}>Find a verified stop <Coffee /></Button><Button variant="ghost" onClick={() => { setAlert(null); setRunning(true); }}>I’m fine</Button></div>
              </div>}
              <div className="grid grid-cols-2 gap-3">
                <Button
                  className="tap"
                  disabled={progress >= 1}
                  onClick={() => {
                    setIsDemo(true);
                    setRunning((v) => !v);
                  }}
                >
                  {running ? <Pause /> : <Play />}
                  {running ? "Pause demo" : progress >= 1 ? "At your stop" : "Demo walk"}
                </Button>
                <Button variant="secondary" className="tap" onClick={() => setPanel("chat")}>
                  <MessageCircle />
                  Talk to Lmk
                </Button>
              </div>
              <div className="mt-3 flex justify-between">
                <Button variant="ghost" onClick={() => trip ? setPanel("share") : void createShare()} disabled={shareBusy}>
                  <Send />
                  {shareBusy ? "Creating link…" : "Share link"}
                </Button>
                <Button
                  variant="ghost"
                  onClick={async () => {
                    setRunning(false);
                    await persist(position, progress, "ended", true);
                    setTrip(null);
                    setWalkStarted(false);
                    setPanel("home");
                    setRoutes([]);
                    setProgress(0);
                  }}
                >
                  End walk
                </Button>
              </div>
              <label className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                Live link sharing
                <input
                  type="checkbox"
                  aria-label="Live link sharing"
                  checked={sharing}
                  onChange={(e) => setSharing(e.target.checked)}
                  className="size-5 accent-primary"
                />
              </label>
              <p className="mt-3 text-xs text-muted-foreground">
                {isDemo
                  ? "Simulated movement · demo followers, not delivery confirmation."
                  : "Location updates while this page is open."}
              </p>
              {progress === 1 && journey.current && destination !== journey.current.destination && (
                <Button
                  variant="secondary"
                  className="tap mt-3 w-full"
                  disabled={busy}
                  onClick={continueJourney}
                >
                  Continue to {journey.current.destination}
                </Button>
              )}
            </>
          )}
          {panel === "stops" && (
            <>
              <div className="mb-2 flex items-center justify-between">
                <h2>
                  A welcoming place
                  <br />
                  to pause.
                </h2>
                <Button size="icon" variant="ghost" aria-label="Close stops" onClick={back}>
                  <X />
                </Button>
              </div>
              <p className="mb-4 text-xs text-muted-foreground">
                Seeded partners are illustrative. OpenStreetMap businesses are unverified; confirm access and hours.
              </p>
              {stopsBusy && <p role="status" className="mb-3 text-sm text-muted-foreground">Finding cafés, restaurants and hotels near your route…</p>}
              {stopsError && <p role="status" className="mb-3 text-xs text-muted-foreground">{stopsError}</p>}
              {stopsError && <Button variant="ghost" size="sm" onClick={() => setStopsAttempt((n) => n + 1)}>Retry nearby businesses</Button>}
              {!stopsBusy && sorted.length === 0 && <p className="text-sm text-muted-foreground">No stops found within 300 m of this route.</p>}
              <div className="max-h-[45dvh] space-y-3 overflow-y-auto">
                {sorted.map((s) => (
                  <Button
                    key={s.id}
                    variant="outline"
                    className="h-auto w-full items-start justify-between gap-3 rounded-xl p-4 text-left"
                    onClick={() => stopAt(s)}
                    disabled={busy}
                  >
                    <span className="min-w-0">
                      <span
                        className={`mb-2 flex items-center gap-1 text-xs ${s.verified ? "text-calm" : "text-muted-foreground"}`}
                      >
                        {s.verified ? (
                          <ShieldCheck className="size-3" />
                        ) : (
                          <Moon className="size-3" />
                        )}
                        {s.verified
                          ? "Verified partner"
                          : s.lateNight || s.closes_at > 22
                            ? "Late-night friendly"
                            : "Neighborhood stop"}
                      </span>
                      <span className="block font-semibold">{s.name}{s.lateNight || s.closes_at > 22 ? " 🌙" : ""}</span>
                      <span className="mt-1 block text-xs text-muted-foreground">
                        {fmtDistance(distance(position, [s.lng, s.lat]))} · {s.demo === false ? s.opening_hours || "Hours unknown" : `demo hours until ${s.closes_at === 24 ? "midnight" : `${s.closes_at - 12} pm`}`}
                      </span>
                      <span className="mt-2 block text-xs text-muted-foreground">{s.note}</span>
                      <span className="mt-2 block text-xs text-accent-foreground">
                        Try their {s.specialty.toLowerCase()} ☕
                      </span>
                    </span>
                    <ChevronRight className="mt-7 shrink-0" />
                  </Button>
                ))}
              </div>
            </>
          )}
          {panel === "chat" && (
            <>
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">A LITTLE COMPANY</p>
                  <h2>I’m here with you.</h2>
                </div>
                <Button variant="ghost" size="icon" aria-label="Close companion" onClick={back}>
                  <X />
                </Button>
              </div>
              <div className="mb-3 max-h-[24dvh] space-y-3 overflow-y-auto" aria-live="polite">
                {messages.map((m, i) => (
                  <Message key={i} from={m.role === 'you' ? 'user' : 'assistant'}>
                    <MessageContent><MessageResponse>{m.text}</MessageResponse></MessageContent>
                    {!!m.actions?.length && <div className="flex flex-wrap gap-2">
                      {m.actions.map((a) => {
                        const cls = "h-auto min-h-10 whitespace-normal";
                        if (a.type === 'go_to_stop') return <Button key={a.type} size="sm" className={cls} disabled={busy} onClick={() => void stopAt(a.stop)}><Navigation />Go to {a.stop.name.split(' · ')[0]}</Button>;
                        if (a.type === 'reroute') return <Button key={a.type} size="sm" variant="secondary" className={cls} onClick={() => { rerouteDemo(); setPanel("walk"); }}><Navigation />Reroute</Button>;
                        if (a.type === 'share_walk') return <Button key={a.type} size="sm" variant="secondary" className={cls} disabled={shareBusy} onClick={() => void createShare()}><Send />Share my walk</Button>;
                        if (a.type === 'alert_contacts') return <Button key={a.type} size="sm" variant="secondary" className={cls} onClick={() => sms(true)}><Send />Alert my contacts</Button>;
                        return <Button key={a.type} size="sm" variant="outline" className="h-auto min-h-10" asChild><a href="tel:911"><Phone />Call 911</a></Button>;
                      })}
                    </div>}
                  </Message>
                ))}
                {chatBusy && <p className="text-sm text-muted-foreground">Lmk is thinking…</p>}
                {chatError && (
                  <p role="alert" className="text-xs text-muted-foreground">
                    {chatError}
                  </p>
                )}
              </div>
              <div className="mb-3 flex flex-wrap gap-2">
                {[
                  "Someone’s following me",
                  "Is this block okay?",
                  "I want a coffee on my way.",
                ].map((t) => (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-auto whitespace-normal py-2"
                    key={t}
                    onClick={() => chat(t)}
                    disabled={chatBusy}
                  >
                    {t}
                  </Button>
                ))}
              </div>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void chat(chatInput);
                }}
                className="flex items-center gap-2 rounded-lg border border-border p-2"
              >
                <input
                  aria-label="Message Lmk"
                  placeholder="What’s on your mind?"
                  className="min-w-0 flex-1 bg-transparent px-2 text-sm outline-none"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  maxLength={500}
                />
                <Button
                  size="icon"
                  aria-label="Send message"
                  disabled={chatBusy || !chatInput.trim()}
                >
                  <Send />
                </Button>
              </form>
              {nearestCompanion && (
                <Button
                  variant="secondary"
                  className="tap mt-3 w-full justify-between"
                  onClick={() => stopAt(nearestCompanion)}
                >
                  <span className="text-left">
                    <span className="block text-xs">
                      Nearest demo stop ·{" "}
                      {fmtDistance(nearestCompanion.distanceM)}
                    </span>
                    <span className="block">{nearestCompanion.name}</span>
                  </span>
                  <Navigation />
                </Button>
              )}
              {!messages.some((m) => m.actions?.length) && <div className="mt-3 flex justify-between gap-2">
                <Button
                  variant="ghost"
                  onClick={() => sms(true)}
                >
                  <Send />
                  Alert my contacts
                </Button>
                <Button variant="ghost" asChild>
                  <a href="tel:911">
                    <Phone />
                    Call 911
                  </a>
                </Button>
              </div>}
              {!trip && (
                <p className="text-xs text-muted-foreground">
                  Alerts open your messages; send them to your contact.
                </p>
              )}
            </>
          )}
          {panel === "arrival" && (
            <div className="py-6 text-center">
              <div className="mx-auto mb-5 grid size-20 place-items-center rounded-full bg-secondary">
                <Heart className="size-9 fill-primary text-primary" />
              </div>
              <h2>
                {sharing && trip ? "Home 💜" : "You made it 💜"}
                <br />
                {sharing && trip
                  ? `Lmk sent to ${contacts[0] ?? "your contact"}`
                  : "Your walk is complete."}
              </h2>
              <p className="my-4 text-sm text-muted-foreground">
                You made it.{" "}
                {sharing && trip ? "Your shared viewer shows your arrival." : "This walk was not shared."}
                {isDemo ? " This was a demo walk." : ""}
              </p>
              <div className="mb-5 flex justify-center gap-8 border-y border-border py-4 text-sm">
                <span>{Math.round((route?.durationS ?? 0) / 60)} min walk</span>
                <span>{fmtDistance(route?.distanceM ?? 0)}</span>
              </div>
              <p className="mb-4 text-xs text-muted-foreground">No automatic SMS has been sent.</p>
              <Button
                className="tap w-full"
                onClick={() => {
                  setTrip(null);
                  setWalkStarted(false);
                  setPanel("home");
                  setRoutes([]);
                  setProgress(0);
                  setPosition(START);
                  setDestination("Salesforce Park");
                  setDest(PARK);
                }}
              >
                A new walk
                <Heart />
              </Button>
            </div>
          )}
          {panel === "menu" && (
            <>
              <div className="mb-5 flex justify-between">
                <h2>Your Lmk.</h2>
                <Button size="icon" variant="ghost" onClick={back} aria-label="Close menu">
                  <X />
                </Button>
              </div>
              <Button
                variant="ghost"
                className="tap w-full justify-between"
                onClick={() => setPanel("stops")}
              >
                Verified stops
                <Coffee />
              </Button>
              <Button variant="ghost" asChild className="tap w-full justify-between">
                <Link to="/partners">
                  Own a café? Become a verified stop
                  <ChevronRight />
                </Link>
              </Button>
              <Button
                variant="ghost"
                className="tap w-full justify-between"
                onClick={() => setPanel("chat")}
              >
                Companion chat
                <MessageCircle />
              </Button>
              <label className="tap flex items-center justify-between gap-3 text-sm">Police reports · sources & dates<input aria-label="Police reports layer" type="checkbox" checked={policeLayer} onChange={(e) => { setPoliceLayer(e.target.checked); if (e.target.checked) { setFocusedIncident(null); setPanel("reports"); } }} className="size-5 accent-primary" /></label>
              <p className="mt-4 text-xs text-muted-foreground">
                Lmk is a companion, not an emergency service. For immediate danger, call 911. Police reports are delayed; stop listings remain illustrative.
              </p>
            </>
          )}
          {panel === "reports" && (
            <>
              <div className="mb-3 flex items-center justify-between"><h2>Police reports</h2><Button variant="ghost" size="icon" aria-label="Close reports" onClick={back}><X /></Button></div>
              <a href={INCIDENT_SOURCE_URL} target="_blank" rel="noopener noreferrer" className="text-sm text-primary underline underline-offset-2">{INCIDENT_SOURCE_NAME}</a>
              <p role="status" className="my-3 text-xs text-muted-foreground">{incidentFeed.message}</p>
              <dl className="space-y-1 text-xs text-muted-foreground">
                <div>Source dataset updated: <time dateTime={incidentFeed.datasetUpdatedAt ?? undefined}>{formatReportTime(incidentFeed.datasetUpdatedAt)}</time></div>
                <div>Retrieved by Lmk: {incidentFeed.fetchedAt ? formatReportTime(incidentFeed.fetchedAt) : "Not retrieved"}</div>
              </dl>
              <div className="my-2 flex items-center justify-between"><span className="text-xs text-muted-foreground">{incidentFeed.incidents.length} behavior / property reports · past 7 days</span><Button variant="ghost" size="sm" disabled={refreshingReports} onClick={() => void refreshReports()}>{refreshingReports ? "Checking…" : "Refresh"}</Button></div>
              {focusedIncident && <><IncidentDetails incident={focusedIncident} /><Button variant="ghost" className="tap w-full" onClick={() => setFocusedIncident(null)}>All reports</Button></>}
              {!focusedIncident && <div className="max-h-[38dvh] overflow-y-auto">{reports.map((incident) => <IncidentDetails key={incident.id} incident={incident} />)}{reports.length === 0 && <p className="py-4 text-sm text-muted-foreground">{incidentFeed.status === "unavailable" ? "No reports could be retrieved." : "No mapped reports in the selected categories and date range. This does not establish current conditions."}</p>}</div>}
            </>
          )}
        </div>
      </section>
    </main>
  );
}
