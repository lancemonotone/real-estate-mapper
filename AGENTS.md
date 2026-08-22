## Agent skills

### Issue tracker

Issues live in this repo's GitHub Issues (via `gh`). See `docs/agents/issue-tracker.md`.

### Triage labels

Canonical labels: needs-triage, needs-info, ready-for-agent, ready-for-human, wontfix. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: root `CONTEXT.md` + `docs/adr/`. See `docs/agents/domain.md`.

### Supabase

Migrations and remote DB: use **`npm run db:push`** / **`npm run db:status`** (see `package.json`) and the **Supabase MCP** — do not default to “paste this into the SQL editor.” Details: `docs/agents/supabase.md`.

### Working tree

Use a **single** checkout on `staging` (repo root). Do **not** create git worktrees for feature work in this project — branch in place or short-lived feature branches, then merge to `staging`.
