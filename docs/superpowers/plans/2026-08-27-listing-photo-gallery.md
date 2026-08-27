# Listing Photo Gallery (PhotoSwipe 5) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Multi-URL photo galleries per listing with PhotoSwipe 5 fullscreen lightbox (detail + card thumbs), edit-form gallery manage, and import writing all `photo_candidates`.

**Architecture:** `photo_urls text[]` is the ordered source of truth; `photo_url` stays denormalized as `photo_urls[0]` for cards. Shared normalize/merge helpers feed form + agent write paths. One Vite-bundled client module opens PhotoSwipe from `data-photo-urls` triggers.

**Tech Stack:** Astro 7, Supabase Postgres, PhotoSwipe 5 (`photoswipe` npm), Vitest, vanilla client JS.

## Global Constraints

- Remote **URLs only** — do not upload/download gallery images into Supabase Storage; leave existing `photo` / `photo_path` upload as-is (out of scope to expand).
- Fail Fast: no placeholder images; empty gallery → existing empty UI.
- Primary = `photo_urls[0]`; always sync `photo_url` on write.
- Import: write all candidates; if existing primary is still in the new set, keep it as `[0]`.
- Spec: `docs/superpowers/specs/2026-08-27-listing-photo-gallery-design.md`.
- Branch from `staging` per repo git workflow; do not create worktrees.

## File map

| File | Responsibility |
|------|----------------|
| `supabase/migrations/*_listing_photo_urls.sql` | Add + backfill `photo_urls` |
| `src/lib/types/database.ts` | `Listing.photo_urls: string[]` |
| `src/lib/listings/photo-urls.ts` | Normalize, merge-with-keep-primary, derive `photo_url` |
| `tests/listing-photo-urls.test.ts` | Unit tests for helpers |
| `src/lib/listings/agent-write.ts` | Parse/write `photo_urls` |
| `src/pages/api/listings/create.ts` | Form `photo_urls` |
| `src/pages/api/listings/update.ts` | Form `photo_urls` |
| `src/client/listing-gallery.ts` | PhotoSwipe open + bind triggers |
| `src/client/listing-gallery-form.ts` | Edit-form gallery manager UI |
| `src/components/ListingForm.astro` | Gallery manager markup |
| `src/pages/app/locales/.../listings/[id].astro` | Detail hero gallery |
| Locale index / compare / tours pages | Thumb → lightbox (not navigate) |
| `src/styles/chrome.css` | Gallery / form / thumb-button styles |
| `docs/agents/agent-listings-api.md`, import skill | Document `photo_urls` |
| `package.json` | `photoswipe` dependency |

---

### Task 1: Migration + Listing type

**Files:**
- Create: `supabase/migrations/YYYYMMDDHHMMSS_listing_photo_urls.sql` (timestamp via `date` when implementing)
- Modify: `src/lib/types/database.ts` (`Listing`)

**Interfaces:**
- Produces: `Listing.photo_urls: string[]` (always present in types; DB default `'{}'`)

- [ ] **Step 1: Add migration**

```sql
alter table public.listings
  add column if not exists photo_urls text[] not null default '{}'::text[];

update public.listings
set photo_urls = array[photo_url]
where photo_url is not null
  and photo_url <> ''
  and (photo_urls = '{}'::text[] or photo_urls is null);
```

- [ ] **Step 2: Apply migration**

Run: `npm run db:push`  
Expected: migration applied on linked project.

- [ ] **Step 3: Update `Listing` type**

In `src/lib/types/database.ts`, add after `photo_url`:

