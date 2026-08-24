# Listing consolidate + Tours Plan — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Remove Unscheduled nav; consolidate listing page; add Tours **Plan**.

**Architecture:** Reuse `/api/tours/assign`, `/optimize`, `/promote-scratch`. UI rename only. Spec: `docs/superpowers/specs/2026-08-23-listing-tours-plan-design.md`.

**Tech Stack:** Astro SSR, existing chrome CSS, `public/scripts/`.

## File map

| File | Change |
|------|--------|
| `src/lib/ui/locale-nav.ts` | Drop `unscheduled` |
| `src/components/LocaleNav.astro` | Remove Unscheduled tab |
| `src/pages/app/locales/[localeId]/unscheduled.astro` | Redirect to tours `#plan` |
| `src/pages/app/locales/[localeId]/tours/index.astro` | Tour list + Plan section |
| `public/scripts/tours-plan.js` | Preview route + save (from unscheduled inline) |
| `src/pages/app/locales/[localeId]/listings/[id].astro` | New layout: hero → tour → edit → travel |
| `src/styles/chrome.css` | Minimal listing/tour/plan layout helpers |

## Tasks

1. Nav + redirect  
2. Tours Plan UI + `tours-plan.js`  
3. Listing page restructure  
4. Manual smoke  

No separate commits required unless user asks.
