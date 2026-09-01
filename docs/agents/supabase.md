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

**Project id:** `bkudqalrrpybzwhgdyzr`

### One-time setup (per Cursor install)

1. Ensure the **Supabase** MCP plugin is enabled in Cursor (Settings → MCP).
2. On first use, the namespace shows `needsAuth`. Run **`mcp_auth`** for `plugin-supabase-supabase` (or approve the auth prompt in chat).
3. Confirm with a read query (see below). Re-auth if the namespace returns to `needsAuth`.

No repo env vars or `.env` changes are required for agent reads. MCP uses your Supabase account, not the app’s anon key.

### Listing reads and updates

Use **`execute_sql`** for listing audits and field updates (costs, beds/baths, amenities). Prefer this over the agent API for corrections: one `UPDATE … RETURNING` is fewer tokens and needs no browser session.

Use the [agent listings API](./agent-listings-api.md) for **full imports** when geocoding or photo entitlements must run (address change, `photo_urls` gallery upsert).

**By name**

```sql
select id, name, price_monthly, fees_monthly, pet_rent_monthly,
       deposit, pet_deposit, application_fees, move_in_fees,
       beds, baths, sqft, source_url
from listings
where name ilike '%oceanaire%'
limit 5;
```

**By id**

```sql
select id, name, price_monthly, fees_monthly, pet_rent_monthly,
       deposit, pet_deposit, application_fees, move_in_fees
from listings
where id = 'f3041a20-a198-452c-9c0c-a707fc231efb';
```

**Locale listing list** (ids + money fields)

```sql
select id, name, price_monthly, fees_monthly, pet_rent_monthly
from listings
where locale_id = 'a56b939f-225b-4f6c-ab58-bc9e15063d9b'
  and archived_at is null
order by name;
```

Omit `photo_urls` unless you need the gallery; that column is large.

**Update costs (example)**

```sql
update listings
set price_monthly = 1568,
    fees_monthly = 167,
    pet_rent_monthly = 50,
    application_fees = 400,
    move_in_fees = 55,
    pet_deposit = 500,
    updated_at = now()
where id = 'f3041a20-a198-452c-9c0c-a707fc231efb'
returning id, name, price_monthly, fees_monthly, pet_rent_monthly;
```

**Household defaults** (unless the user says otherwise): 2 pets (dog + cat), 2 applicants (`application_fees` = admin + $75 × 2).
