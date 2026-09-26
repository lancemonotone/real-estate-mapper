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

`/?v=…` shows the marketing splash (route animation), simulates clicking **Sign in**, then runs the login credential theater and enters the app. `/login?v=…` still runs theater only.

**Local entry URL** (token from local `.env`):

http://localhost:4321/?v=e39a2a4064e24585bb290734787229e4f57bf2b90b428e7124bafa37cf465a94

**Production** (set the same three env vars on Vercel, then):

https://wayhome.rusmiller.com/?v=e39a2a4064e24585bb290734787229e4f57bf2b90b428e7124bafa37cf465a94

Replace the `v` value if you rotate `DEMO_VISITOR_TOKEN`. Owner updates rusmiller.com portfolio links (not edited in this repo).

## Behavior

1. Logged out + matching `?v=` → splash animation → simulated Sign in → login theater → **Demo visitor** session.
2. Banner: **Demo · changes won’t save**.
3. **Session overlay:** routine edits (theme, borders, favorites/passed, listing fields, tour calendar actions, etc.) are intercepted in the client. They appear to save and stick across in-app navigation. **Hard refresh** clears the overlay and restores server data. Nothing routine is written to the DB.
4. Destructive / Places autocomplete-details / proximity spend / create-delete / auto-plan-apply → toast **Demo · not saved** (no network write). Place **photo** GETs for already-known place ids (proximity thumbs) are allowed.
5. Tour **route optimize** may run for the demo Nest (Google Routes + cache on that Nest only).
6. Auto-plan **preview** is allowed (read-only). Apply remains blocked.
7. Already signed in as a real user → `v` is ignored.
8. Logout clears the demo cookie and the overlay.

## Manual checklist

- [ ] Cold start with `?v=` → splash → theater → demo session + banner
- [ ] Normal login without hash → real user, no banner
- [ ] Theme / borders / favorite / listing field → appear saved → soft-nav keeps them → hard refresh restores server data
- [ ] Tour calendar routine edits → appear kept for session (no sticky route error after soft success)
- [ ] Delete / Places / invite rotate / proximity spend → toast **Demo · not saved**, nothing durable
- [ ] Tour optimize on demo Nest → allowed (Google Routes + cache on that Nest)
- [ ] Logged-in real session + `?v=` → stays real, no demo kick
