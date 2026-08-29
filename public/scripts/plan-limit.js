/** Shared client helpers for Free plan limit feedback. */

export function isPlanLimitResponse(res, data) {
  return res.status === 403 && data?.code === 'plan_limit';
}

export function proxResultStatusClass({ error = false, planLimit = false } = {}) {
  const parts = ['prox-result__status'];
  if (error) parts.push('is-error');
  if (planLimit) parts.push('is-plan-limit');
  return parts.join(' ');
}

export function readRouteSearchPlanConfig(seed) {
  return seed?.routeSearchPlan ?? null;
}

export function criterionStatusClass({ planLimit = false } = {}) {
  return planLimit ? 'muted is-plan-limit' : 'muted';
}

export function formatRouteSearchRefreshRemaining(remaining, granted) {
  return `${remaining} of ${granted} route search refreshes left on this Hunt Pass.`;
}

export function patchRouteSearchRefreshBudget(seed, remaining) {
  const plan = readRouteSearchPlanConfig(seed);
  if (!plan || plan.plan !== 'pro') return plan;
  const granted = plan.refreshGranted;
  const canRefresh = remaining > 0;
  return {
    ...plan,
    refreshRemaining: remaining,
    canRefresh,
    refreshStatusMessage: canRefresh
      ? formatRouteSearchRefreshRemaining(remaining, granted)
      : plan.refreshCapBlockedMessage,
  };
}

export function syncRouteSearchRefreshUi(plan) {
  if (!plan) return;
  const statusEl = document.querySelector('[data-compare-refresh-status]');
  const refreshBtn = document.querySelector('[data-compare-refresh-stale]');
  if (statusEl instanceof HTMLElement) {
    statusEl.textContent = plan.refreshStatusMessage ?? '';
    statusEl.hidden = !plan.refreshStatusMessage;
    statusEl.classList.toggle('is-plan-limit', !plan.canRefresh && plan.plan === 'pro');
  }
  if (refreshBtn instanceof HTMLButtonElement) {
    refreshBtn.disabled = !plan.canRefresh;
  }
}