```ts
photo_urls: string[];
```

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/*_listing_photo_urls.sql src/lib/types/database.ts
git commit -m "$(cat <<'EOF'
feat: add listings.photo_urls gallery column

EOF
)"
```

---

### Task 2: `photo-urls` helpers (TDD)

**Files:**
- Create: `src/lib/listings/photo-urls.ts`
- Create: `tests/listing-photo-urls.test.ts`

**Interfaces:**
- Produces:
  - `normalizePhotoUrls(input: unknown): string[]`
  - `mergePhotoUrls(incoming: string[], existingPrimary: string | null): string[]` — keep existing primary as `[0]` if still in `incoming`, else use incoming order
  - `primaryPhotoUrl(urls: string[]): string | null` — `urls[0] ?? null`
  - `resolvePhotoFields(input: { photo_urls?: unknown; photo_url?: unknown; existingPrimary?: string | null }): { photo_urls: string[]; photo_url: string | null }`

- [ ] **Step 1: Write failing tests**

```ts
import { describe, expect, it } from 'vitest';
import {
  mergePhotoUrls,
  normalizePhotoUrls,
  primaryPhotoUrl,
  resolvePhotoFields,
} from '../src/lib/listings/photo-urls';

describe('normalizePhotoUrls', () => {
  it('trims, drops empties, dedupes first-wins', () => {
    expect(
      normalizePhotoUrls(['  a  ', '', 'b', 'a', '  b ']),
    ).toEqual(['a', 'b']);
  });

  it('returns [] for non-arrays', () => {
    expect(normalizePhotoUrls(null)).toEqual([]);
    expect(normalizePhotoUrls('x')).toEqual([]);
  });
});

describe('mergePhotoUrls', () => {
  it('keeps existing primary at front when still present', () => {
    expect(mergePhotoUrls(['a', 'b', 'c'], 'b')).toEqual(['b', 'a', 'c']);
  });

  it('uses incoming order when primary missing', () => {
    expect(mergePhotoUrls(['a', 'b'], 'z')).toEqual(['a', 'b']);
  });
});

describe('resolvePhotoFields', () => {
  it('derives photo_url from photo_urls[0]', () => {
    expect(
      resolvePhotoFields({ photo_urls: ['https://x/a.jpg', 'https://x/b.jpg'] }),
    ).toEqual({
      photo_urls: ['https://x/a.jpg', 'https://x/b.jpg'],
      photo_url: 'https://x/a.jpg',
    });
  });

  it('legacy photo_url alone becomes one-item gallery', () => {
    expect(resolvePhotoFields({ photo_url: 'https://x/a.jpg' })).toEqual({
      photo_urls: ['https://x/a.jpg'],
      photo_url: 'https://x/a.jpg',
    });
  });

  it('applies keep-primary when existingPrimary set and photo_urls provided', () => {
    expect(
      resolvePhotoFields({
        photo_urls: ['https://x/a.jpg', 'https://x/b.jpg'],
        existingPrimary: 'https://x/b.jpg',
      }),
    ).toEqual({
      photo_urls: ['https://x/b.jpg', 'https://x/a.jpg'],
      photo_url: 'https://x/b.jpg',
    });
  });
});
```

- [ ] **Step 2: Run tests — expect FAIL**

Run: `npm test -- tests/listing-photo-urls.test.ts`  
Expected: fail (module missing).

- [ ] **Step 3: Implement `src/lib/listings/photo-urls.ts`**

```ts
export function normalizePhotoUrls(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const item of input) {
    if (typeof item !== 'string') continue;
    const url = item.trim();
    if (!url || seen.has(url)) continue;
    seen.add(url);
    out.push(url);
  }
  return out;
}

export function mergePhotoUrls(
  incoming: string[],
  existingPrimary: string | null,
): string[] {
  const urls = normalizePhotoUrls(incoming);
  if (!existingPrimary) return urls;
  const primary = existingPrimary.trim();
  if (!primary || !urls.includes(primary)) return urls;
  return [primary, ...urls.filter((u) => u !== primary)];
}

export function primaryPhotoUrl(urls: string[]): string | null {
  return urls[0] ?? null;
}

export function resolvePhotoFields(input: {
  photo_urls?: unknown;
  photo_url?: unknown;
  existingPrimary?: string | null;
}): { photo_urls: string[]; photo_url: string | null } {
  const hasUrls = Object.prototype.hasOwnProperty.call(input, 'photo_urls');
  const hasLegacy = Object.prototype.hasOwnProperty.call(input, 'photo_url');

  let urls: string[];
  if (hasUrls) {
    urls = mergePhotoUrls(
      normalizePhotoUrls(input.photo_urls),
      input.existingPrimary ?? null,
    );
  } else if (hasLegacy) {
    const one =
      typeof input.photo_url === 'string' ? input.photo_url.trim() : '';
    urls = one ? [one] : [];
  } else {
    urls = [];
  }

  return { photo_urls: urls, photo_url: primaryPhotoUrl(urls) };
}
```

- [ ] **Step 4: Run tests — expect PASS**

Run: `npm test -- tests/listing-photo-urls.test.ts`

- [ ] **Step 5: Commit**

```bash
git add src/lib/listings/photo-urls.ts tests/listing-photo-urls.test.ts
git commit -m "$(cat <<'EOF'
feat: normalize and merge listing photo_urls

EOF
)"
```

---

### Task 3: Agent write path + form create/update

**Files:**
- Modify: `src/lib/listings/agent-write.ts`
- Modify: `src/pages/api/listings/create.ts`
- Modify: `src/pages/api/listings/update.ts`
- Test: extend agent parse tests if present; else rely on `photo-urls` tests + manual PUT smoke

**Interfaces:**
- Consumes: `resolvePhotoFields`, `normalizePhotoUrls` from `photo-urls.ts`
- Produces: `AgentListingPatch.photo_urls?: string[]`; writes always set both columns when either photo field present

- [ ] **Step 1: Extend `AgentListingPatch` + `WRITABLE_KEYS`**

Add `'photo_urls'` to writable handling (prefer applying photo fields via `resolvePhotoFields` rather than raw loop for those two keys).

Parse:

```ts
if ('photo_urls' in body) {
  if (body.photo_urls !== null && !Array.isArray(body.photo_urls)) {
    return { ok: false, error: 'photo_urls must be string array or null' };
  }
  patch.photo_urls = normalizePhotoUrls(body.photo_urls ?? []);
}
// keep existing photo_url parse for legacy
```

- [ ] **Step 2: In `applyListingPatch` / insert path**

When `photo_urls` or `photo_url` in patch:

```ts
const resolved = resolvePhotoFields({
  ...(Object.prototype.hasOwnProperty.call(patch, 'photo_urls')
    ? { photo_urls: patch.photo_urls }
    : {}),
  ...(Object.prototype.hasOwnProperty.call(patch, 'photo_url') &&
  !Object.prototype.hasOwnProperty.call(patch, 'photo_urls')
    ? { photo_url: patch.photo_url }
    : {}),
  existingPrimary: existing.photo_url,
});
update.photo_urls = resolved.photo_urls;
update.photo_url = resolved.photo_url;
// skip raw WRITABLE_KEYS copy for photo_url/photo_urls when resolved
```

On **create** insert in `upsertListingBySourceUrl`, same resolve with `existingPrimary: null`.

Include `photo_urls` in `AGENT_LIST_SELECT` optionally (not required for duplicate check).

- [ ] **Step 3: Form create/update**

Parse `photo_urls` from FormData (repeated `photo_urls` fields or single JSON string — **use repeated fields**):

```ts
const photo_urls = normalizePhotoUrls(form.getAll('photo_urls'));
const resolved = resolvePhotoFields({
  photo_urls,
  existingPrimary: /* update: existing.photo_url; create: null */,
});
// insert/update resolved.photo_urls + resolved.photo_url
```

If form sends empty gallery intentionally, write `'{}'` and `photo_url: null`.

- [ ] **Step 4: Smoke agent PUT with `photo_urls` array** (browser session) or unit-test parse only.

- [ ] **Step 5: Commit**

```bash
git add src/lib/listings/agent-write.ts src/pages/api/listings/create.ts src/pages/api/listings/update.ts
git commit -m "$(cat <<'EOF'
feat: persist photo_urls on listing writes

