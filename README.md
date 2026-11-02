# lmk ❤️

**"lmk when you get home," handled.** A calm walking companion for women walking alone in San Francisco: a calmer route, a live trip link for the people who care, nearby Safe Stops, and someone to talk to — in one screen, without switching apps.

**Live demo:** https://safter-city-steps.lovable.app

> Prototype. Incident reports, Safe Stop hours and partner badges in the demo are illustrative seed data and are labeled as such in the app. Official SFPD reports from DataSF are available as an optional, clearly delayed layer. Lmk never claims an area is safe.

## The problem

Every woman knows the text "lmk when you get home." But the walk itself is where we feel most exposed. When something feels off mid-walk, the map is still calmly routing you straight ahead, and getting help means juggling Maps, a crime app, Find My and Messages.

## What it does

| | |
|---|---|
| **Calmer route** | Compares the fastest walking route with a calmer one, scored by recent reports near each route, and says why in one line ("+3 min, avoids 2 reports of aggressive behavior on Market St"). |
| **Live trip link** | One tap shares a private link. The viewer sees your position, ETA and stop check-ins in real time, and the trip ends automatically on arrival. |
| **Heads-up and reroute** | A new report ahead slides in mid-walk with Reroute / Find a stop / I'm fine. |
| **Safe Stops** | Open, staffed places along the route — verified partner cafés first, then late-night friendly places from OpenStreetMap opening hours. |
| **Companion chat** | "Someone's following me" gets a specific nearby stop with distance and direction, plus Go there, Alert my contacts and Call 911. |
| **Become a Safe Stop** | Business-side page: cafés get foot traffic and can pay to be a verified partner. |

## Design decisions

- **Behaviors, never people.** Reports describe conditions and behavior ("poor lighting," "someone shouting at passersby"), never types of people — a deliberate lesson from earlier "sketchy area" apps.
- **Emergency paths don't depend on AI.** Sharing, stop routing and Call 911 are plain code; the model only phrases guidance, and a deterministic fallback names the nearest stop if the model is slow or down.
- **Private by default.** Trip links are unguessable capabilities with hashed owner/viewer tokens; location history is never publicly readable; trusted contacts stay on the user's device.
- **Free stack.** MapLibre + OpenFreeMap tiles, OpenRouteService walking directions, Photon address search, Overpass for places, DataSF for police reports, Supabase free tier, Gemini free tier.

## Stack

TanStack Start (React 19, server functions) · Supabase (Postgres, Realtime) · MapLibre GL · Turf · Vercel AI SDK with Gemini · Vitest (60 tests).

Bootstrapped with Lovable during the *Kill Your Ick* buildathon (Girls Into VC at Berkeley × Corgi, Oct 2026), then moved to a provider-independent setup.

## Run it locally

```bash
bun install
cp .env.example .env   # fill in your keys
bun run dev
```

You need free accounts for:

1. **Supabase** — create a project, then run [`supabase/setup.sql`](supabase/setup.sql) in the SQL Editor (creates tables, access policies and demo data).
2. **Google AI Studio** — a Gemini API key for the companion chat.
3. **HeiGIT / OpenRouteService** — a free Standard key for live walking directions.

Without the AI key the chat falls back to scripted guidance; without the routing key the Powell St BART → Salesforce Park demo route still works.

## Deploy (Vercel, free)

Import the repo in Vercel and add the variables from [`.env.example`](.env.example). [`vercel.json`](vercel.json) installs with Bun and builds for Vercel's runtime.

## Tests

```bash
bun run test
```

## Roadmap

- Trip watchdog: escalate when a walk stops moving, goes off-route or misses its ETA ("You okay?" → alert contacts).
- Tool-using companion agent (reroute, start sharing, notify) with evals that check it never calls an area safe and always offers 911 in danger.
- Incident ingestion from DataSF and SF 311 with behavior-only descriptions.
- Walk mode: keep the screen awake so web location keeps updating.
