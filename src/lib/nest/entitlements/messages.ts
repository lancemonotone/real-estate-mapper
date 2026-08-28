import { PLAN_LIMITS, type EntitlementPlan } from './constants';

/** Central user-facing copy for plan limits. Server and client import from here. */
export const PLAN_MESSAGES = {
  tourDayCap(plan: EntitlementPlan): string {
    return plan === 'free'
      ? 'Free plan allows up to 3 tour days. Upgrade Hunt Pass to add another day.'
      : 'Tour day limit reached for this Nest.';
  },

  tourDayCapAmbient(plan: EntitlementPlan): string {
    if (plan !== 'free') return '';
    return 'Free plan allows 3 tour days. Empty dates cannot accept new tours until you upgrade or remove stops from a day.';
  },

  tourDayCapEmptyDate(dateLabel: string, plan: EntitlementPlan): string {
    if (plan !== 'free') return '';
    return `Free plan allows 3 tour days. You cannot create a new tour on ${dateLabel} until you upgrade or remove stops from another day.`;
  },

  tourDayHiddenDrop: 'This tour day is hidden on the Free plan. Upgrade Hunt Pass to schedule here.',

  tourDayHiddenPanel(stopCount: number): string {
    const stops = stopCount === 1 ? '1 stop' : `${stopCount} stops`;
    return `This tour day is hidden on the Free plan. It has ${stops} saved. Upgrade Hunt Pass to view and edit the route.`;
  },

  tourOnHiddenDate: 'hidden on Free',

  listingCap(plan: EntitlementPlan): string {
    return plan === 'free'
      ? 'Free plan allows up to 12 listings. Upgrade Hunt Pass to add more.'
      : 'Listing limit reached for this Nest. Delete listings or contact support.';
  },

  localeCap(plan: EntitlementPlan): string {
    return plan === 'free'
      ? 'Free plan allows 1 Locale. Upgrade Hunt Pass for more.'
      : 'Locale limit reached for this Nest.';
  },

  localeHidden: 'This Locale is hidden on the Free plan. Renew Hunt Pass to access it.',

  proximityDemoCompute:
    'Free plan includes one proximity demo. Upgrade Hunt Pass for full proximity compare.',

  proximityDemoRefresh:
    'Free plan includes one proximity demo. Upgrade Hunt Pass for proximity refreshes.',

  proximityRefreshCap: 'Proximity refresh limit reached for this Hunt Pass. Contact support.',

  photoStoredCap(storedCap: number, plan: EntitlementPlan): string {
    return plan === 'free'
      ? `Free plan saves up to ${storedCap} photos per listing. Upgrade Hunt Pass for the full gallery.`
      : 'Photo limit reached for this listing.';
  },

  photoHiddenOnListing(hiddenCount: number): string {
    return `${hiddenCount} more photo${hiddenCount === 1 ? '' : 's'} saved on Free. Upgrade Hunt Pass to show the gallery.`;
  },

  photoPlanNoteDefault:
    'Free plan shows 1 photo per listing. You can save more; extra photos stay hidden until you upgrade.',

  photoPlanNoteWithHidden(hiddenCount: number): string {
    return `Free plan shows 1 photo on listings. ${hiddenCount} more saved here. Upgrade Hunt Pass for the full gallery.`;
  },

  hiddenContentSummary(parts: string): string {
    return `${parts} hidden on the Free plan. Renew Hunt Pass to see everything.`;
  },

  passExpiresToday: 'Your Hunt Pass ends today.',

  passExpiresIn(days: number): string {
    return `Your Hunt Pass ends in ${days} day${days === 1 ? '' : 's'}.`;
  },

  memberAskOwner(ownerDisplayName: string | null): string {
    return `Ask ${ownerDisplayName ?? 'the Nest owner'} to upgrade Hunt Pass.`;
  },

  upgradeLabel: 'Upgrade Hunt Pass',

  limits: PLAN_LIMITS,
} as const;
