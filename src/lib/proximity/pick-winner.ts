import type { PoiCandidate } from './place-types';

export type MatrixLeg = {
  destinationIndex: number;
  durationSec: number;
  distanceM: number;
  ok: boolean;
};

export function pickWinnerByDuration(
  candidates: PoiCandidate[],
  legs: MatrixLeg[],
): { poi: PoiCandidate; durationSec: number; distanceM: number } | null {
  let winner: {
    poi: PoiCandidate;
    durationSec: number;
    distanceM: number;
  } | null = null;

  for (const leg of legs) {
    if (!leg.ok) {
      continue;
    }

    const poi = candidates[leg.destinationIndex];
    if (!poi) {
      continue;
    }

    if (
      winner === null ||
      leg.durationSec < winner.durationSec
    ) {
      winner = {
        poi,
        durationSec: leg.durationSec,
        distanceM: leg.distanceM,
      };
    }
  }

  return winner;
}
