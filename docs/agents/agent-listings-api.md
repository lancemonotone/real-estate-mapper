# Agent listings API

Session-auth JSON API for AI agents acting as the logged-in Nest member. Wayhome does **not** scrape listing portals — the agent gathers data from what the user provides, then calls these endpoints.

Design: [`docs/superpowers/specs/2026-08-26-agent-listings-api-design.md`](../superpowers/specs/2026-08-26-agent-listings-api-design.md)

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

## Agent workflow

1. User provides listing details in chat (URL, property name, address, rents, fees, amenities, photo URLs, etc.).
2. `GET /api/agent/locales/:localeId` — load `listing_prefs` (beds, pets).
3. Extract only what the user supplied; never invent fields (Fail Fast). For multi-unit properties, filter to `listing_prefs.target_beds` when deriving price, sqft, and baths.
4. `GET /api/agent/locales/:localeId/listings` — if another listing has a similar **name** and a **different** `source_url`, **ask the user** before `PATCH`.
5. Else `PUT` with `source_url` + fields. Same URL → upsert.
6. Report listing id, `created` true/false, key money fields, and amenities.

### Photo fields

| Field | Role |
|-------|------|
| `photo_urls` | Ordered gallery of remote image URLs |
| `photo_url` | Primary thumb; synced to `photo_urls[0]` when `photo_urls` is sent |

Remote URLs only — Wayhome does not host gallery image files.

### PUT body (when known)

| Field | Notes |
|-------|-------|
| `source_url` | Required for PUT |
| `name`, `address`, `phone` | As provided |
| `beds` | Usually `listing_prefs.target_beds` |
| `baths` | Typical floor-plan value for target units (not an arithmetic average) |
| `sqft`, `price_monthly` | Average or typical for target-bed units |
| `fees_monthly`, `deposit`, `pet_deposit`, `pet_rent_monthly` | When listed |
| `application_fees` | One-time application costs (admin + app fees) |
| `move_in_fees` | Other one-time move-in fees (utility setup, etc.) |
| `amenities` | Filtered lifestyle string array |
| `photo_urls` | Full ordered gallery |

Omit or `null` unknown fields. Do **not** set `notes` on import (user-authored only).