EOF
)"
```

---

### Task 4: PhotoSwipe client module + npm dep

**Files:**
- Modify: `package.json` / lockfile via `npm install photoswipe@5`
- Create: `src/client/listing-gallery.ts`

**Interfaces:**
- Produces:
  - `openListingGallery(urls: string[], index?: number): void`
  - `bindListingGalleries(root?: ParentNode): void` — binds `[data-listing-gallery]` clicks

- [ ] **Step 1: Install**

Run: `npm install photoswipe@5`

- [ ] **Step 2: Implement client module**

```ts
import PhotoSwipeLightbox from 'photoswipe/lightbox';
import 'photoswipe/style.css';

export function openListingGallery(urls: string[], index = 0): void {
  const items = urls
    .map((src) => src.trim())
    .filter(Boolean)
    .map((src) => ({ src, width: 1600, height: 1200 }));
  if (items.length === 0) return;

  const lightbox = new PhotoSwipeLightbox({
    dataSource: items,
    index: Math.min(Math.max(0, index), items.length - 1),
    pswpModule: () => import('photoswipe'),
  });
  lightbox.init();
  lightbox.loadAndOpen(Math.min(Math.max(0, index), items.length - 1));
}

function parseUrls(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((u): u is string => typeof u === 'string' && Boolean(u.trim()))
      : [];
  } catch {
    return [];
  }
}

