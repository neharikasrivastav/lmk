import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";
import type { DemoRoute, Incident, Stop, PublicTrip } from "./walk";
import { distance, hasArrived } from "./walk";
import { ownerCanUpdate, viewerCanRead } from "./trip-rules";
import { nearestCompanionStops, needsStop } from './companion-stops';
import { applySafetyRules, type CompanionAction } from './companion-safety';
import type { NearbyReport } from './ai/companion-agent';
import { availableDemoContent } from './demo-content';

const coord = z.tuple([z.number().min(-123).max(-122), z.number().min(37).max(38)]);
const route = z.array(coord).min(2).max(3000);
const capability = z.string().regex(/^[a-f0-9]{64}$/);
function randomToken() {
  return Array.from(crypto.getRandomValues(new Uint8Array(32)), (v) =>
    v.toString(16).padStart(2, "0"),
  ).join("");
}
async function hash(value: string) {
  return Array.from(
    new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value))),
    (v) => v.toString(16).padStart(2, "0"),
  ).join("");
}

async function loadDemoContent() {
  try {
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"] ?? process.env["SUPABASE_ANON_KEY"];
  const url = process.env["SUPABASE_URL"];
  if (!key || !url) throw new Error("Demo content is unavailable.");
  const db = createClient<Database>(url, key, {
    auth: { persistSession: false },
    global: {
      fetch: (input, init) => {
        const h = new Headers(init?.headers);
        if (key.startsWith("sb_")) h.delete("Authorization");
        h.set("apikey", key);
        return fetch(input, { ...init, headers: h });
      },
    },
  });
  const { supabaseAdmin: admin } = await import("@/integrations/supabase/client.server");
  // Trusted contacts live only on the user's device; the shared contacts table is retired.
  const c = { data: [] as { name: string }[], error: null };
  const [s, r, i] = await Promise.all([
    db
      .from("safe_stops")
      .select("id,name,lat,lng,address,note,verified,closes_at,specialty,walking_route"),
    admin.from("demo_routes").select("id,name,duration_s,distance_m,coordinates").order("id"),
    db.from("incidents").select("id,type,description,lat,lng,severity,minutes_ago,street").eq("demo", true),
  ]);
  return availableDemoContent({
    stops: (s.data ?? []).map((s) => ({ ...s, demo: true })) as Stop[],
    incidents: (i.data ?? []) as Incident[],
    contacts: (c.data ?? []).map((v) => v.name),
    routes: (r.data ?? []).map((v) => ({
      id: v.id,
      name: v.name,
      durationS: v.duration_s,
      distanceM: v.distance_m,
      coordinates: v.coordinates,
    })) as DemoRoute[],
  }, Boolean(s.error || r.error || c.error || i.error));
  } catch {
    return availableDemoContent({ stops: [], incidents: [], contacts: [], routes: [] }, true);
  }
}
export const getDemo = createServerFn({ method: "GET" }).handler(loadDemoContent);

export const createTrip = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z
      .object({
        destination: z.string().min(1).max(100),
        destinationCoords: coord,
        route,
        duration: z.number().min(1).max(20000).transform(Math.round),
        sharing: z.boolean(),
        position: coord,
        demo: z.boolean(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
    const token = randomToken(),
      owner = randomToken();
    const { error } = await db
      .from("trips")
      .insert({
        token,
        owner_hash: await hash(owner),
        viewer_hash: await hash(token),
        destination: data.destination,
        destination_coords: data.destinationCoords,
        route: data.route,
        duration_s: data.duration,
        position: data.position,
        sharing: data.sharing,
        demo: data.demo,
      });
    if (error) {
      console.error("Trip insert failed", { code: error.code, message: error.message });
      throw new Error("The sharing link could not be created.");
    }
    return { token, owner };
  });

export const updateTrip = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z
      .object({
        token: capability,
        owner: capability,
        position: coord,
        progress: z.number().min(0).max(1),
        status: z.enum(["walking", "paused", "arrived", "ended"]),
        destination: z.string().max(100),
        destinationCoords: coord,
        route,
        duration: z.number().min(1).max(20000).transform(Math.round),
        checkins: z.array(z.string().max(200)).max(20),
        sharing: z.boolean(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
    const { data: trip } = await db
      .from("trips")
      .select("id,owner_hash,expires_at,status,sharing")
      .eq("token", data.token)
      .maybeSingle();
    if (
      !trip ||
      !ownerCanUpdate(trip.owner_hash, await hash(data.owner), trip.expires_at, Date.now())
    )
      throw new Error("This walk is no longer available.");
    if ((trip.status === "ended" || trip.status === "arrived") && data.status !== trip.status)
      throw new Error("This walk has ended.");
    if (data.status === "arrived" && !hasArrived(data.position, data.destinationCoords))
      throw new Error("Arrival needs to be within 30 metres of your destination.");
    const newToken = data.sharing && !trip.sharing ? randomToken() : data.token;
    const update = {
      token: newToken,
      viewer_hash: await hash(newToken),
      position: data.position,
      progress: data.progress,
      status: data.status,
      destination: data.destination,
      destination_coords: data.destinationCoords,
      route: data.route,
      duration_s: data.duration,
      checkins: [...new Set(data.checkins)],
      sharing: data.sharing,
      updated_at: new Date().toISOString(),
    };
    const { error } = await db.from("trips").update(update).eq("id", trip.id);
    if (error) throw new Error("Could not update the shared walk.");
    try {
      const channel = db.channel(`walk-${data.token}`);
      await channel.httpSend("changed", { changed: true });
      await db.removeChannel(channel);
    } catch { /* The committed update and rotated capability must still return; viewers poll. */ }
    return { ok: true, token: newToken };
  });

export const readTrip = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ token: capability }).parse(d))
  .handler(async ({ data }): Promise<PublicTrip | null> => {
    const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
    const { data: trip } = await db
      .from("trips")
      .select(
        "token,viewer_hash,destination,destination_coords,route,position,progress,duration_s,status,checkins,updated_at,expires_at,sharing,demo",
      )
      .eq("token", data.token)
      .maybeSingle();
    if (
      !trip ||
      !viewerCanRead(
        trip.sharing,
        trip.viewer_hash,
        await hash(data.token),
        trip.expires_at,
        Date.now(),
      )
    )
      return null;
    const { viewer_hash: _hash, expires_at: _expiry, sharing: _sharing, ...result } = trip;
    return result as unknown as PublicTrip;
  });

