---
name: wayhome-import-listing
description: >-
  Import rental listings into Wayhome from a listing URL (Zillow, apartments.com,
  etc.) or a raw amenities dump. Filters amenities to lifestyle highlights, averages
  prices for the user's target unit type, and upserts via the session-auth agent
  listings API. Use when the user pastes a property URL, asks to populate/compare
  listings, or mentions Wayhome import from Zillow/real-estate pages.
---

# Wayhome import listing

Wayhome never scrapes listing portals. **You** read the page (browser / fetch tools), then write via the agent API. See `docs/agents/agent-listings-api.md`.

## Required inputs

- Listing **URL** (or pasted feature list)
- **Locale id** (ask if missing)
- Target unit intent when multi-unit (e.g. **2 bedroom**) — ask if missing

Auth: same browser session as the logged-in Wayhome user (cookies). No Nest API token in v1.

## Workflow

1. Open/read the listing page. Extract only what is present; never invent fields (Fail Fast).
2. For multi-unit pages, filter to the user's target beds; derive price/sqft/baths from matching units (average or clear range mid — prefer stating what you did in the reply).
3. Split base rent vs fees/pet when the page separates them; if jumbled and unclear, leave fee fields null and note that in the reply.
4. Build **amenities** with the filter below → comma-separated string.
5. `GET /api/agent/locales/:localeId/listings` — if another listing has the same or obviously similar **name** and a **different** `source_url`, **stop and ask the user** before updating.
6. Else `PUT /api/agent/locales/:localeId/listings` with `source_url` + fields. Same URL → upsert.
7. Reply with listing id, `created` true/false, and the amenities string used.

## Fields to send (JSON)

Map into PUT/PATCH body when known:

| Wayhome field | Source |
|---------------|--------|
| `source_url` | Page URL (required for PUT) |
| `name` | Property / community name |
| `address` | Full street address |
| `phone` | Leasing phone |
| `photo_url` | Primary photo if available |
| `beds` | Target unit beds |
| `baths` | Typical for target units |
| `sqft` | Typical/average for target units |
| `price_monthly` | Average (or mid-range) base rent for target units |
| `fees_monthly` | Recurring fees if separable |
| `deposit` | If listed |
| `pet_deposit` / `pet_rent_monthly` | If listed |
| `amenities` | Filtered comma-separated string |
| `notes` | Optional short caveats (e.g. deposit via Rhino) |

Omit or `null` when unknown. Do not write "Unlisted" into numeric fields.

## Amenities filter (normative)

Keep **property / lifestyle** highlights only (pool, clubhouse, fitness, courtyard, deck, balcony/patio, playground, tennis, bark park, outdoor kitchens, notable parking like surface lot, in-unit W/D when it's a selling point, etc.).

**Drop** baseline or vague items, including: Refrigerator, Window Coverings, Linen Closet, Cable Satellite, Garbage Disposal, Ceiling Fan, "Other Community Rooms", "Other Unit Features", and similar.

**Assume present — do not list:** AC, Dishwasher, Refrigerator, Basic Parking.

**If clearly missing**, append a combined note at the end of the amenities string, e.g. `Note: No AC, No Dishwasher`.

Headings from the source page usually don't matter unless an item is ambiguous without context — then rename the item (e.g. "Shared Laundry", "Surface Lot Parking").

Output format: single comma-separated list (notes may be combined at the end).

## Example amenity output

```
Clubhouse, Fitness Center, Swimming Pool, Tennis Court, Bark Park, Patio / Balcony, Outdoor Kitchens, Car Care Center, In-Unit Washer/Dryer, Surface Lot Parking
```

## Do not

- Call Wayhome scrapers or invent `/api` fetch-of-Zillow
- Dump every amenity from the page
- Silently merge different-URL duplicates
- Fabricate phone, fees, or prices