export function bindListingGalleries(root: ParentNode = document): void {
  root.querySelectorAll<HTMLElement>('[data-listing-gallery]').forEach((el) => {
    if (el.dataset.galleryBound === '1') return;
    el.dataset.galleryBound = '1';
    el.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const urls = parseUrls(el.getAttribute('data-photo-urls'));
      const index = Number(el.getAttribute('data-photo-index') || '0') || 0;
      openListingGallery(urls, index);
    });
  });
}

bindListingGalleries();
```

Note: PhotoSwipe needs real dimensions ideally; v1 may use placeholder width/height and still display (PS5 supports this). Prefer loading natural size later only if broken.

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json src/client/listing-gallery.ts
git commit -m "$(cat <<'EOF'
feat: add PhotoSwipe listing gallery client

EOF
)"
```

---

### Task 5: Listing detail hero gallery

**Files:**
- Modify: `src/pages/app/locales/[localeId]/listings/[id].astro`
- Modify: `src/styles/chrome.css` (hero gallery controls — use `responsive-css` skill when editing CSS)
- Modify or leave: `public/scripts/listing-detail.js` (no conflict if gallery is separate Astro `<script>`)

**Interfaces:**
- Consumes: `bindListingGalleries` / `openListingGallery`; `listing.photo_urls`

- [ ] **Step 1: Select `photo_urls` in the page query** (ensure `*` or explicit columns include `photo_urls`).

- [ ] **Step 2: Replace hero photo block**

Structure:

```astro
---
const photoUrls = listing.photo_urls?.length
  ? listing.photo_urls
  : listing.photo_url
    ? [listing.photo_url]
    : [];
const photoUrlsJson = JSON.stringify(photoUrls);
---
{photoUrls.length > 0 ? (
  <div class="listing-hero__gallery" data-hero-gallery>
    <button
      type="button"
      class="listing-hero__photo-btn"
      data-listing-gallery
      data-photo-urls={photoUrlsJson}
      data-photo-index="0"
      aria-label="Open photo gallery"
    >
      <img class="listing-hero__photo" src={photoUrls[0]} alt="" data-hero-gallery-img />
    </button>
    {photoUrls.length > 1 && (
      <div class="listing-hero__gallery-nav">
        <button type="button" class="icon-btn secondary" data-hero-gallery-prev aria-label="Previous photo">…</button>
        <span class="muted" data-hero-gallery-count>1 / {photoUrls.length}</span>
        <button type="button" class="icon-btn secondary" data-hero-gallery-next aria-label="Next photo">…</button>
      </div>
    )}
  </div>
) : (
  <p class="muted">No photo</p>
)}
```

