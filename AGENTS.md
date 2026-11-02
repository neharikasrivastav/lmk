<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Lmk architecture
- Demo content reads return available collections and an explicit recoverable error; empty precomputed routes fall back to live directions, never an empty route sheet.
- The initial remix migration recreates the full application schema idempotently with literal demo seeds; trip location history stays private alongside capability-checked trips.
- Named walk recipients and SMS draft addressing share a single browser-safe contact module; only explicitly selected known numbers enter drafts, avoiding public contact-table phone storage.
- Maps use MapLibre GL v4 + OpenFreeMap tiles (not Mapbox) so Google Places can be used for safe stops without violating Mapbox terms; v5+ worker fails under Vite.
- Address autocomplete uses server-side Photon/OpenStreetMap with location bias rather than city exclusion; never send autocomplete to the public Nominatim server, whose policy disallows it. Walking directions remain server-side OpenRouteService.
- Address search preserves building numbers, labels missing exact-number matches, and ignores obsolete requests through a debounced hook so stale results never replace newer input.
- MapLibre style colors must be rgb; theme oklch tokens are converted via canvas in BudMap.
- Seeded demo routes and stop paths live in Lovable Cloud migrations; use them for demo detours without routing keys, keeping live ORS routing separate.
- Trip read links and private owner capabilities are separate; hash capabilities, validate writes server-side, rotate viewer links on re-enabling sharing, and never grant public trip enumeration.
- Realtime broadcasts carry only an invalidation signal; viewers fetch a capability-checked projection with polling fallback so private writes never enter public channels.
- Shared geospatial rules use Turf in src/lib/walk.ts, and trip access rules live in src/lib/trip-rules.ts with focused tests.
- Companion answers use the server-only helper in src/lib/ai/companion.server.ts (Gemini's OpenAI-compatible endpoint by default; AI_BASE_URL/AI_MODEL swap providers); transcript is ephemeral per walk and fallback responses are explicitly labeled.
- Companion stop context ranks the closest three seeded listings from current position independently of route; deterministic place guidance guards generic distress answers, and stop actions reuse arrival-triggered shared check-ins without claiming SMS delivery. Existing composer transport is preserved during this targeted action/message enhancement; AI Elements renders message content.
- Official incidents use a server-only DataSF adapter with bounded queries; the optional layer never substitutes seeded reports. Demo scoring, corridor dots and alerts use explicitly illustrative seeded incidents separately.
- Police occurrence, upstream update, dataset update and retrieval timestamps remain distinct; delayed police data never drives demo scores or alerts.
- Walk UI starts locally before optional sharing; route durations normalize to integer seconds at the adapter and validators, and failed share creation permits retry without stopping the walk.
- Nearby stops are filtered to a route corridor; Overpass supplements fewer than three seeded stops on explicit stop discovery, and opening_hours is evaluated in San Francisco wall time without treating unknown hours as open.
