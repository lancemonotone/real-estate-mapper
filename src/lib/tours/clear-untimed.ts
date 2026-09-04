export type ClearUntimedStop = {
  listing_id: string;
  appointment_time: string | null;
};

export type ClearUntimedPartition = {
  clearIds: string[];
  keptTimedCount: number;
};

/** Untimed = null/blank appointment_time. Timed stops are kept. */
export function partitionStopsForClearUntimed(
  stops: ClearUntimedStop[],
): ClearUntimedPartition {
  const clearIds: string[] = [];
  let keptTimedCount = 0;
  for (const stop of stops) {
    const time = stop.appointment_time?.trim() ?? '';
    if (time) {
      keptTimedCount += 1;
    } else {
      clearIds.push(stop.listing_id);
    }
  }
  return { clearIds, keptTimedCount };
}
