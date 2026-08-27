# Wayhome monetization — design spec

**Date:** 2026-08-27  
**Status:** Approved for implementation  
**Product:** Wayhome (household Nest / Locale / tour planner)

## Problem

Wayhome’s differentiated value (shared Nest workspace, multi-day tour planning, proximity compare) incurs real Google Maps Platform cost (Routes, Places). Households use the product intensely for weeks, then churn. Revenue must cover API spend without turning the product into an agent CRM.

## Audience (v1 payee)

**Primary customer:** households hunting together — couples, roommates, families — who own a Nest, collect listings in Locales, and plan driving tours. Buyers and renters.

**Not the v1 payee:** real estate agents. Agents may join a Nest as members and benefit from the Nest’s Pass. Agent-specific Pro (separate SKU, client limits) is a later phase.

## Model

**Freemium + one paid tier:** **Hunt Pass** — **$29 for 90 days**, scoped to a single Nest.

- Pass is purchased by the **Nest owner only**.
- Pass applies to the **Nest**, not the user (a user in three Nests needs three Passes if all three need Pro).
- **No subscription** in v1; Hunt Pass is a time-boxed unlock aligned with a typical search window.
- **No ads** as a primary revenue path (logged-in product, short usage window, trust-sensitive UX).
- **No usage-based overage billing** in v1 (hard caps with support path).

### Competitive context (informing price, not requirements)

