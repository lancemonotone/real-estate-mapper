# Vercel (agents)

Vercel hosts the **Astro SSR app**. It does **not** run database migrations.

## Hosting vs database (do not confuse)

| Concern | Where | Agent path |
|---------|--------|------------|
| App deploy / env / domains | **Vercel** | This doc. Prefer read-only unless the user asks to change prod. |
| Schema / SQL migrations | **Supabase** | [`supabase.md`](./supabase.md): `npm run db:push`, `npm run db:status`, Supabase MCP |

Pushing to GitHub may trigger a Vercel rebuild. That does **not** apply `supabase/migrations/`. After a schema change, still run **`npm run db:push`** (or MCP `apply_migration`) against project `bkudqalrrpybzwhgdyzr`.

## This product’s production host

| Item | Value |
|------|--------|
| GitHub repo | `lancemonotone/real-estate-mapper` |
| Production URL | `https://wayhome.rusmiller.com` |
| Vercel project alias (secondary) | `https://real-estate-mapper.vercel.app` |
| Adapter | `@astrojs/vercel` in `astro.config.mjs` (`output: "server"`) |
| Typical deploy trigger | GitHub → Vercel (`vercel[bot]` deployments on Production / Preview) |
| Production branch (GitHub default) | `main` |

**Canonical prod** is the custom domain. Prefer it for `PUBLIC_SITE_URL`, Maps browser-key referrers, and “fix prod” checks.

**Not this app** (different products / stacks; do not change their settings while working here):

- `https://www.wayhome.app` (Next.js “Wayhome Realtors”)
- `https://wayhome.vercel.app` (Vite + React)
- `https://wayhome.app` (wayhome.ai marketing)

Deployment-specific URLs like `https://real-estate-mapper-*-lance-monotone.vercel.app` are one-off aliases from GitHub deployment statuses, not production.

## Safety (default)

Unless the user explicitly asks to change production:

- Do **not** run `vercel deploy`, promote, rollback, or delete deployments.
- Do **not** edit / add / remove Vercel environment variables or domains.
- Do **not** change Production branch, build settings, or project name/link.
- Prefer **inspect** only: dashboard, GitHub Deployments API, or a logged-in `vercel` CLI read (`whoami`, `project ls`, `env ls`, `inspect`).

If the CLI is logged out, discover deploy state via GitHub (read-only):

```bash
gh api repos/lancemonotone/real-estate-mapper/deployments?environment=Production&per_page=3
# then statuses on a deployment id for environment_url
```

Linking this folder with `vercel link` only writes local `.vercel/`; ask before linking if unsure. Never use link options that create a **new** Vercel project for an existing prod app.

## App env vars (must match Vercel project settings)

From `.env.example` / `src/env.d.ts`. Secrets are runtime `process.env` on Vercel (see `src/lib/env.ts`).

| Variable | Notes |
|----------|--------|
| `PUBLIC_SUPABASE_URL` | Client + middleware |
| `PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Client + middleware |
| `SUPABASE_SECRET_KEY` | Server-only |
| `GOOGLE_MAPS_API_KEY` | Server-only (Geocoding, Routes, Places) |
| `PUBLIC_GOOGLE_MAPS_BROWSER_KEY` | Browser Maps JS; restrict referrers to prod host(s) |
| `PUBLIC_GOOGLE_MAPS_MAP_ID` | Advanced Markers |
| `PUBLIC_SITE_URL` | Canonical site URL (invites, absolute links); prod should be `https://wayhome.rusmiller.com` |
| `DEV_TOOLS` / `PUBLIC_DEV_TOOLS` | Optional; leave unset in prod unless deliberately enabling Settings debug |

Agents should **list/compare** env names only when asked. Do not print secret values into chat or commits.

## Local vs prod

- Local: `npm run dev` (see root `README.md`).
- Prod build: `npm run build` (Astro + Vercel adapter). Agents may run build locally to verify; that does not deploy.

## When the user asks to “fix prod”

1. Confirm which host (`wayhome.rusmiller.com` vs other wayhome.* sites).
2. If the issue is data/schema → Supabase (`docs/agents/supabase.md`), not Vercel.
3. If the issue is the running app → inspect recent Production deployment + logs; change code on a branch and let the normal Git → Vercel flow ship after review. Do not hot-fix Vercel settings as a substitute for a code fix.
