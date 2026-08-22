# Real Estate Mapper

Household organizational tool for collecting real estate listings, mapping them with photos, and planning efficient driving tours by day.

## Stack

- Astro SSR (`@astrojs/node`)
- Supabase (Auth, Postgres, Storage)
- Google Maps Platform (Maps JavaScript API, Geocoding API, Routes API)

## Setup

1. Copy `.env.example` to `.env` and fill values.
2. Create a Supabase project (or use the existing linked one).
3. Install deps, then **one-time** link the CLI to your project:

```bash
npm install
npm run db:login          # browser login (once per machine)
npm run db:link           # may ask for the database password from Project Settings → Database
npm run db:repair-baseline  # only if schema was applied earlier via SQL editor (marks existing migrations applied)
npm run db:push           # apply any pending migrations
```

After that, new migrations are just:

```bash
npm run db:push
```

4. In Google Cloud, enable **Maps JavaScript API**, **Geocoding API**, and **Routes API**. Create:
   - A **server** API key → `GOOGLE_MAPS_API_KEY`
   - A **browser** API key (HTTP referrer restricted) → `PUBLIC_GOOGLE_MAPS_BROWSER_KEY`
   - A Map ID for Advanced Markers → `PUBLIC_GOOGLE_MAPS_MAP_ID`
5. Run the app:

```bash
npm run dev
```

## Scripts

- `npm run dev` — local server
- `npm test` — Vitest unit tests
- `npm run build` — production build
- `npm run db:push` — apply pending SQL migrations to the linked Supabase project
- `npm run db:status` — local vs remote migration list
- `npm run db:login` / `npm run db:link` — one-time CLI auth + project link

## Product notes

- Listings can be entered manually or via best-effort URL import (no invented fields).
- Unscheduled listings can be scratch-optimized, then saved to a tour date.
- Tour days never mix appointments across different calendar days.
- Route origin is the listing marked **Start here**; destination is the farthest other geocoded stop.

See `docs/superpowers/specs/2026-08-21-real-estate-mapper-design.md` and `docs/superpowers/plans/2026-08-21-real-estate-mapper.md`.
