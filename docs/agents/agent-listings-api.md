# Agent listings API

Session-auth JSON API for AI agents acting as the logged-in Nest member. Wayhome does **not** scrape listing portals — the agent gathers data, then calls these endpoints.

Design: [`docs/superpowers/specs/2026-08-26-agent-listings-api-design.md`](../superpowers/specs/2026-08-26-agent-listings-api-design.md)

## Auth

Same browser session cookies as the web app. Unauthenticated → `401` JSON.

## Endpoints

### `GET /api/agent/locales/:localeId/listings`

List listings (id, name, address, source_url, beds, price, …) for name-similarity checks.

### `PUT /api/agent/locales/:localeId/listings`

Upsert by `source_url` (required). Creates or updates that URL in the locale. Geocodes when address is set/changed.

### `PATCH /api/agent/listings/:id`

Update by id after the user confirms a same-property / different-URL match. May set `source_url`.

## Agent workflow

1. User gives URL + locale + intent (e.g. 2 bedroom).
2. Agent parses the page off-platform; averages rents / splits fees; leaves unknowns null.
3. `GET` listings → if similar name and different URL, **ask the user** before `PATCH`.
4. Else `PUT` with `source_url` + fields.
5. Report `created` / updated listing id.
