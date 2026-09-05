# Tours Drive overview — implementation plan

> **For agentic workers:** Spec: `docs/superpowers/specs/2026-09-05-tours-drive-view-design.md`

## Chunk 1: Maps multi-stop URL

- Extend `src/lib/proximity/maps-url.ts` with day directions builder (max 9 waypoints).
- Tests in `tests/maps-url.test.ts`.

## Chunk 2: Drive page

- Add `src/pages/app/locales/[localeId]/tours/[id]/drive.astro`.
- Reuse tour load, `tourDayDriveLabel`, `formatAppointmentTime`, `formatTravelMeta`.
- Sticky header + stop list + leg rows; link back to Tours.

## Chunk 3: Entry + CSS

- **Drive** button on Tours workspace day header (`tours/index.astro`).
- Optional: same link on `tours/[id].astro`.
- Styles in `chrome.css` (`.tours-drive`), responsive-css skill.
