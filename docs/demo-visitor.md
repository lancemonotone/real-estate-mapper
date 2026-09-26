# Demo visitor (portfolio entry)

Synthetic session for public portfolio visitors. **No database migrations** — signed cookie + env tokens only. Live Nest/Locale data is readable; durable writes and Google Places spend are blocked.

## Config

In `.env` / Vercel (not committed):

```bash
DEMO_VISITOR_TOKEN=<long-random-hex>
DEMO_NEST_ID=571e710b-10a2-412f-9ddb-740923168397
DEMO_SESSION_SECRET=<long-random-hex>
```

Empty or missing `DEMO_VISITOR_TOKEN` = demo entry disabled. Generate with:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

See also `.env.example`. Requires existing `SUPABASE_SECRET_KEY` for demo reads (service role).

## Entry URL

Query param: **`v`** (same as Briefboard)

Pattern: `{PUBLIC_SITE_URL}/?v={DEMO_VISITOR_TOKEN}`

`/?v=…` keeps the marketing splash and runs the login theater on that page (Briefboard-style entry). `/login?v=…` also still works.

**Local entry URL** (token from local `.env`):

http://localhost:4321/?v=e39a2a4064e24585bb290734787229e4f57bf2b90b428e7124bafa37cf465a94

**Production** (set the same three env vars on Vercel, then):

https://wayhome.rusmiller.com/?v=e39a2a4064e24585bb290734787229e4f57bf2b90b428e7124bafa37cf465a94

Replace the `v` value if you rotate `DEMO_VISITOR_TOKEN`. Owner updates rusmiller.com portfolio links (not edited in this repo).

## Behavior

1. Logged out + matching `?v=` → login theater (~1.2s) → **Demo visitor** session.
2. Banner: **Demo · changes won’t save**.
3. Routine edits (listing autosave, favorite/passed) update the open UI only; refresh restores server data.
4. Destructive / settings / Places / proximity spend → **Demo · not saved** (server fail-closed).
5. Tour **route optimize** is allowed for the demo Nest (Google Routes + cache write on that Nest only). Favorites in demo stay session-only and do not remove tour stops.
6. Already signed in as a real user → `v` is ignored (no kick into demo).
7. Agent API is unchanged; the hash never grants a real auth user or admin powers.

## Manual checklist

- [ ] Cold start with hash → theater → demo session + banner
- [ ] Normal login without hash → real user, no banner
- [ ] Demo listing field / favorite → UI ok → hard refresh restores server data
- [ ] Delete / Places autocomplete (or settings write) → toast **Demo · not saved**, nothing durable / no Google spend
- [ ] Logged-in real session + `?v=` in URL → stays real, no demo kick
