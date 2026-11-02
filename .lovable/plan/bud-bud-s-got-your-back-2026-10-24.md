# Bud — "Bud's got your back"

A calm, mobile-first walking companion for women walking alone in San Francisco. Built one feature at a time, starting with the map and routing.

## Design direction
- Soft, reassuring palette: warm cream background, sage green primary (safe), soft apricot for caution, muted rose only for genuine risk. No red alarm states.
- Rounded, friendly type (e.g. Nunito / Figtree) with generous sizes.
- One-handed use: all primary actions in the bottom third, tap targets of at least 48px, bottom sheets instead of top menus.
- Wording is supportive ("This route keeps to busier, well-lit streets"), never fear-based.

## Screens
1. **Map (home)**: full-screen Mapbox map, live location dot, search bar pinned near the bottom, "Share this walk" button, and a chat handle.
2. **Destination search**: a sheet with autocomplete results, biased to San Francisco.
3. **Route compare**: a sheet showing up to 3 routes as cards (time, distance, safety score, a "Recommended" badge, a one-sentence reason). Tapping a card highlights that route on the map.
4. **Active walk**: the chosen route, remaining time, nearby safe stops, and Share and Chat buttons.
5. **Share sheet**: a public link with copy and native share, plus an "End walk" button.
6. **Viewer page (/walk/:id)**: a public page with a live map of the walker's position and route, a status label (walking / arrived / ended), and the last-updated time.
7. **Safe stop detail**: name, hours, distance, and a "Verified Safe Stop" badge for partner cafés.
8. **Chat panel**: a bottom sheet over the map with quick prompts ("Someone's following me", "Is this block okay?") and a one-tap "Notify my contact" button.
9. **Trusted contact setup**: a small sheet for a name and phone or email. It opens the first time you use Notify.

## Data model (Lovable Cloud)
```text
incidents     id, type, description, lat, lng, severity (1-3), created_at
              type is limited to behaviors/conditions: aggressive_behavior,
              poor_lighting, altercation, harassment, theft, blocked_sidewalk,
              unsafe_crossing
safe_stops    id, name, address, lat, lng, hours (json), phone, is_partner, notes
trips         id (uuid, works as an unguessable share token), status
              (active|arrived|ended), origin_lat/lng, dest_lat/lng, dest_label,
              route_geojson, started_at, ended_at
trip_positions  id, trip_id, lat, lng, recorded_at  (streamed live to viewers)
contacts      id, device_id/user_id, name, phone, email
```
- Incidents and safe stops can be read by anyone. Writes go through seed data or an admin only.
- A trip can be read by anyone who has its link. Only the device that created a trip can update it.
- Seed data: about 50 incidents spread across SoMa, the Tenderloin, and Union Square, with dates in the last 30 days and mixed severity, plus 5 partner cafés.

## Safety scoring
- For each route, count incidents within 50m of the route line from the last 30 days. Weight each one by severity and recency (newer counts more), then normalize per km.
- Show the score on a 0–100 "comfort" scale (higher is calmer) with a soft color.
- Recommendation: pick the lowest-risk route if it is no more than about 20% longer than the fastest route. Otherwise recommend the fastest route and mention the trade-off.
- The one-sentence reason is built from a template, e.g. "Avoids 4 recent reports of poor lighting on Turk St, adding 3 minutes." The AI chat can rephrase it later.

## Build order
1. **Map, location, search, routes** (with scoring and recommendation)
2. Share this walk + public viewer + realtime updates + automatic end within 30m of the destination
3. Safe stops along the route + Verified badge
4. Chat panel (AI with location, incident, and safe-stop context) + Notify my contact
5. Polish: empty and error states, location-permission guidance, accessibility

## Technical details
- Mapbox connector: the public token powers the map in the browser. The secret token is used on the server for search (geocoding) and Directions (`walking`, `alternatives=true`, `geometries=geojson`).
- Incident-to-route distance is calculated on the server with turf.js (`pointToLineDistance`), using a bounding-box prefilter on the incidents query.
- Realtime: the walker writes `trip_positions` about every 5s. The viewer subscribes to inserts for that trip through Realtime. Arrival is detected on the client (haversine distance under 30m) and confirmed when the trip status is updated.
- "Open businesses": Mapbox Search Box category search gives nearby cafés and shops, but opening hours are patchy. Partner safe stops use our own `hours` field. Google Places can't be used alongside Mapbox.
- Chat: Lovable AI through a server function, with location, nearby incidents, and the nearest safe stop added as context. Notify uses an SMS or email connector (to be chosen in step 4).
- Identity in v1: an anonymous device ID, with no login required. Accounts can come later.

## Open questions (for later steps)
- How Notify should reach a contact (SMS through Twilio, or email).
- Whether walkers need accounts in v1, or a device ID is enough.
