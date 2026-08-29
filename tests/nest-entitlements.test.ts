import { describe, expect, it } from 'vitest';
import {
  applyHuntPassActivation,
  buildRouteSearchPlanContext,
  buildTourCalendarContext,
  checkAddTourDaysWithStopsBatch,
  checkEntitlementGate,
  devHuntPassPreviewBilling,
  isListingCapReached,
  isLocaleCapReached,
  isRouteSearchColumnCapReached,
  isNestPro,
  resolveNestEntitlements,
  resolveNestPlan,
  resolveTourDrop,
  sliceVisiblePhotoUrls,
} from '../src/lib/nest/entitlements';

const baseBilling = {
  pass_started_at: null,
  pass_expires_at: null,
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

  it('allows proximity compute on Free and blocks refresh', () => {
    const snapshot = resolveNestEntitlements({
      billing: baseBilling,
      locales: [{ id: 'loc-1', created_at: '2026-01-01T00:00:00Z' }],
      listings: [],
      tourDays: [],
      routeSearchCriteria: [{ locale_id: 'loc-1' }],
    });
    expect(checkEntitlementGate(snapshot, 'proximity_compute').ok).toBe(true);
    expect(checkEntitlementGate(snapshot, 'proximity_refresh').ok).toBe(false);
  });

  it('allows one route search column on Free then blocks another', () => {
    const empty = resolveNestEntitlements({
      billing: baseBilling,
      locales: [{ id: 'loc-1', created_at: '2026-01-01T00:00:00Z' }],
      listings: [],
      tourDays: [],
      routeSearchCriteria: [],
    });
    expect(
      checkEntitlementGate(empty, 'add_route_search_column', { localeId: 'loc-1' }).ok,
    ).toBe(true);

    const capped = resolveNestEntitlements({
      billing: baseBilling,
      locales: [{ id: 'loc-1', created_at: '2026-01-01T00:00:00Z' }],
      listings: [],
      tourDays: [],
      routeSearchCriteria: [{ locale_id: 'loc-1' }],
    });
    expect(capped.routeSearchColumnCount).toBe(1);
    expect(
      checkEntitlementGate(capped, 'add_route_search_column', { localeId: 'loc-1' }).ok,
    ).toBe(false);
    expect(checkEntitlementGate(capped, 'proximity_compute').ok).toBe(true);
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

  it('slices photo URLs on Free', () => {
    const urls = ['a.jpg', 'b.jpg', 'c.jpg'];
    expect(sliceVisiblePhotoUrls(urls, 'free')).toEqual(['a.jpg']);
    expect(sliceVisiblePhotoUrls(urls, 'pro')).toEqual(urls);
  });

  it('stacks Hunt Pass renewals', () => {
    const billing = {
      ...baseBilling,
      pass_started_at: '2026-06-01T00:00:00Z',
      pass_expires_at: '2026-09-01T00:00:00Z',
      proximity_refresh_granted: 60,
      proximity_refresh_used: 10,
    };
    const activation = applyHuntPassActivation(billing, new Date('2026-08-01T00:00:00Z'));
    expect(activation.proximity_refresh_granted).toBe(120);
    expect(activation.proximity_refresh_used).toBe(10);
    expect(new Date(activation.pass_expires_at).toISOString()).toBe('2026-11-30T00:00:00.000Z');
  });

  it('buildTourCalendarContext blocks hidden days and new day cap', () => {
    const snapshot = resolveNestEntitlements({
      billing: baseBilling,
      locales: [{ id: 'loc-1', created_at: '2026-01-01T00:00:00Z' }],
      listings: [
        { id: 'l-1', locale_id: 'loc-1', created_at: '2026-01-02T00:00:00Z', archived_at: null },
        { id: 'l-2', locale_id: 'loc-1', created_at: '2026-01-03T00:00:00Z', archived_at: null },
        { id: 'l-3', locale_id: 'loc-1', created_at: '2026-01-04T00:00:00Z', archived_at: null },
        { id: 'l-4', locale_id: 'loc-1', created_at: '2026-01-05T00:00:00Z', archived_at: null },
        { id: 'l-5', locale_id: 'loc-1', created_at: '2026-01-06T00:00:00Z', archived_at: null },
      ],
      tourDays: [
        { id: 'd-1', locale_id: 'loc-1', created_at: '2026-01-05T00:00:00Z', stop_count: 2 },
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

  it('detects locale, listing, and route search column caps', () => {
    const snapshot = resolveNestEntitlements({
      billing: baseBilling,
      locales: [{ id: 'loc-1', created_at: '2026-01-01T00:00:00Z' }],
      listings: Array.from({ length: 12 }, (_, i) => ({
        id: `l-${i + 1}`,
        locale_id: 'loc-1',
        created_at: `2026-01-${String(i + 2).padStart(2, '0')}T00:00:00Z`,
        archived_at: null,
      })),
      tourDays: [],
      routeSearchCriteria: [],
    });

    expect(isLocaleCapReached(snapshot)).toBe(true);
    expect(isListingCapReached(snapshot)).toBe(true);
    expect(isRouteSearchColumnCapReached(snapshot)).toBe(false);

    const withColumn = buildRouteSearchPlanContext({
      ...snapshot,
      routeSearchColumnCount: 1,
    });
    expect(withColumn.canAddColumn).toBe(false);
    expect(withColumn.ambientMessage).toContain('one route search column');

    const atCap = buildRouteSearchPlanContext({
      ...snapshot,
      routeSearchColumnCount: 1,
    });
    expect(atCap.canAddColumn).toBe(false);
    expect(atCap.ambientMessage).toContain('allows one route search column');
  });

  it('builds route search refresh budget context', () => {
    const free = buildRouteSearchPlanContext(
      resolveNestEntitlements({
        billing: baseBilling,
        locales: [{ id: 'loc-1', created_at: '2026-01-01T00:00:00Z' }],
        listings: [],
        tourDays: [],
        routeSearchCriteria: [{ locale_id: 'loc-1' }],
      }),
    );
    expect(free.canRefresh).toBe(false);
    expect(free.refreshAmbientMessage).toContain('Hunt Pass');

    const pro = buildRouteSearchPlanContext(
      resolveNestEntitlements({
        billing: {
          ...baseBilling,
          pass_expires_at: '2026-12-01T00:00:00Z',
          proximity_refresh_granted: 60,
          proximity_refresh_used: 41,
        },
        locales: [{ id: 'loc-1', created_at: '2026-01-01T00:00:00Z' }],
        listings: [],
        tourDays: [],
      }),
    );
    expect(pro.canRefresh).toBe(true);
    expect(pro.refreshRemaining).toBe(19);
    expect(pro.refreshStatusMessage).toContain('19 of 60');

    const exhausted = buildRouteSearchPlanContext(
      resolveNestEntitlements({
        billing: {
          ...baseBilling,
          pass_expires_at: '2026-12-01T00:00:00Z',
          proximity_refresh_granted: 60,
          proximity_refresh_used: 60,
        },
        locales: [],
        listings: [],
        tourDays: [],
      }),
    );
    expect(exhausted.canRefresh).toBe(false);
    expect(exhausted.refreshStatusMessage).toContain('refresh limit reached');
  });

  it('blocks batch tour day creates when Free cap would be exceeded', () => {
    const snapshot = resolveNestEntitlements({
      billing: baseBilling,
      locales: [{ id: 'loc-1', created_at: '2026-01-01T00:00:00Z' }],
      listings: [],
      tourDays: [
        { id: 'd-1', locale_id: 'loc-1', created_at: '2026-01-02T00:00:00Z', stop_count: 1 },
        { id: 'd-2', locale_id: 'loc-1', created_at: '2026-01-03T00:00:00Z', stop_count: 2 },
        { id: 'd-3', locale_id: 'loc-1', created_at: '2026-01-04T00:00:00Z', stop_count: 1 },
      ],
    });

    expect(checkAddTourDaysWithStopsBatch(snapshot, 0).ok).toBe(true);
    expect(checkAddTourDaysWithStopsBatch(snapshot, 1).ok).toBe(false);
    expect(checkAddTourDaysWithStopsBatch(snapshot, 2).ok).toBe(false);
  });

  it('treats developer Hunt Pass preview billing as Pro', () => {
    const billing = devHuntPassPreviewBilling(new Date('2026-08-27T00:00:00Z'));
    expect(isNestPro(billing, new Date('2026-08-27T00:00:00Z'))).toBe(true);
    expect(resolveNestPlan(billing, new Date('2026-08-27T00:00:00Z'))).toBe('pro');

    const snapshot = resolveNestEntitlements({
      billing,
      locales: [
        { id: 'loc-1', created_at: '2026-01-01T00:00:00Z' },
        { id: 'loc-2', created_at: '2026-02-01T00:00:00Z' },
      ],
      listings: [],
      tourDays: [],
    });
    expect(snapshot.visibleLocaleIds.size).toBe(2);
    expect(snapshot.plan).toBe('pro');
    expect(snapshot.proximityRefreshRemaining).toBeGreaterThan(0);
  });
});
