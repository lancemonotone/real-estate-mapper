import { describe, expect, it } from 'vitest';
import { buildOptimizePlan } from '../src/lib/google/optimize-request';

describe('buildOptimizePlan', () => {
  it('sets origin to start, destination to farthest, intermediates the rest', () => {
    const plan = buildOptimizePlan([
      { id: 's', lat: 0, lng: 0, isStart: true },
      { id: 'near', lat: 0.01, lng: 0, isStart: false },
      { id: 'far', lat: 1, lng: 0, isStart: false },
    ]);
    expect(plan.originId).toBe('s');
    expect(plan.destinationId).toBe('far');
    expect(plan.intermediateIds).toEqual(['near']);
    expect(plan.body.travelMode).toBe('DRIVE');
    expect(plan.body.optimizeWaypointOrder).toBe(true);
  });

  it('throws without exactly one start', () => {
    expect(() =>
      buildOptimizePlan([
        { id: 'a', lat: 0, lng: 0, isStart: false },
        { id: 'b', lat: 1, lng: 0, isStart: false },
      ]),
    ).toThrow(/start/i);
  });
});
