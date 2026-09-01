## Agent skills

### Issue tracker

Issues live in this repo's GitHub Issues (via `gh`). See `docs/agents/issue-tracker.md`.

### Triage labels

Canonical labels: needs-triage, needs-info, ready-for-agent, ready-for-human, wontfix. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: root `CONTEXT.md` + `docs/adr/`. See `docs/agents/domain.md`.

### Agent listings API

Session JSON create/list/update for AI agents: `docs/agents/agent-listings-api.md`.

Import-from-URL workflow skill: `.cursor/skills/wayhome-import-listing/SKILL.md`.

**Listing data (reads and field updates)**

| Task | Tool |
|------|------|
| Audit stored costs, compare to a paste, look up id/name | **Supabase MCP** `execute_sql` |
| Update money fields, beds/baths, amenities, etc. | **Supabase MCP** `execute_sql` |
| Full import with geocoding / photo gallery upsert | **Agent API** (`PUT` / `PATCH`) when address or `photo_urls` change |

Prefer Supabase MCP for listing field updates (fewer tokens, no browser session). Use the agent API when import logic must run (geocoding on address change, entitlements on photo adds).

### Supabase

Migrations and remote DB: use **`npm run db:push`** / **`npm run db:status`** (see `package.json`) and the **Supabase MCP** — do not default to “paste this into the SQL editor.” Details: `docs/agents/supabase.md`.

### Working tree

Use a **single** checkout on `staging` (repo root). Do **not** create git worktrees for feature work in this project — branch in place or short-lived feature branches, then merge to `staging`.
