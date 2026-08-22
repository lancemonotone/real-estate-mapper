# Wayhome — Attribute Compare Design

**Date:** 2026-08-22  
**Status:** Approved for planning (from Nest/Locale backlog)  
**Depends on:** Locale listings + UI chrome; can sit beside proximity Compare  
**Plan:** `docs/superpowers/plans/2026-08-22-wayhome-attribute-compare.md`

## Problem

Households compare more than travel time: rent/price, fees, deposits, sq ft, amenities, pet costs. Proximity Compare does not cover listing attributes.

## Goals

- Locale-scoped **attribute fields** on listings (structured, not free-form invent).
- A **Attributes** compare surface (matrix: listings × selected attributes) or a mode toggle on Compare — prefer **separate page** `/compare/attributes` (or `/attributes`) to avoid mixing travel cells with money cells.
- Fail Fast: empty attributes show blank/explicit “—”; never invent fees.
- Fields chosen for renter/buyer v1 (see below).

## Non-goals

- Scraping guaranteed attribute values from Zillow/etc. (URL import may fill when present; never invent).
- Full CRM amenity taxonomies.
- Cross-Locale attribute matrix.

## v1 attribute set

Store as typed columns and/or a single `listing_attributes` jsonb with a **schema allowlist** in code. Prefer **explicit columns** for queried fields + jsonb for extensibility only if needed. Recommended columns on `listings`:

| Field | Type | Notes |
|-------|------|--------|
| `price_monthly` | numeric nullable | Rent or buy-as-monthly display — label in UI as “Price / mo” |
| `deposit` | numeric nullable | |
| `fees_monthly` | numeric nullable | HOA/amenities fees rolled up if known |
| `sqft` | integer nullable | |
| `beds` | numeric nullable | allow 0.5 |
| `baths` | numeric nullable | |
| `pet_rent_monthly` | numeric nullable | |
| `pet_deposit` | numeric nullable | |
| `amenities` | text[] nullable | curated chips later; v1 simple tags |

Currency: display as USD for v1 (no FX). Missing → em dash, not `$0`.

## UI

- Listing form: optional attribute inputs (same Fail Fast empty).
- Locale nav: **Attributes** next to Compare.
- Matrix: rows listings, columns attributes; sticky first column.
- No “winner” highlighting unless user asks later.

## Import

- URL extract: map known meta when present; leave null otherwise (existing extract policy).

## Testing

- Unit: format money / empty display helpers.
- Manual: fill two listings; matrix shows values and blanks correctly.
