# Listing photo gallery (PhotoSwipe 5)

**Date:** 2026-08-27  
**Status:** Approved for implementation  
**Library:** [PhotoSwipe 5](https://photoswipe.com/)

## Goals

- Store multiple remote photo **URLs** per listing (no binary upload / no hosting of image files).
- Listing **detail**: inline gallery (primary hero + prev/next or thumb strip) and fullscreen PhotoSwipe.
- **Cards** (locale list, compare, tours, etc.): keep a single primary thumb; **clicking the thumb** opens PhotoSwipe for that listing’s full gallery (does not navigate).
- **Edit form**: full manage — add URL(s), remove, reorder, set primary.
- **Import**: write all `photo_candidates` into the gallery on agent upsert.

## Non-goals (v1)

- Uploading or downloading image files into Supabase Storage (`listing-photos` / `photo_path`).
- Expanding use of `photo_path` for gallery.
- Per-photo captions / alt text beyond empty decorative alts.
- Video.

## Data model

### Columns

| Column | Role |
|--------|------|
| `photo_urls text[]` | Ordered gallery of absolute `https://` image URLs. Default `'{}'`; empty = no gallery. |
| `photo_url text` | Denormalized **primary** thumb for cards, maps, tours. Always `photo_urls[0]` when the array is non-empty; otherwise null. |

### Invariants (Fail Fast — enforce in write path)

1. If `photo_urls` has length ≥ 1, `photo_url` **must** equal `photo_urls[0]`.
2. Primary selection = **move that URL to index 0** (array order is the source of truth).
3. Blank strings are stripped; URLs are deduped (first occurrence wins) before write.
4. Do not invent placeholder images when the gallery is empty.

### Migration

1. Add `photo_urls text[] not null default '{}'::text[]`.
2. Backfill: where `photo_url` is non-null, set `photo_urls = ARRAY[photo_url]`.
3. Rows with no `photo_url` stay `'{}'`.

### Types

Update `Listing` / DB types so `photo_urls: string[]` is available to pages and the agent write layer.

## Import & agent API

### Parser

Unchanged output: `photo_candidates: string[]` plus `listing.photo_url` (first candidate). Rollup may continue to set `photo_url` to candidates[0] for the compact listing object.

### Upsert (`PUT` / `PATCH` / form create-update)

Accept `photo_urls` (string array). On write:

1. Normalize (trim, drop empties, dedupe).
2. **Primary keep rule (import):** if the listing already has a primary URL that is still present in the incoming candidate/gallery set, move that URL to index `0`; otherwise use the first incoming URL as primary.
3. Set `photo_url = photo_urls[0] ?? null`.

When only `photo_url` is sent (legacy), treat as a one-item gallery: `photo_urls = photo_url ? [photo_url] : []`.

Agent listing JSON and docs (`docs/agents/agent-listings-api.md`, import skill) should document `photo_urls`.

## UI

### Shared client module

One vanilla module (e.g. `src/scripts/listing-gallery.ts` or under `assets` if that is the project pattern) that:

- Reads gallery URLs from `data-photo-urls` (JSON array) on a trigger element.
- Opens PhotoSwipe at a given start index.
- Loads PhotoSwipe 5 CSS/JS via npm dependency (bundled or imported from the module).

### Listing detail

- Hero shows the current gallery index (starts at primary / `0`).
- Inline **prev/next** cycles the hero index; optional compact thumb strip if it fits the existing layout without clutter.
- Click hero opens PhotoSwipe at the current index.
- Empty gallery → existing “No photo” empty state.

### Cards (list, compare, tours, …)

- Thumb = `photo_url` (primary) only.
- Thumb is a button/control that opens PhotoSwipe for `photo_urls` starting at `0`.
- Title / rest of card still navigates to the listing detail route.
- If gallery length is 0/1, lightbox still works for the single image when present; no thumb click when no photo.

### Edit form (`ListingForm`)

Replace the single “Photo URL” field as the primary control with a **gallery manager**:

- Ordered thumbnail grid.
- **Set primary** → move URL to index 0.
- **Remove**.
- **Reorder** (up/down and/or drag).
- **Add** URL(s) — single field and multi-line paste of multiple URLs.
- Submit `photo_urls[]` (or equivalent); server derives `photo_url`.

## Surfaces to wire

| Surface | Behavior |
|---------|----------|
| Listing detail `[id].astro` | Inline gallery + PhotoSwipe |
| Locale listings index | Thumb → lightbox |
| Compare matrix | Thumb → lightbox |
| Tours list / day views (where thumbs exist) | Thumb → lightbox |
| `ListingForm` + create/update API | Full manage |
| Agent PUT/PATCH + import skill | Write `photo_urls` |

## Dependencies

- Add `photoswipe` (v5) to `package.json`.

## Testing

- Migration backfill: existing `photo_url` becomes one-element `photo_urls`.
- Write path: primary always equals `[0]`; keep-primary-on-import when still in set.
- Form normalize: blank/dedupe.
- Smoke: detail lightbox + card thumb lightbox (manual or light harness if present).

## Decisions locked

| Topic | Choice |
|-------|--------|
| Scope | Detail gallery + card thumbs open lightbox |
| Edit | Full manage (add / remove / reorder / primary) |
| Import | Always write all candidates; keep existing primary if still in set |
| Library | PhotoSwipe 5 |
| Storage of files | **No** — remote URLs only |
| Primary model | `photo_urls[0]` + synced `photo_url` |
