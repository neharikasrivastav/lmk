# Lmk: complete walking demo

## What changes
- Update the logo to lowercase **lmk** with a coral heart and the tagline **“lmk when you get home, handled.”** Use the requested cream, deep plum and coral palette.
- Keep the map as the first screen, with large controls and a draggable bottom sheet. Start the demo at Powell St BART; keep real location optional and clearly distinguish simulated movement.
- Make the Powell St BART → Salesforce Park experience work without a routing API key, using street-following saved routes. Existing real destination search and routing remain separate from the deterministic demo.
- Follow the existing language rule: use **Verified stops**, **Late-night friendly**, and **Become a verified stop** rather than labeling anything “safe.”

## Screens and walk flow
1. **Home:** greeting, search, recent places, map, menu and companion button.
2. **Route selection:** fastest and calmer routes, incident dots, minutes, distance and calm scores. Recommend the calmer option with the requested +3-minute explanation supported by seeded reports.
3. **Share sheet:** sharing on by default, Mom/Priya/Alex selection, “Send Lmk link,” copy link and a prefilled Messages handoff. Do not invent phone numbers; collect a number or let Messages choose recipients.
4. **Walking:** ETA, distance remaining, selected contact, and a “Demo walk” control that animates along the route for about 60 seconds. At roughly 40%, show the seeded report and Reroute (+1 min), Find a verified stop, and I’m fine actions.
5. **Stops sheet:** about 12 seeded cafés, restaurants and lobbies; 4 demo verified partners first, then late-night options. Show distance, closing time, note and specialty. Selecting a stop changes the destination and records a check-in for viewers.
6. **Companion sheet:** short context-aware AI answers, the three requested quick replies, nearby verified-stop navigation, contact alert handoff and Call 911. If AI is unavailable, explicitly label scripted fallback responses.
7. **Arrival:** end within 30 metres of the active destination, show the requested Lmk payoff and trip summary. A stop arrival is a check-in, not arrival home.
8. **Public viewer `/t/$token`:** Neha’s destination, live position, route, ETA, status and stop check-ins; expired, invalid, ended and disconnected states.
9. **Partners `/partners`:** benefits, commitments, Free listing and Verified Partner **$49/month**, plus a request form. No payment collection in this scope.

## Demo honesty
Reports, opening hours, partnership badges and contact names are demonstration content, not verified real-world claims. Label that distinction without obstructing the walk. The viewer really updates, but “Mom is following” is simulated unless viewer presence is detected. Messages opens the phone’s composer; it does not prove delivery. Arrival and stop notifications update the shared viewer automatically; do not claim an SMS was sent automatically.

## Data model
| Collection | Main fields |
|---|---|
| `incidents` | type, description, coordinates, severity 1–3, report timestamp, demo minutes ago, demo flag |
| `safe_stops` | name, coordinates, address, note, verified, closing time, specialty, demo flag |
| `demo_routes` | destination, route kind, street-following GeoJSON, distance, duration, alert/reroute variants |
| `contacts` | public demo names Mom, Priya, Alex only; personal recipient details stay on the walker’s device |
| `trips` | random public token, private owner-capability hash, route, destination, latest position, ETA, status, start/end/expiry timestamps |
| `trip_checkins` | trip ID, stop, timestamp and viewer-facing message |
| `partner_requests` | business, applicant name/email, address, tier, commitments and submission time; never publicly readable |

Seed about 40 reports, 12 stops, 4 demo partners, the contacts and all demo routes in the same saved migration that creates the tables. Anchor relative incident ages to each demo session so the narrative remains reliable.

## Technical approach
- Preserve MapLibre GL v4 and OpenFreeMap; extend the existing map with incident/stop markers and movement rather than replace it.
- Use Lovable Cloud for persistent trips, seeded data, partner requests and realtime viewer updates.
- No walker login. Separate unguessable read-only share links from a private write capability; validate ownership server-side, hash the secret and never include it in viewer responses. Do not allow anonymous listing of trips or broad anonymous writes.
- Use narrowly scoped realtime access for the current trip, with reconnect handling, read-back refresh and explicit expiry. Keep private contact details out of viewer updates.
- Use built-in Lovable AI server-side with bounded context, calm prompts and visible fallback/error handling. No external AI key required; AI usage consumes workspace credits.
- Give each content page its own Lmk title, description and social metadata.

## Build order and verification
1. Branding, seeded data, saved routes, map markers, route scoring and draggable home sheet.
2. Trip creation, sharing, demo movement, report alert, reroute, stop detours, check-ins and arrival.
3. Realtime viewer and contact handoffs; test with a walker and viewer open together.
4. Companion AI and fallback; test real responses and emergency actions.
5. Partners page and saved requests; verify submission reads back privately.

Add focused tests for the +3-minute calmer option, +1-minute reroute, report proximity scoring, 40% alert, 30-metre arrival threshold, stop ordering, trip write protection and $49/month partner tier. Verify the full demo on mobile and desktop, including restart, sharing off, viewer reconnect and AI failure.