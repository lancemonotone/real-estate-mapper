# Real Estate Mapper

Household organizational tool for collecting real estate listings, mapping them with photos, and planning efficient driving tours by day.

## Stack

- Astro SSR (`@astrojs/node`)
- Supabase (Auth, Postgres, Storage)
- Google Maps Platform (Maps JavaScript API, Geocoding API, Routes API)

## Setup

1. Copy `.env.example` to `.env` and fill values.
2. Create a Supabase project. Run `supabase/migrations/20260821000000_init.sql` in the SQL editor (or `supabase db push` if using the CLI).
3. In Google Cloud, enable **Maps JavaScript API**, **Geocoding API**, and **Routes API**. Create:
   - A **server** API key → `GOOGLE_MAPS_API_KEY`
   - A **browser** API key (HTTP referrer restricted) → `PUBLIC_GOOGLE_MAPS_BROWSER_KEY`
   - A Map ID for Advanced Markers → `PUBLIC_GOOGLE_MAPS_MAP_ID`
4. Install and run:

```bash
npm install
npm run dev
```

## Scripts

- `npm run dev` — local server
- `npm test` — Vitest unit tests
- `npm run build` — production build

## Product notes

- Listings can be entered manually or via best-effort URL import (no invented fields).
- Unscheduled listings can be scratch-optimized, then saved to a tour date.
- Tour days never mix appointments across different calendar days.
- Route origin is the listing marked **Start here**; destination is the farthest other geocoded stop.

See `docs/superpowers/specs/2026-08-21-real-estate-mapper-design.md` and `docs/superpowers/plans/2026-08-21-real-estate-mapper.md`.
