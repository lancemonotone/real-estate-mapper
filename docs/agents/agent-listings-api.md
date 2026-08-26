# Agent listings API

Session-auth JSON API for AI agents acting as the logged-in Nest member. Wayhome does **not** scrape listing portals — the agent gathers data, then calls these endpoints.

Design: [`docs/superpowers/specs/2026-08-26-agent-listings-api-design.md`](../superpowers/specs/2026-08-26-agent-listings-api-design.md)

HTML dump import: [`docs/superpowers/specs/2026-08-26-listing-html-import-design.md`](../superpowers/specs/2026-08-26-listing-html-import-design.md)

## Auth

Same browser session cookies as the web app. Unauthenticated → `401` JSON.

## Endpoints

### `GET /api/agent/locales/:localeId`

Return locale metadata for import, including `listing_prefs` (target beds, pets, …).

**Response 200**

```json
{
  "locale": {
    "id": "uuid",
    "name": "Dunedin",
    "center_label": "Dunedin, FL, USA",
    "listing_prefs": {
      "target_beds": 2,
      "pets": { "cats": 1, "dogs": 1 }
    }
  }
}
```

Fail Fast: stop import if `listing_prefs` is null or incomplete.

### `GET /api/agent/locales/:localeId/listings`

List listings (id, name, address, source_url, beds, price, …) for name-similarity checks.

### `PUT /api/agent/locales/:localeId/listings`

Upsert by `source_url` (required). Creates or updates that URL in the locale. Geocodes when address is set/changed.

### `PATCH /api/agent/listings/:id`

Update by id after the user confirms a same-property / different-URL match. May set `source_url`.

## HTML dump import (Zillow)

When the user saves page HTML (portals block agent fetch):

1. Dump file: `_listings/listing.txt` with `source_url:` on line 1, then HTML.
2. `GET /api/agent/locales/:localeId` — load `listing_prefs`.
3. Run parser (do **not** read raw HTML into chat):

   ```bash
   npm run listing:parse -- _listings/listing.txt --prefs '<listing_prefs JSON>'
   ```

4. `GET` listings → duplicate name / different URL → **ask** before `PATCH`.
5. Else `PUT` with parser output + `source_url`.
6. Report id, `created`, money fields, amenities, parser warnings.

## Agent workflow (live URL)

1. User gives URL + locale (prefs come from locale row).
2. Agent parses the page off-platform; averages rents / splits fees; leaves unknowns null.
3. `GET` listings → if similar name and different URL, **ask the user** before `PATCH`.
4. Else `PUT` with `source_url` + fields.
5. Report `created` / updated listing id.
