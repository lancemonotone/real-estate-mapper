import { describe, expect, it } from 'vitest';
import {
  AUTO_PLAN_MAX_PER_CLUSTER,
  AUTO_PLAN_RADIUS_MILES,
  clusterListingsByProximity,
} from '../src/lib/tours/cluster-listings';
import { milesToMeters } from '../src/lib/geo/locale-radius';

/** Roughly 1° lat ≈ 69 mi; use small offsets for “near” / “far”. */
function pt(id: string, lat: number, lng: number) {
  return { id, lat, lng };
}

describe('clusterListingsByProximity', () => {
  it('exports defaults', () => {
    expect(AUTO_PLAN_RADIUS_MILES).toBe(3);
    expect(AUTO_PLAN_MAX_PER_CLUSTER).toBe(6);
  });

  it('returns empty for no points', () => {
    expect(clusterListingsByProximity([])).toEqual([]);
  });

  it('puts a single point in its own cluster', () => {
    expect(clusterListingsByProximity([pt('a', 28.0, -82.8)])).toEqual([['a']]);
  });

  it('groups points within the default radius', () => {
    // ~0.5 mi apart (≈0.007° lat)
    const clusters = clusterListingsByProximity([
      pt('a', 28.0, -82.8),
      pt('b', 28.007, -82.8),
      pt('c', 28.014, -82.8),
    ]);
    expect(clusters).toHaveLength(1);
    expect(clusters[0]!.sort()).toEqual(['a', 'b', 'c']);
  });

  it('keeps far points in separate clusters', () => {
    // ~10 mi apart
    const clusters = clusterListingsByProximity([
      pt('a', 28.0, -82.8),
      pt('b', 28.15, -82.8),
    ]);
    expect(clusters).toHaveLength(2);
    expect(clusters.map((c) => c[0]).sort()).toEqual(['a', 'b']);
  });

  it('splits when over maxPerCluster', () => {
    const points = Array.from({ length: 7 }, (_, i) =>
      pt(`p${i}`, 28.0 + i * 0.002, -82.8),
    );
    const clusters = clusterListingsByProximity(points, {
      radiusM: milesToMeters(5),
      maxPerCluster: 3,
    });
    expect(clusters.every((c) => c.length <= 3)).toBe(true);
    expect(clusters.flat().sort()).toEqual(points.map((p) => p.id).sort());
    expect(clusters.length).toBeGreaterThanOrEqual(3);
  });

  it('uses a stable seed order by id', () => {
    const clusters = clusterListingsByProximity([
      pt('c', 28.0, -82.8),
      pt('a', 28.001, -82.8),
      pt('b', 29.0, -82.8),
    ]);
    expect(clusters[0]![0]).toBe('a');
  });

  it('ignores points that cannot form a pair beyond radius even if max allows', () => {
    const clusters = clusterListingsByProximity(
      [pt('a', 28.0, -82.8), pt('b', 29.0, -82.8)],
      { radiusM: milesToMeters(1), maxPerCluster: 6 },
    );
    expect(clusters).toHaveLength(2);
  });
});
