import { describe, expect, it } from 'vitest';
import {
  buildFixedOrderPlan,
  buildOptimizePlan,
} from '../src/lib/google/optimize-request';

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

  it('throws without exactly one start when no custom start', () => {
    expect(() =>
      buildOptimizePlan([
        { id: 'a', lat: 0, lng: 0, isStart: false },
        { id: 'b', lat: 1, lng: 0, isStart: false },
      ]),
    ).toThrow(/start/i);
  });

  it('uses custom start and end with all listings as intermediates', () => {
    const plan = buildOptimizePlan(
      [
        { id: 'a', lat: 0.1, lng: 0, isStart: false },
        { id: 'b', lat: 0.2, lng: 0, isStart: false },
      ],
      {
        customStart: { lat: 0, lng: 0 },
        customEnd: { lat: 1, lng: 0 },
      },
    );
    expect(plan.originId).toBeNull();
    expect(plan.destinationId).toBeNull();
    expect(plan.intermediateIds).toEqual(['a', 'b']);
    expect(plan.body.origin.location.latLng.latitude).toBe(0);
    expect(plan.body.destination.location.latLng.latitude).toBe(1);
  });

  it('uses custom start and farthest listing as destination', () => {
    const plan = buildOptimizePlan(
      [
        { id: 'near', lat: 0.01, lng: 0, isStart: false },
        { id: 'far', lat: 1, lng: 0, isStart: false },
      ],
      { customStart: { lat: 0, lng: 0 } },
    );
    expect(plan.originId).toBeNull();
    expect(plan.destinationId).toBe('far');
    expect(plan.intermediateIds).toEqual(['near']);
  });

  it('uses listing start and custom end', () => {
    const plan = buildOptimizePlan(
      [
        { id: 's', lat: 0, lng: 0, isStart: true },
        { id: 'a', lat: 0.5, lng: 0, isStart: false },
      ],
      { customEnd: { lat: 2, lng: 0 } },
    );
    expect(plan.originId).toBe('s');
    expect(plan.destinationId).toBeNull();
    expect(plan.intermediateIds).toEqual(['a']);
    expect(plan.body.destination.location.latLng.latitude).toBe(2);
  });
});

describe('buildFixedOrderPlan', () => {
  it('keeps visit order and disables waypoint optimize', () => {
    const plan = buildFixedOrderPlan([
      { id: 'first', lat: 0, lng: 0 },
      { id: 'mid', lat: 0.5, lng: 0 },
      { id: 'last', lat: 1, lng: 0 },
    ]);
    expect(plan.originId).toBe('first');
    expect(plan.destinationId).toBe('last');
    expect(plan.intermediateIds).toEqual(['mid']);
    expect(plan.body.optimizeWaypointOrder).toBe(false);
  });

  it('uses custom start/end with all listings as intermediates', () => {
    const plan = buildFixedOrderPlan(
      [
        { id: 'a', lat: 0.1, lng: 0 },
        { id: 'b', lat: 0.2, lng: 0 },
      ],
      {
        customStart: { lat: 0, lng: 0 },
        customEnd: { lat: 1, lng: 0 },
      },
    );
    expect(plan.originId).toBeNull();
    expect(plan.destinationId).toBeNull();
    expect(plan.intermediateIds).toEqual(['a', 'b']);
    expect(plan.body.optimizeWaypointOrder).toBe(false);
  });
});