- [ ] **Step 3: Page script**

```astro
<script>
  import {
    bindListingGalleries,
    openListingGallery,
  } from '../../../../../../client/listing-gallery';

  bindListingGalleries();

  const root = document.querySelector('[data-hero-gallery]');
  if (root instanceof HTMLElement) {
    const urls = JSON.parse(root.querySelector('[data-listing-gallery]')?.getAttribute('data-photo-urls') || '[]');
    let index = 0;
    const img = root.querySelector('[data-hero-gallery-img]');
    const count = root.querySelector('[data-hero-gallery-count]');
    const trigger = root.querySelector('[data-listing-gallery]');
    function render() {
      if (img instanceof HTMLImageElement) img.src = urls[index];
      if (count) count.textContent = `${index + 1} / ${urls.length}`;
      if (trigger instanceof HTMLElement) trigger.setAttribute('data-photo-index', String(index));
    }
    root.querySelector('[data-hero-gallery-prev]')?.addEventListener('click', (e) => {
      e.stopPropagation();
      index = (index - 1 + urls.length) % urls.length;
      render();
    });
    root.querySelector('[data-hero-gallery-next]')?.addEventListener('click', (e) => {
      e.stopPropagation();
      index = (index + 1) % urls.length;
      render();
    });
  }
</script>
```

Adjust import path to match file depth.

- [ ] **Step 4: CSS** — extend existing `.listing-hero__photo`; make button reset chrome via shared `.icon-btn` / bare button patterns per extend-base-styles; optical centering if text controls.

- [ ] **Step 5: Manual smoke** — open a listing with `photo_urls`; prev/next + lightbox.

- [ ] **Step 6: Commit**

```bash
git commit -m "$(cat <<'EOF'
feat: listing detail PhotoSwipe gallery hero

EOF
)"
```

---

### Task 6: Card thumbs open lightbox

**Files:**
- Modify: `src/pages/app/locales/[localeId]/index.astro`
- Modify: `src/pages/app/locales/[localeId]/compare.astro`
- Modify: `src/pages/app/locales/[localeId]/tours/index.astro`
- Modify: `src/pages/app/locales/[localeId]/tours/[id].astro`
- Modify: `src/pages/app/locales/[localeId]/attributes.astro` if thumbs exist
- Modify: `src/styles/chrome.css` — `.matrix-listing__media` as button when needed

**Interfaces:**
- Consumes: `bindListingGalleries`; each listing query must include `photo_urls`

- [ ] **Step 1: Add `photo_urls` to each page’s listing select.**

- [ ] **Step 2: Replace thumb `<a class="matrix-listing__media">` with:**

```astro
{photo ? (
  <button
    type="button"
    class="matrix-listing__media"
    data-listing-gallery
    data-photo-urls={JSON.stringify(listing.photo_urls?.length ? listing.photo_urls : [photo])}
    data-photo-index="0"
    aria-label={`Photos: ${title}`}
  >
    <img class="matrix-listing__thumb" src={photo} alt="" loading="lazy" />
  </button>
) : (
  <span class="matrix-listing__thumb matrix-listing__thumb--empty" aria-hidden="true">No photo</span>
)}
```

Keep name/address links as navigation.

- [ ] **Step 3: Import bind script once per page** (same as detail).

- [ ] **Step 4: CSS** — button.matrix-listing__media should look like the old media link (no default button chrome); extend existing class.

- [ ] **Step 5: Smoke** — compare + locale index thumb opens PS; name still navigates.

- [ ] **Step 6: Commit**

```bash
git commit -m "$(cat <<'EOF'
feat: open PhotoSwipe from listing card thumbs

EOF
)"
```

---

