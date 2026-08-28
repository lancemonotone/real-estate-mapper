import { describe, expect, it } from 'vitest';
import {
  applyHuntPassActivation,
  buildTourCalendarContext,
  checkEntitlementGate,
  isNestPro,
  resolveNestEntitlements,
  resolveNestPlan,
  resolveTourDrop,
  sliceVisiblePhotoUrls,
} from '../src/lib/nest/entitlements';

const baseBilling = {
  pass_started_at: null,
  pass_expires_at: null,
  proximity_demo_used_at: null,
  proximity_refresh_granted: 0,
  proximity_refresh_used: 0,
};

describe('nest entitlements', () => {
  it('detects Pro while pass_expires_at is in the future', () => {
    const future = new Date('2026-12-01T00:00:00Z');
    const billing = {
      ...baseBilling,
      pass_expires_at: future.toISOString(),
    };
    expect(isNestPro(billing, new Date('2026-08-27T00:00:00Z'))).toBe(true);
    expect(resolveNestPlan(billing, new Date('2026-08-27T00:00:00Z'))).toBe('pro');
    expect(isNestPro(billing, new Date('2027-01-01T00:00:00Z'))).toBe(false);
  });

  it('hides newer locales, listings, and tour days on Free', () => {
    const snapshot = resolveNestEntitlements({
      billing: baseBilling,
      locales: [
        { id: 'loc-1', created_at: '2026-01-01T00:00:00Z' },
        { id: 'loc-2', created_at: '2026-02-01T00:00:00Z' },
      ],
      listings: [
        {
          id: 'l-1',
          locale_id: 'loc-1',
          created_at: '2026-01-02T00:00:00Z',
          archived_at: null,
        },
        {
          id: 'l-2',
          locale_id: 'loc-1',
          created_at: '2026-01-03T00:00:00Z',
          archived_at: null,
        },
        {
          id: 'l-hidden-locale',
          locale_id: 'loc-2',
          created_at: '2026-01-04T00:00:00Z',
          archived_at: null,
        },
      ],
      tourDays: [
        {
          id: 'd-1',
          locale_id: 'loc-1',
          created_at: '2026-01-05T00:00:00Z',
          stop_count: 2,
        },
        {
          id: 'd-2',
          locale_id: 'loc-1',
          created_at: '2026-01-06T00:00:00Z',
          stop_count: 1,
        },
        {
          id: 'd-3',
          locale_id: 'loc-1',
          created_at: '2026-01-07T00:00:00Z',
          stop_count: 1,
        },
        {
          id: 'd-4',
          locale_id: 'loc-1',
          created_at: '2026-01-08T00:00:00Z',
          stop_count: 1,
        },
      ],
    });

    expect(snapshot.plan).toBe('free');
    expect(snapshot.visibleLocaleIds).toEqual(new Set(['loc-1']));
    expect(snapshot.visibleListingIds).toEqual(new Set(['l-1', 'l-2']));
    expect(snapshot.visibleTourDayIds).toEqual(new Set(['d-1', 'd-2', 'd-3']));
    expect(snapshot.hidden.locales).toBe(1);
    expect(snapshot.hidden.listings).toBe(0);
    expect(snapshot.hidden.tourDays).toBe(1);
  });

  it('excludes archived listings from caps', () => {
    const listings = Array.from({ length: 12 }, (_, index) => ({
      id: `l-${index}`,
      locale_id: 'loc-1',
      created_at: `2026-01-${String(index + 1).padStart(2, '0')}T00:00:00Z`,
      archived_at: null,
    }));
    listings.push({
      id: 'archived',
      locale_id: 'loc-1',
      created_at: '2026-02-01T00:00:00Z',
      archived_at: '2026-02-01T00:00:00Z',
    });

    const snapshot = resolveNestEntitlements({
      billing: baseBilling,
      locales: [{ id: 'loc-1', created_at: '2026-01-01T00:00:00Z' }],
      listings,
      tourDays: [],
    });

    expect(snapshot.activeListingCount).toBe(12);
    expect(checkEntitlementGate(snapshot, 'add_listing', { localeId: 'loc-1' }).ok).toBe(
      false,
    );
  });

  it('allows one proximity demo on Free then blocks', () => {
    const snapshot = resolveNestEntitlements({
      billing: baseBilling,
      locales: [],
      listings: [],
      tourDays: [],
    });
    expect(checkEntitlementGate(snapshot, 'proximity_compute').ok).toBe(true);

    const used = resolveNestEntitlements({
      billing: {
        ...baseBilling,
        proximity_demo_used_at: '2026-08-27T00:00:00Z',
      },
      locales: [],
      listings: [],
      tourDays: [],
    });
    expect(checkEntitlementGate(used, 'proximity_compute').ok).toBe(false);
  });

  it('tracks Pro proximity refresh budget', () => {
    const billing = {
      ...baseBilling,
      pass_started_at: '2026-08-01T00:00:00Z',
      pass_expires_at: '2026-12-01T00:00:00Z',
      proximity_refresh_granted: 60,
      proximity_refresh_used: 59,
    };
    const snapshot = resolveNestEntitlements({
      billing,
      locales: [],
      listings: [],
      tourDays: [],
    });
    expect(snapshot.proximityRefreshRemaining).toBe(1);
    expect(checkEntitlementGate(snapshot, 'proximity_refresh').ok).toBe(true);

    const exhausted = resolveNestEntitlements({
      billing: { ...billing, proximity_refresh_used: 60 },
      locales: [],
      listings: [],
      tourDays: [],
    });
    expect(checkEntitlementGate(exhausted, 'proximity_refresh').ok).toBe(false);
  });

  it('stacks Hunt Pass renewals', () => {
    const now = new Date('2026-08-27T12:00:00Z');
    const billing = {
      ...baseBilling,
      pass_started_at: '2026-07-01T00:00:00Z',
      pass_expires_at: '2026-09-15T00:00:00Z',
      proximity_refresh_granted: 60,
      proximity_refresh_used: 10,
    };
    const next = applyHuntPassActivation(billing, now);
    expect(next.pass_expires_at).toBe('2026-12-14T00:00:00.000Z');
    expect(next.proximity_refresh_granted).toBe(120);
    expect(next.proximity_refresh_used).toBe(10);
  });

  it('starts a fresh Pass after expiry', () => {
    const now = new Date('2026-10-01T00:00:00Z');
    const billing = {
      ...baseBilling,
      pass_started_at: '2026-01-01T00:00:00Z',
      pass_expires_at: '2026-08-01T00:00:00Z',
      proximity_refresh_granted: 60,
      proximity_refresh_used: 40,
    };
    const next = applyHuntPassActivation(billing, now);
    expect(next.pass_started_at).toBe(now.toISOString());
    expect(next.pass_expires_at).toBe('2026-12-30T00:00:00.000Z');
    expect(next.proximity_refresh_granted).toBe(60);
    expect(next.proximity_refresh_used).toBe(0);
  });

  it('slices photo urls to plan limit', () => {
    const urls = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i'];
    expect(sliceVisiblePhotoUrls(urls, 'free')).toEqual(['a']);
    expect(sliceVisiblePhotoUrls(urls, 'pro').length).toBe(9);
  });
});

