# Listing HTML import design

**Date:** 2026-08-26  
**Status:** Approved for implementation  
**Approach:** Local parse script (Zillow-first) + locale `listing_prefs` + agent session upsert

## Goals

- Import rental listings from **user-saved page dumps** when portals block agent fetches (e.g. Zillow).
- Keep **raw HTML out of the model context** (token cost): agent runs a local parser via shell and only consumes compact JSON.
- Finish in **one agent turn** when prefs and dump are valid: parse → duplicate check → upsert via existing [agent listings API](2026-08-26-agent-listings-api-design.md).
- Store household listing targets (**beds, pets, …**) on the **locale** so each locale (e.g. Dunedin) carries its own answers.

## Non-goals (v1)

- Terminal-only upsert using stolen Chrome cookies
- Wayhome server fetching listing portals
- Non-Zillow extractors (architecture allows them later)
- Locale prefs editing UI (seed/update via SQL or agent/API is enough for v1)
- Photo quality ML / manual gallery picker UI
- Batch multi-file import UI

## Relationship to agent listings API

- **Auth and write path unchanged:** session cookies, `GET`/`PUT`/`PATCH` under `/api/agent/…`.
- Parsing, averaging, fee mapping, and amenity filtering stay **off the Wayhome request path** (local script + agent skill), matching that API’s non-goal of “no site-specific parsers in Wayhome.”

## Locale `listing_prefs`

Add nullable `listing_prefs jsonb` on `public.locales`. **Yes — they are saved in the DB** on the locale row. Once seeded/edited, every import for that locale reuses them.

**Shape (v1)**

```json
{
  "target_beds": 2,
  "pets": { "cats": 1, "dogs": 1 }
}
```

| Field | Meaning |
|-------|---------|
| `target_beds` | Unit filter / beds written on the listing |
| `pets.cats` / `pets.dogs` | Counts used when summing pet one-time and monthly fees |

**Fail Fast:** If the agent is asked to import and `listing_prefs` is null or missing required keys, **stop** and tell the user — do not invent beds or pets.

**Extensibility:** Prefer adding keys to this JSON over new columns unless a field must be queried in SQL.

**v1 seed:** Set prefs for the Dunedin locale used in import sessions (exact values from the active household: 2 beds, 1 cat, 1 dog unless changed before ship).

## Agent locale endpoint

The HTML import workflow requires reading `listing_prefs` from the DB. Add this endpoint under the existing `/api/agent` surface (same auth as [agent listings API](2026-08-26-agent-listings-api-design.md)).

### `GET /api/agent/locales/:localeId`

Return the locale row for the signed-in Nest member, including `listing_prefs`.

**Auth**

- Same Supabase session cookies as the web app.
- Unauthenticated → `401` JSON `{ "error": "Unauthorized" }`.
- Locale not found or not a Nest member → `404` JSON `{ "error": "Locale not found" }`.
- Use existing `getLocaleForNestMember`.

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

**Fields (v1)**

| Field | Notes |
|-------|--------|
| `id` | Locale uuid |
| `name` | Display name |
| `center_label` | Optional human place label; useful context in agent replies |
| `listing_prefs` | Nullable jsonb; import fails visibly if null or missing required keys |

Omit geo/radius and other locale columns unless an agent workflow needs them later.

**Non-goals (v1)**

- `PATCH` to edit `listing_prefs` via agent API (seed/update via SQL or future locale UI)
- Listing list on this route (use `GET …/listings`)

**Route file:** `src/pages/api/agent/locales/[localeId]/index.ts` (sibling to the existing listings route).

## Dump contract

File path (conventional): `_listings/listing.txt` (directory may be gitignored for dumps).

**Header (required for new/unknown URLs)**

```
source_url: https://www.zillow.com/apartments/...
```

Then a blank line (optional) and the saved HTML/fragment.

- Parser reads `source_url` from the first non-empty line matching `source_url:\s*(https://…)`.
- If missing: fail with a clear error unless the agent already matched an existing listing by name and the user confirmed reuse of that row’s `source_url` (existing skill duplicate rules).