### Task 7: ListingForm gallery manager

**Files:**
- Modify: `src/components/ListingForm.astro`
- Create: `src/client/listing-gallery-form.ts`
- Modify: `src/styles/chrome.css`
- Leave: file `Upload photo` input unchanged (storage out of scope)

**Interfaces:**
- Produces: repeated hidden/visible inputs `name="photo_urls"` in order; primary = first

- [ ] **Step 1: Replace Photo URL label with gallery manager markup**

```astro
---
const initialUrls =
  listing.photo_urls?.length
    ? listing.photo_urls
    : listing.photo_url
      ? [listing.photo_url]
      : [];
---
<fieldset class="listing-form__gallery" data-gallery-form>
  <legend>Photos</legend>
  <ul class="listing-form__gallery-list" data-gallery-list>
    {initialUrls.map((url) => (
      <li class="listing-form__gallery-item" data-gallery-item>
        <input type="hidden" name="photo_urls" value={url} />
        <img src={url} alt="" />
        <div class="listing-form__gallery-actions">
          <button type="button" class="secondary" data-gallery-primary>Primary</button>
          <button type="button" class="secondary" data-gallery-up>Up</button>
          <button type="button" class="secondary" data-gallery-down>Down</button>
          <button type="button" class="secondary" data-gallery-remove>Remove</button>
        </div>
      </li>
    ))}
  </ul>
  <label>
    Add photo URL(s)
    <textarea data-gallery-add rows="2" placeholder="One URL per line"></textarea>
  </label>
  <button type="button" class="secondary" data-gallery-add-btn>Add</button>
</fieldset>
```

- [ ] **Step 2: Implement `listing-gallery-form.ts`**

Behaviors: add (split lines), remove, up/down reorder, set primary (move item to index 0). Always keep `input[name=photo_urls]` order matching DOM order. Mark first item visually as primary.

- [ ] **Step 3: Load script from ListingForm** via `<script>` import.

- [ ] **Step 4: Manual test** — edit listing, reorder, save, confirm DB `photo_urls[0] === photo_url`.

- [ ] **Step 5: Commit**

```bash
git commit -m "$(cat <<'EOF'
feat: listing form photo gallery manager

EOF
)"
```

---

### Task 8: Docs + import skill

**Files:**
- Modify: `docs/agents/agent-listings-api.md`
- Modify: `.cursor/skills/wayhome-import-listing/SKILL.md`
- Optionally note in import design that PUT should send `photo_urls: photo_candidates`

- [ ] **Step 1: Document `photo_urls` on PUT/PATCH** and primary sync rule + keep-primary-on-import.

- [ ] **Step 2: Skill** — when upserting, send `photo_urls: result.photo_candidates` (full list), not only `photo_url`.

- [ ] **Step 3: Commit**

```bash
git commit -m "$(cat <<'EOF'
docs: listing photo_urls for agent import

EOF
)"
```

---

### Task 9: Verification

- [ ] **Step 1: Run** `npm test -- tests/listing-photo-urls.test.ts` (and any agent-write tests touched).

- [ ] **Step 2: Manual checklist**
  - [ ] Detail prev/next + lightbox
  - [ ] Card thumb lightbox; title navigates
  - [ ] Form add/remove/reorder/primary persists
  - [ ] Agent/import-style PUT with many `photo_urls` keeps chosen primary if still present

- [ ] **Step 3: Final commit only if leftover fixes**

---

## Spec coverage (self-review)

| Spec requirement | Task |
|------------------|------|
| `photo_urls` column + backfill | 1 |
| Primary = `[0]` + synced `photo_url` | 2, 3 |
| Import keep-primary / all candidates | 2, 3, 8 |
| PhotoSwipe 5 | 4 |
| Detail inline + fullscreen | 5 |
| Card thumb → lightbox | 6 |
| Edit full manage | 7 |
| No file storage for gallery | Global + Task 7 leave upload alone |
| Agent docs | 8 |
