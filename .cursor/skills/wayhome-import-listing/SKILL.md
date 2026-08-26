---
name: wayhome-import-listing
description: >-
  Import rental listings into Wayhome from a listing URL (Zillow, apartments.com,
  etc.) or a saved HTML dump. Filters amenities to lifestyle highlights, averages
  prices for the locale's target unit type, and upserts via the session-auth agent
  listings API. Use when the user pastes a property URL, saves listing HTML to
  _listings/, asks to populate/compare listings, or mentions Wayhome import from
  Zillow/real-estate pages.
---

# Wayhome import listing

Wayhome never scrapes listing portals. **You** read the page or a user dump, then write via the agent API. See `docs/agents/agent-listings-api.md`.

## Required inputs

- **Locale id** (ask if missing; reuse in-chat when the user said later listings share it)
- Listing **URL** *or* saved HTML dump (see **HTML dump path** below)
- `listing_prefs` on the locale row (beds, pets) — load via API; **do not ask** if prefs exist

## Auth / host

Same browser session cookies as the logged-in Wayhome user. No Nest API token in v1.

Call the agent API on a host that **actually serves** `/api/agent/...` (often local `http://localhost:4321` while the feature is undeployed). Do **not** assume prod has the routes. If the API 404s, switch to the host that has them and have the user sign in there — do not pivot to Supabase MCP for this workflow.

## HTML dump path (preferred when portals block fetch)

**Do not** `Read` the raw dump into chat — it wastes tokens.

1. User saves HTML to `_listings/listing.txt` (or similar) with header:

   ```
   source_url: https://www.zillow.com/apartments/...
   ```

   then the page HTML.

2. `GET /api/agent/locales/:localeId` — require `listing_prefs`; stop if missing.
3. Run the local parser via shell (writes JSON; **do not** read raw HTML):

   ```bash
   npm run listing:parse -- _listings/listing.txt --prefs '<JSON from listing_prefs>'
   ```

   Default output: `_listings/listing.json` (stdout prints the path). Override with `--out`.

4. **Read** the JSON file (compact — safe for context). User may edit it first (e.g. swap `photo_url` from `photo_candidates`).
5. Continue with duplicate check + `PUT` below.

## Workflow

1. Resolve locale; load `listing_prefs` from `GET /api/agent/locales/:localeId`.
2. **Live URL:** open/read the page. **Dump:** run parser (above). Extract only what is present; never invent fields (Fail Fast).
3. For multi-unit pages, filter to `listing_prefs.target_beds`; derive fields per **Unit metrics** below.
4. **Always** include fee data when present in dump/page (Zillow: “Monthly rent, fees & charges” and “One-time fees & charges”). Map recurring extras → `fees_monthly`, security deposit → `deposit`, pet one-time → `pet_deposit`, monthly pet rent → `pet_rent_monthly` using locale pet counts.
5. Build **amenities** with the filter below → **string array** in JSON (parser applies this for dumps).
6. `GET /api/agent/locales/:localeId/listings` — if another listing has the same or obviously similar **name** and a **different** `source_url`, **stop and ask the user** before updating.
7. Else `PUT /api/agent/locales/:localeId/listings` with `source_url` + fields. Same URL → upsert.
8. Reply with listing id, `created` true/false, key money fields, amenities, and parser/page warnings.

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
| `source_url` | Page URL or dump header (required for PUT) |
| `name` | Property / community name |
| `address` | Full street address |
| `phone` | Leasing phone |
| `photo_url` | Primary photo if available |
| `beds` | `listing_prefs.target_beds` |
| `baths` | Typical for target units (see above) |
| `sqft` | Typical/average for target units |
| `price_monthly` | Average (or mid-range) base rent for target units |
| `fees_monthly` | Sum of **recurring** required fees beyond base rent |
| `deposit` | Security deposit if listed |
| `pet_deposit` | Sum of one-time pet fees for locale pets |
| `pet_rent_monthly` | Monthly pet rent for locale pets |
| `amenities` | Filtered **string array** |
| `notes` | Optional short caveats |

Omit or `null` when unknown. Do not write "Unlisted" into numeric fields.

## Amenities filter (normative)

Keep **property / lifestyle** highlights only (pool, hot tub, jacuzzi, spa, sauna, clubhouse, fitness, courtyard, deck, balcony/patio, playground, tennis, pickleball, bark park, outdoor kitchens, fire pit, splash pad, lazy river, movie theater, notable parking like surface lot, in-unit W/D when it's a selling point, shared laundry when relevant, smoke-free, pets allowed, etc.).

**Drop** baseline or vague items, including: Refrigerator, Window Coverings, Linen Closet, Cable Satellite, Garbage Disposal, Ceiling Fan, "Other Community Rooms", "Other Unit Features", and similar.

**Assume present — do not list:** AC, Dishwasher, Refrigerator, Basic Parking.

**If clearly missing**, include a combined note tag such as `Note: No AC, No Dishwasher` in the amenities array (or put the note in `notes`).

## Do not

- Call Wayhome scrapers or invent `/api` fetch-of-Zillow
- Read multi-hundred-KB HTML dumps into chat when the parser exists
- Dump every amenity from the page
- Silently merge different-URL duplicates
- Fabricate phone, fees, or prices
- Skip fee accordions / cost calculators when present
- Average bathrooms into non-floor-plan fractions
- Authenticate via Supabase MCP instead of the Wayhome browser session
- Ask beds/pets when `listing_prefs` is set on the locale