describe('tour calendar entitlements', () => {
  it('blocks drops on hidden days and empty days when at cap', () => {
    const snapshot = resolveNestEntitlements({
      billing: {
        pass_started_at: null,
        pass_expires_at: null,
        proximity_demo_used_at: null,
        proximity_refresh_granted: 0,
        proximity_refresh_used: 0,
      },
      locales: [{ id: 'loc-1', created_at: '2026-01-01T00:00:00Z' }],
      listings: [],
      tourDays: [
        { id: 'd-1', locale_id: 'loc-1', created_at: '2026-01-05T00:00:00Z', stop_count: 1 },
        { id: 'd-2', locale_id: 'loc-1', created_at: '2026-01-06T00:00:00Z', stop_count: 1 },
        { id: 'd-3', locale_id: 'loc-1', created_at: '2026-01-07T00:00:00Z', stop_count: 1 },
        { id: 'd-4', locale_id: 'loc-1', created_at: '2026-01-08T00:00:00Z', stop_count: 2 },
      ],
    });

    const ctx = buildTourCalendarContext(
      snapshot,
      [
        { id: 'd-1', tour_date: '2026-09-09' },
        { id: 'd-2', tour_date: '2026-09-10' },
        { id: 'd-3', tour_date: '2026-09-12' },
        { id: 'd-4', tour_date: '2026-09-11' },
      ],
      [
        { tour_day_id: 'd-1', listing_id: 'l-1' },
        { tour_day_id: 'd-2', listing_id: 'l-2' },
        { tour_day_id: 'd-3', listing_id: 'l-3' },
        { tour_day_id: 'd-4', listing_id: 'l-4' },
        { tour_day_id: 'd-4', listing_id: 'l-5' },
      ],
    );

    expect(ctx.canAddNewTourDay).toBe(false);
    expect(ctx.assignedListingIds).toEqual(new Set(['l-1', 'l-2', 'l-3', 'l-4', 'l-5']));
    expect(ctx.assignedOnHiddenDayIds).toEqual(new Set(['l-4', 'l-5']));
    expect(resolveTourDrop(ctx, '2026-09-11')).toEqual({
      ok: false,
      message: ctx.hiddenMessage,
    });
    expect(resolveTourDrop(ctx, '2026-09-15')).toEqual({
      ok: false,
      message: ctx.capMessage,
    });
    expect(resolveTourDrop(ctx, '2026-09-09')).toEqual({ ok: true, action: 'merge' });
  });
});
