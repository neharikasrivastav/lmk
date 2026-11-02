import { createFileRoute, Link } from "@tanstack/react-router";
import { lazy, Suspense, useEffect, useState } from "react";
import { useQuery, queryOptions } from "@tanstack/react-query";
import { Heart, ArrowLeft, Radio } from "lucide-react";
import { readTrip } from "@/lib/lmk.functions";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
const Map = lazy(() => import("@/components/BudMap"));
const options = (token: string) =>
  queryOptions({
    queryKey: ["trip", token],
    queryFn: () => readTrip({ data: { token } }),
    refetchInterval: 5000,
  });
export const Route = createFileRoute("/t/$token")({
  head: () => ({
    meta: [
      { title: "Lmk — Follow this walk" },
      { name: "description", content: "A shared Lmk walk: position, arrival and check-ins." },
      { property: "og:title", content: "Follow this Lmk walk" },
      { property: "og:description", content: "Stay connected until they arrive." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex,nofollow" },
      { name: "referrer", content: "no-referrer" },
    ],
  }),
  component: Viewer,
});
function Viewer() {
  const { token } = Route.useParams();
  const query = useQuery(options(token));
  const [mounted, setMounted] = useState(false);
  const [live, setLive] = useState(false);
  useEffect(() => setMounted(true), []);
  useEffect(() => {
    const c = supabase
      .channel(`walk-${token}`)
      .on("broadcast", { event: "changed" }, () => void query.refetch())
      .subscribe((status) => setLive(status === "SUBSCRIBED"));
    return () => {
      void supabase.removeChannel(c);
    };
  }, [token]);
  const t = query.data;
  if (query.isPending)
    return (
      <main className="grid min-h-dvh place-items-center bg-background">Opening this Lmk…</main>
    );
  if (!t)
    return (
      <main className="grid min-h-dvh place-items-center bg-background px-6">
        <div className="text-center">
          <Heart className="mx-auto mb-5 size-10 text-accent-foreground" />
          <h1 className="font-display text-2xl font-bold">This walk isn’t available.</h1>
          <p className="my-4 text-muted-foreground">
            The link may have expired, or sharing is turned off.
          </p>
          <Button asChild>
            <Link to="/">Open Lmk</Link>
          </Button>
        </div>
      </main>
    );
  return (
    <main className="relative h-dvh overflow-hidden bg-background">
      {mounted && (
        <Suspense fallback={null}>
          <Map
            user={t.position}
            dest={t.destination_coords}
            routes={[{ id: 0, coordinates: t.route, durationS: t.duration_s, distanceM: 0 }]}
            selected={0}
            onSelect={() => {}}
          />
        </Suspense>
      )}
      <header className="absolute left-5 top-5 rounded-xl bg-card/95 px-5 py-3 shadow-float">
        <span className="lmk-logo flex items-center gap-2">
          lmk
          <Heart className="size-5 fill-accent-foreground text-accent-foreground" />
        </span>
      </header>
      <section className="lmk-sheet">
        <div className="lmk-inner pt-6">
          <p className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
            <Radio className="size-3 text-calm" />
            {live ? "Connected · realtime updates" : "Reconnecting · refreshing every 5 seconds"}
            {t.demo ? " · Demo walk" : ""}
          </p>
          <h1 className="font-display text-2xl font-extrabold">
            {t.status === "arrived"
              ? "Neha arrived 💜"
              : t.status === "ended"
                ? "This walk has ended"
                : `Neha’s Lmk: walking to ${t.destination}`}
          </h1>
          <div className="my-5 flex justify-between border-y border-border py-4">
            <span className="font-semibold">
              {t.status === "arrived"
                ? "Home"
                : t.status === "paused"
                  ? "Taking a pause"
                  : `${Math.max(1, Math.ceil((t.duration_s * (1 - t.progress)) / 60))} min left`}
            </span>
            <span className="text-muted-foreground">{Math.round(t.progress * 100)}% of walk</span>
          </div>
          {t.checkins.map((c, i) => (
            <p key={i} className="mb-3 rounded-lg bg-secondary p-3 text-sm">
              {c}
            </p>
          ))}
          <p className="text-xs text-muted-foreground">
            Last update{" "}
            {new Date(t.updated_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}.{" "}
            {t.demo ? "Position and check-ins are simulated." : ""}
          </p>
          <Button variant="ghost" asChild className="mt-4">
            <Link to="/">
              <ArrowLeft />
              Open your Lmk
            </Link>
          </Button>
        </div>
      </section>
    </main>
  );
}
