# Supabase (agents)

Do **not** ask the user to paste migration SQL into the dashboard when these tools are available.

## CLI (`package.json`)

| Script | Purpose |
|--------|---------|
| `npm run db:login` | One-time Supabase CLI auth |
| `npm run db:link` | Link to the project (`bkudqalrrpybzwhgdyzr`) |
| `npm run db:push` | Apply pending files under `supabase/migrations/` |
| `npm run db:status` | Local vs remote migration list |

Prefer **`npm run db:push`** after adding a migration. Check with **`npm run db:status`** when unsure whether remote is caught up.

## MCP

Cursor has the **Supabase MCP** (`plugin-supabase-supabase`). Use it for:

- Listing / applying migrations when appropriate
- `execute_sql`, table/schema inspection, advisors, logs
- Project URL / keys when configuring the app

Load the **supabase** skill when doing schema, RLS, Auth, or migration work. Prefer MCP + CLI over manual SQL editor instructions in chat.