export const submitPartner = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z
      .object({
        business: z.string().min(2).max(100),
        name: z.string().min(2).max(100),
        email: z.string().email().max(200),
        address: z.string().min(5).max(200),
        tier: z.enum(["free", "verified"]),
        commitments: z.literal(true),
        website: z.string().max(0),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
    const { website: _website, ...fields } = data;
    const { data: row, error } = await db
      .from("partner_requests")
      .insert(fields)
      .select("id")
      .single();
    if (error || !row) throw new Error("Your request could not be saved. Please try again.");
    const { data: check } = await db
      .from("partner_requests")
      .select("id")
      .eq("id", row.id)
      .single();
    if (!check) throw new Error("Please try again.");
    return { saved: true };
  });

export const askCompanion = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z
      .object({
        message: z.string().min(1).max(500),
        position: coord,
        destination: z.string().max(100),
        history: z.array(z.object({ role: z.enum(['you', 'lmk']), text: z.string().max(5000) })).max(200).optional(),
        walk: z.object({ active: z.boolean(), sharing: z.boolean(), canReroute: z.boolean() }).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { companionConfig, companionModel } = await import("./ai/companion.server");
    const config = companionConfig();
    const context = await loadDemoContent();
    const nearbyStops = nearestCompanionStops(context.stops, data.position);
    const walk = data.walk ?? { active: false, sharing: false, canReroute: false };
    const respond = (result: { text: string; actions: CompanionAction[] }, error: string | null) => ({
      text: result.text,
      actions: result.actions,
      error,
      stop: result.actions.find((a) => a.type === 'go_to_stop')?.stop ?? null,
    });
    // Without the model, the same guardrails produce scripted guidance and the emergency buttons.
    const unavailable = (error: string) => {
      const stop = needsStop(data.message, data.history) ? nearbyStops[0] : undefined;
      return respond(applySafetyRules({ text: '', actions: stop ? [{ type: 'go_to_stop', stop }] : [], message: data.message, history: data.history, nearest: nearbyStops[0], walk }), error);
    };
    if (!config) return unavailable("The AI companion is unavailable. Scripted guidance is shown.");
    const { readOfficialIncidents } = await import("./incidents.server");
    // Police reports are background context; never let a slow feed delay a distress reply.
    const feed = await Promise.race([
      readOfficialIncidents(),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 1500)),
    ]);
    const near = (i: { lat: number; lng: number }) => distance(data.position, [i.lng, i.lat]);
    const reports: NearbyReport[] = [
      ...context.incidents.filter((i) => near(i) <= 300).map((i) => ({ type: i.type, street: i.street ?? null, minutesAgo: i.minutes_ago, distanceM: Math.round(near(i)), source: 'demo' as const })),
      ...(feed?.incidents ?? []).filter((i) => near(i) <= 300).map((i) => ({ type: i.type, street: i.street ?? null, minutesAgo: null, distanceM: Math.round(near(i)), source: 'sfpd' as const })),
    ].sort((a, b) => a.distanceM - b.distanceM);
    try {
      const { runCompanionAgent } = await import("./ai/companion-agent");
      const result = await runCompanionAgent({
        model: companionModel(config),
        context: { position: data.position, destination: data.destination, walk, stops: nearbyStops, reports },
        message: data.message,
        history: data.history,
      });
      return respond(result, null);
    } catch (error) {
      console.error("Companion reply failed", error);
      return unavailable("The AI companion is unavailable. A scripted response is shown below.");
    }
  });
