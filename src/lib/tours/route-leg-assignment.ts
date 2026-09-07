import type { RouteLeg } from '../google/routes';

/**
 * Google Routes `legs[i]` is the drive from path point i → i+1.
 * Stop fields store the **incoming** leg into that listing (Drive chips render before the stop).
 * Custom start at path index 0: first listing at index 1 gets legs[0] (start → first).
 */
export function incomingLegForPathIndex(
  legs: RouteLeg[],
  fullPathIdx: number,
): RouteLeg | null {
  if (fullPathIdx <= 0) return null;
  return legs[fullPathIdx - 1] ?? null;
}

/**
 * When the path ends with a custom end (`null` id), return the final listing → end leg.
 */
export function customEndIncomingLeg(
  legs: RouteLeg[],
  fullPathIds: Array<string | null>,
): RouteLeg | null {
  if (fullPathIds.length < 2) return null;
  const endIdx = fullPathIds.length - 1;
  if (fullPathIds[endIdx] != null) return null;
  return legs[endIdx - 1] ?? null;
}
