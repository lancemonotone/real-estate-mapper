# Agent listings API design

**Date:** 2026-08-26  
**Status:** Approved for implementation  
**Approach:** C — session-auth JSON surface under `/api/agent/`

## Goals

- Let AI agents create/edit Wayhome listings while acting as the logged-in Nest member (browser session cookies).
- Agent gathers listing data from third-party sites (as a user would). **Wayhome never fetches listing portals** (Zillow, etc.).
- One listing per source URL in a locale; **upsert** when the same `source_url` is submitted again.
- Agent detects possible duplicates (same/similar name, different URL) by listing locale listings, then **asks the user** before updating those rows.

## Non-goals (v1)

- Nest API tokens / short-lived agent codes
- Server-side duplicate detection (geo / normalized address)
- Multi-unit create from one URL (one listing per URL only)
- Price averaging, fee splitting, or site-specific parsers in Wayhome (agent responsibility)
- Changing the browser form create/update UX beyond shared lib extraction if useful

## Auth

- Same Supabase session as the web app (`getUser()` via cookies).
- Unauthenticated → `401` JSON `{ "error": "Unauthorized" }` (no redirect).
- Locale access via existing Nest membership (`getLocaleForNestMember`); missing → `404`.

## Endpoints

Base: `/api/agent`

### 1. `GET /api/agent/locales/:localeId/listings`

List listings in a locale for duplicate/name checks.

**Response 200**

```json
{
  "listings": [
    {
      "id": "uuid",
      "name": "string | null",
      "address": "string | null",
      "source_url": "string | null",
      "beds": 2,
      "price_monthly": 1500,
      "updated_at": "ISO-8601"
    }
  ]
}
```

Include fields useful for agent matching; omit heavy blobs (notes optional later). v1 includes: `id`, `name`, `address`, `source_url`, `phone`, `beds`, `baths`, `price_monthly`, `fees_monthly`, `photo_url`, `updated_at`.

### 2. `PUT /api/agent/locales/:localeId/listings`

Upsert by `source_url` within the locale.

**Required body**

- `source_url` (non-empty string, trimmed)

**Optional body** (same semantics as listing form; omit or `null` → store null / leave inventing nothing)

- `name`, `address`, `phone`, `photo_url`, `notes`, `appointment_at` (ISO or null)
- `price_monthly`, `deposit`, `fees_monthly`, `sqft`, `beds`, `baths`, `pet_rent_monthly`, `pet_deposit`, `amenities` (string[])

**Behavior**

1. Normalize `source_url` with trim; reject empty → `400`.
2. Find existing row: `locale_id` + exact `source_url` match.
3. If found → update fields provided (see patch rules below for partial vs full).
4. If not found → insert with `created_by = user.id`.
5. If `address` present and (create or address changed) → geocode; on failure leave `lat`/`lng` null (Needs geocode).
6. If coords present → `ensureLocaleCoversPoint`.
7. If coords changed on update → `invalidateListingProximityResults`.

**Upsert field policy (v1):** PUT body is a **full replacement of writable scalar fields** for known keys present in the JSON object. Keys omitted from the body are left unchanged on update; on create, omitted keys are null. Explicit `null` clears a field.

**Response 200**

```json
{
  "listing": { "...full listing row..." },
  "created": true
}
```

`created: false` when updated.

### 3. `PATCH /api/agent/listings/:id`

Update an existing listing by id (confirmed different-URL duplicate merge / edit).

**Body:** same optional fields as PUT; at least one field required.

**Also allows** setting/changing `source_url` (so a confirmed duplicate can gain the new URL).

**Behavior:** membership via listing’s locale; geocode/invalidate/ensure-cover same as form update.

**Response 200** `{ "listing": { ... } }`  
**404** if missing / not a Nest member.

## URL uniqueness

- Partial unique index: `(locale_id, source_url)` where `source_url is not null`.
- Manual listings may keep `source_url` null (multiple allowed).
- Match is exact string after trim (agent owns canonicalization).

## Agent workflow (normative)

1. User provides URL + locale + search intent (e.g. 2 bedroom).
2. Agent fetches/parses the page off-platform; averages rents / splits fees as needed; leaves unknown fields null.
3. `GET` locale listings → if similar name and different `source_url`, **ask user** before PATCH.
4. Else `PUT` upsert with `source_url` + parsed fields.
5. Report listing id + created/updated to the user.

## Fail Fast

- Never invent name, address, price, or fees server-side.
- JSON errors only (no HTML redirects).
- Geocode failure → null coords, not fabricated lat/lng.

## Testing

- Unit: URL normalize / upsert key helper if extracted; body parse helpers.
- Integration-style or route-level tests where practical without live Google (mock geocode if needed).
- Migration applies via `npm run db:push`.

## Docs for agents

- Short section in design or `docs/agents/` describing the three endpoints and the ask-user rule for name collisions.