- [Housey](https://www.housey.app/): buyers free; agents $29/mo.
- [Toured](https://apps.apple.com/us/app/toured-home-tour-log/id6766548041): free for 5 homes; ~$5 one-time.
- [ScoreHome](https://scorehome.app/): free for 3 properties; ~$25 one-time.

Wayhome sits between lightweight tour logs and agent workspace tools, with proximity compare as the paid differentiator.

## Free vs Pro caps

| Limit | Free | Pro (active Hunt Pass) |
|-------|------|------------------------|
| Listings (visible scope) | **12** | **100** (fair-use unlimited later if needed) |
| Tour days (with ≥1 stop) | **3** | Unlimited |
| Locales | **1** | **5** |
| Proximity compare | **1 demo run** per Nest, then locked | Full access |
| Proximity refresh budget | — | **60** per Pass window (+60 unused stacks on early renew) |
| Photos per listing (visible) | **8** | **30** (or fair-use unlimited) |
| Household member invites | Unlimited | Unlimited |
| Scratch route optimize | Allowed (visible listings only) | Allowed |
| Saved tour day optimize | Allowed (visible tour days only) | Allowed |

### Cap counting rules

- **Tour days:** only days with **≥1 stop** count toward the cap. Empty tour days do not count.
- **Archived listings:** do **not** count toward listing cap while archived; restoring counts again.
- **Locales on Free:** block **create** of a second Locale (do not create-then-hide).
- **At listing cap on Free:** block **add** and **URL import**; allow **edit/delete** on visible listings.
- **Batch import over cap:** **partial import** — fill oldest-order slots until cap; reject remainder with a clear message.
- **Promote scratch → tour day on Free:** blocked when at 3 tour days (or upgrade).

## Proximity (Free vs Pro)

- **Free:** **one demo run per Nest, ever** (separate from Pro refresh pool). After demo, proximity UI shows upgrade CTA; no new Places spend.
- **Pro:** **60 proximity refreshes** for the Pass window (~20/month average). Counter runs from Pass `started_at` through `expires_at`.
- **Early renew:** unused refresh budget **stacks** (+60 added to remaining balance when Pass is extended).
- **Above 60 refreshes:** **hard block** in v1; message to contact support (no silent overage billing).
- **After downgrade:** show **cached proximity read-only** for **visible** Locales/listings only; no new compute/refresh. Hidden Locale proximity is hidden with the Locale.

## Downgrade behavior (Free caps after Pro ends)

When a Nest is Free and **over** any Free cap, apply **strict hide** (data is never deleted):

1. **Locales:** only the **oldest 1** Locale is visible; newer Locales are hidden.
2. **Listings:** within **visible** Locales only, show the **oldest 12** listings; hide newer excess. Listings in hidden Locales are hidden (they do not consume visible slots).
3. **Tour days:** show the **oldest 3** tour days (with ≥1 stop); hide newer excess.
4. **Photos:** per visible listing, show the **oldest 8** photos; hide newer excess.

**UX:** banner for owner — e.g. “2 Locales and 28 listings hidden. Renew Hunt Pass to see everything.”

**Renew Pro:** all hidden rows become visible again immediately (no re-import).

## Hunt Pass lifecycle

| Event | Behavior |
|-------|----------|
| **Purchase** | Nest gains Pro until `expires_at` = now + 90 days. Refresh budget = 60 (or +60 if stacking). |
| **Early renew** (Pass still active) | **Stack time:** `expires_at` += 90 days from **current** expiry. Add +60 to refresh balance (unused stacks). |
| **7 days before expiry** | **Nag:** in-app banner + email to Nest owner (“Pass ends in X days”). |
| **At expiry** | **No grace.** Immediate downgrade to Free caps and hide rules. |
| **Refund** | Immediate downgrade; hide rules apply. No “keep Pro until period end.” |
| **Failed renew payment** | No extension; Free at expiry. |

## Billing & access edge cases

| Edge case | Behavior |
|-----------|----------|
| **Who can buy** | Nest **owner** only. Members see “Ask [owner] to upgrade.” |
| **Ownership transfer** | Pass stays on Nest; **new owner** inherits Pro until expiry. Former owner loses billing portal access. |
| **Nest deleted with active Pass** | **No automatic refund** (v1). Deletion flow warns if Pass is active. |
| **Double checkout** | Stripe + **idempotent webhook:** one Pass extension per payment; duplicate → support/refund policy. |
| **Webhook delay** | **Optimistic Pro** after successful checkout redirect; webhook reconciles. Brief over-provision acceptable; fail closed only on confirmed payment failure. |
| **Agent on household Pass** | **Allowed** — agent rides Nest Pro. Agent SKU is later. |
| **Owner leaves Nest** | Require ownership transfer before leave, or Pass follows Nest ownership rules (do not strand members without an owner). |
| **Many Free Nests per account** | **Allowed** in v1 (each Nest capped independently). Monitor Routes cost; add per-account rate limits if abuse appears. |

## Launch / migration

- **No grandfathering.** When billing ships, enforce Free caps immediately on all Nests.
- Nests already over caps: apply hide rules (oldest visible); show upgrade CTA.
- Proximity demo flag: existing Nests get **one** demo if not yet consumed (or consume on first proximity attempt).

## Non-goals (v1 billing)

- Agent Pro SKU ($29/mo, client limits, branding)
- Monthly subscription option
- AdSense / display ads
- Affiliate / partner revenue
- Automatic overage charges beyond refresh cap
- Per-user Pass (Pass is per Nest)
- Member-initiated checkout
- Partial refunds or “Pro until end of period” after refund

## Implementation sketch (for planning)

### Data

Extend Nest (or dedicated `nest_subscriptions` table):

- `plan`: `free` | `pro`
- `pass_started_at`, `pass_expires_at` (nullable)
- `proximity_demo_used_at` (nullable) — one demo per Nest
- `proximity_refresh_used` (int) — count within current Pass window
- `stripe_customer_id`, `stripe_payment_intent_or_session_id` (for reconciliation)

Recompute effective caps server-side on every gated action (fail fast; no client-only enforcement).

### Gated actions (server)

- Create listing / import URL / batch import
- Create Locale
- Create tour day / promote scratch → tour day
- Proximity compute / refresh (demo vs Pro pool)
- Photo upload

### UI

- Owner: Upgrade / Renew Hunt Pass (Stripe Checkout)
- Member: owner-only upgrade messaging
- Expiry nag (7-day window)
- Over-cap / hidden-content banner with counts
- Proximity: locked state, demo consumed state, refresh budget remaining (Pro)

### Stripe (v1)

- One-time payment product: Hunt Pass 90 days
- Webhook: `checkout.session.completed` → set Pro window, stack renew rules, idempotency key on session/payment id
- Customer portal optional later (v1: renew via same Checkout flow)

## Success criteria

- Free tier supports a small hunt (12 listings, 3 tour days, 1 Locale, scratch optimize) without Places-heavy proximity.
- Pro tier covers a serious multi-Locale hunt for 90 days with refresh budget that protects margin.
- Downgrade never deletes user data; hide rules are predictable (oldest visible).
- Owner-only billing matches household “one person pays” norm.

## User-facing documentation & pricing (required before billing ships)

Billing is not shippable without customer-visible copy that matches enforced limits. Internal spec caps and UI gates must use the **same numbers and vocabulary** (Free, Hunt Pass, Nest owner).

### Deliverables

| Artifact | Audience | Purpose |
|----------|----------|---------|
| **Pricing page** (`/pricing` or public marketing route) | Prospects + logged-in users | Free vs Hunt Pass comparison, $29 / 90 days, who pays (Nest owner), link to Checkout |
| **Plans & limits help** (`docs/help/plans-and-limits.md` or in-app Help) | Active users | Exact caps, what counts (tour days with stops, archived listings), hide-on-downgrade behavior |
| **Billing FAQ** (section on pricing page or `/help/billing`) | Owners | Renew/stack rules, refunds, expiry nag, hidden content after expiry, ownership transfer |
| **In-app upgrade surfaces** | Owner vs member | Short copy on upgrade CTAs, expiry banner, over-cap banner (not long prose) |
| **Checkout / receipt email** | Owner | Pass start/end dates, Nest name, support contact |

### Pricing page content (v1 outline)

- **Headline:** hunt together; one Nest, one Pass when you need the full toolkit.
- **Free:** 12 listings, 3 tour days, 1 Locale, map + route optimize on visible listings, 1 proximity demo, 8 photos per listing.
- **Hunt Pass — $29 / 90 days:** 100 listings, unlimited tour days, 5 Locales, proximity compare + 60 refreshes, higher photo cap. Per Nest; Nest owner purchases.
- **Not included (v1):** agent Pro, monthly sub, ads.
- **CTA:** owner → Upgrade; logged-out → sign up.

Tone: plain language, no invented marketing claims. Fail fast: if a limit is not listed on the pricing page, do not enforce it without updating the page.

### Help doc sections (user-facing)

1. **Who can upgrade** — owner only; members ask the owner.
2. **What Hunt Pass includes** — table aligned with Free vs Pro caps above.
3. **When Pass ends** — no grace; 7-day reminder; oldest content stays visible; newer excess hidden until renew or delete.
4. **Proximity** — one free demo per Nest; refreshes during Pass; cached results read-only after downgrade.
5. **Renew early** — +90 days from current expiry; unused refreshes stack (+60).
6. **Refunds** — immediate downgrade (link to policy once legal review done).
7. **Agents** — can use Nest Pro when invited; no separate agent billing in v1.

### Implementation plan dependency

User-facing docs and pricing page are a **ship gate** alongside Stripe webhook + server-side gates. Draft help markdown when implementation plan is written; publish pricing page before enabling Checkout in production.

## Open for implementation plan (not product open questions)

- Exact Stripe product/price IDs and env vars
- `nest_subscriptions` vs columns on `nests` / `workspaces` table (match existing Nest schema naming)
- Email provider for expiry nag
- Fair-use policy text for 100 listings / 30 photos if enforced manually
- Legal review: refund policy, terms of service pricing section
- Route paths for `/pricing` and help (Astro pages vs static docs)