## Local parser

### Invocation

Agent runs something like:

```bash
npm run listing:parse -- _listings/listing.txt --prefs '<json>' [--out _listings/listing.json]
```

**Output:** writes pretty-printed JSON to a file (default: same basename as dump, `.json` extension). Stdout prints the output path. Stderr: warnings. Non-zero exit on hard failure.

The agent **reads the JSON file** — not raw HTML, not stdout payload. The user may inspect or edit the file before upsert (e.g. choose a different `photo_url` from `photo_candidates`).

Prefs JSON is passed from the locale row (agent loads locale first); the script does not read the DB.

### Pipeline

1. **Header** — extract `source_url`.
2. **Detect source** — Zillow building/apartment dump (DOM markers / known strings). Unknown → exit error `unsupported_source`.
3. **Extract (Zillow)** — name, address, phone, photo candidates, unit rows (beds/baths/sqft/rent), fee sections, amenity lists, pet fee schedule when present.
4. **Rollup (shared)** — apply `listing_prefs`:
   - Filter units to `target_beds`
   - `price_monthly` = average base rent of matching units
   - `sqft` = average (or typical) of those units
   - `baths` = **mode** among matching units (never average into odd fractions)
   - `fees_monthly` = sum of required recurring fees beyond base rent (ranges → midpoint)
   - `deposit` = security deposit when listed
   - `pet_deposit` / `pet_rent_monthly` = sums for configured pet counts when fees are listed
   - `amenities` = lifestyle filter (same normative rules as `.cursor/skills/wayhome-import-listing/SKILL.md`)
   - `photo_url` = best-effort primary (prefer large exterior/hero candidates when distinguishable; otherwise first high-res gallery URL) + optional `photo_candidates[]` for agent/user override
5. **Warnings** — e.g. truncated unit list (“Show N more”), missing fee accordion, zero matching units.

### Output (illustrative)

```json
{
  "ok": true,
  "source": "zillow",
  "source_url": "https://…",
  "listing": {
    "name": "MacAlpine Place",
    "address": "152 Macalpine Way, Dunedin, FL 34698",
    "phone": "(813) 544-5890",
    "photo_url": "https://…",
    "beds": 2,
    "baths": 2,
    "sqft": 1245,
    "price_monthly": 1861,
    "fees_monthly": 118.5,
    "deposit": 400,
    "pet_deposit": 700,
    "pet_rent_monthly": 70,
    "amenities": ["Clubhouse", "…"],
    "notes": "optional short caveats"
  },
  "warnings": ["2-bed table may be incomplete (Show 6 more units)"]
}
```

Omit or null unknown money fields; never invent.

## Agent workflow (skill update)

1. Resolve **locale id** (reuse in-chat; else ask).
2. `GET /api/agent/locales/:localeId` — require `listing_prefs`; stop if missing.
3. Ensure dump path has `source_url` header (or handle confirmed existing match).
4. Run parser with `listing_prefs`; on failure, report stderr and stop.
5. Read the parser output JSON file (default `_listings/listing.json`).
6. `GET /api/agent/locales/:localeId/listings` — same-name / different-URL → **ask** before `PATCH`.
7. Else `PUT` with parser `listing` + `source_url`.
8. Reply: id, `created`, key money fields, amenities, warnings.

Host remains a server that actually serves `/api/agent/…` (typically local Astro) with the user signed in.

## Out of scope reminders

- Do not add Wayhome scrapers or portal fetch routes.
- Do not bypass session auth with Supabase service role for this workflow.
- Do not put full dump HTML into chat or into model `Read` when the parser exists.

## Implementation notes (for the plan)

- Migration: `alter table public.locales add column listing_prefs jsonb;`
- Types: extend `Locale` in `src/lib/types/database.ts`.
- Implement `GET /api/agent/locales/:localeId` per **Agent locale endpoint** above.
- Update `docs/agents/agent-listings-api.md` to document the new GET route alongside existing listing endpoints.
- Update `.cursor/skills/wayhome-import-listing/SKILL.md` to mandate parser-first for HTML dumps and locale GET for prefs.
