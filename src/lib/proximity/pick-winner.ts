import type { PoiCandidate } from './place-types';

export type MatrixLeg = {
  destinationIndex: number;
  durationSec: number;
  distanceM: number;
  ok: boolean;
};

export type RankedPoi = {
  poi: PoiCandidate;
  durationSec: number;
  distanceM: number;
};

export function rankByDuration(
  candidates: PoiCandidate[],
  legs: MatrixLeg[],
  limit: number,
): RankedPoi[] {
  const ranked: RankedPoi[] = [];

  for (const leg of legs) {
    if (!leg.ok) continue;
    const poi = candidates[leg.destinationIndex];
    if (!poi) continue;
    ranked.push({
      poi,
      durationSec: leg.durationSec,
      distanceM: leg.distanceM,
    });
  }

  ranked.sort((a, b) => {
    if (a.durationSec !== b.durationSec) return a.durationSec - b.durationSec;
    return a.poi.placeId.localeCompare(b.poi.placeId);
  });

  return ranked.slice(0, Math.max(0, limit));
}

export function pickWinnerByDuration(
  candidates: PoiCandidate[],
  legs: MatrixLeg[],
): RankedPoi | null {
  return rankByDuration(candidates, legs, 1)[0] ?? null;
}
