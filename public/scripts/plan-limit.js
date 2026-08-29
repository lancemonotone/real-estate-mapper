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
