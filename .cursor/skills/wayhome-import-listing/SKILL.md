---
name: wayhome-import-listing
description: >-
  Import rental listings into Wayhome from details the user pastes in chat (URL,
  rents, fees, amenities, photos, etc.). Filters amenities to lifestyle highlights,
  averages prices for the locale's target unit type, and upserts via the session-auth
  agent listings API. Use when the user pastes property info, asks to populate or
  compare listings, or mentions Wayhome import from Zillow or other rental sites.
---

# Wayhome import listing

Wayhome never scrapes listing portals. **You** read what the user pastes, then write via the agent API. See `docs/agents/agent-listings-api.md`.

## Required inputs

- **Locale id** (ask if missing; reuse in-chat when the user said later listings share it)
- Listing **source URL** and property details from the user (paste, screenshot text, etc.)
- `listing_prefs` on the locale row (beds, pets) — load via API; **do not ask** if prefs exist

## Auth / host

Same browser session cookies as the logged-in Wayhome user. No Nest API token in v1.

Call the agent API on a host that **actually serves** `/api/agent/...` (often local `http://localhost:4321` while the feature is undeployed). Do **not** assume prod has the routes. If the API 404s, switch to the host that has them and have the user sign in there — do not pivot to Supabase MCP for this workflow.

## Workflow

1. Resolve locale; load `listing_prefs` from `GET /api/agent/locales/:localeId`.
2. Parse the user's pasted content. Extract only what is present; never invent fields (Fail Fast).
3. For multi-unit pages, filter to `listing_prefs.target_beds`; derive fields per **Unit metrics** below.
4. **Always** include fee data when the user provides it (recurring extras → `fees_monthly`, security deposit → `deposit`, pet one-time → `pet_deposit`, monthly pet rent → `pet_rent_monthly` using locale pet counts).
5. Build **amenities** with the filter below → **string array** in JSON.
6. For photos: send **`photo_urls`** as the full ordered gallery when the user provides multiple URLs.
7. `GET /api/agent/locales/:localeId/listings` — if another listing has the same or obviously similar **name** and a **different** `source_url`, **stop and ask the user** before updating.
8. Else `PUT /api/agent/locales/:localeId/listings` with `source_url` + fields. Same URL → upsert.
9. Reply with listing id, `created` true/false, key money fields, and amenities.

## Unit metrics

| Field | Rule |
|-------|------|
| `price_monthly` | Average (or mid-range) **base rent** for matching target-bed units |
| `sqft` | Average (or typical) for those units |
| `baths` | **Typical / mode** floor-plan value among matching units (e.g. `1.5` or `2`). Never arithmetic-average baths into odd fractions (e.g. do not write `1.6`) |

State briefly in the reply what you averaged vs took as typical.

## Fields to send (JSON)

Map into PUT/PATCH body when known:

| Wayhome field | Source |
|---------------|--------|
| `source_url` | User-provided listing URL (required for PUT) |
| `name` | Property / community name |
| `address` | Full street address |
| `phone` | Leasing phone |
| `photo_url` | Primary photo (legacy single); prefer `photo_urls` |
| `photo_urls` | Full ordered gallery of remote image URLs |
| `beds` | `listing_prefs.target_beds` (or actual when property is single floor plan) |
| `baths` | Typical for target units (see above) |
| `sqft` | Typical/average for target units |
| `price_monthly` | Average (or mid-range) base rent for target units |
| `fees_monthly` | Sum of **recurring** required fees beyond base rent |
| `deposit` | Security deposit if listed |
| `pet_deposit` | Sum of one-time pet fees for locale pets |
| `pet_rent_monthly` | Monthly pet rent for locale pets |
| `amenities` | Filtered **string array** |

Omit or `null` when unknown. Do not write "Unlisted" into numeric fields.

**`notes` is user-authored only.** Never set or overwrite `notes` on import (omit the field).

## Amenities filter (normative)

Keep **property / lifestyle** highlights only (pool, hot tub, jacuzzi, spa, sauna, clubhouse, fitness, courtyard, deck, balcony/patio, playground, tennis, pickleball, bark park, outdoor kitchens, fire pit, splash pad, lazy river, movie theater, notable parking like surface lot, in-unit W/D when it's a selling point, shared laundry when relevant, smoke-free, pets allowed, etc.).

**Drop** baseline or vague items, including: Refrigerator, Window Coverings, Linen Closet, Cable Satellite, Garbage Disposal, Ceiling Fan, "Other Community Rooms", "Other Unit Features", and similar.

**Assume present — do not list:** AC, Dishwasher, Refrigerator, Basic Parking.

**If clearly missing**, include a combined note tag such as `Note: No AC, No Dishwasher` in the amenities array (not in `notes`).

## Do not

- Call Wayhome scrapers or invent `/api` fetch-of-Zillow
- Dump every amenity from the page
- Silently merge different-URL duplicates
- Fabricate phone, fees, or prices
- Skip fee data when the user provided it
- Average bathrooms into non-floor-plan fractions
- Authenticate via Supabase MCP instead of the Wayhome browser session
- Ask beds/pets when `listing_prefs` is set on the locale
- Write import metadata or caveats into `notes` (leave that field for the user)
