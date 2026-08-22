import { describe, expect, it } from 'vitest';
import { pickWinnerByDuration } from '../src/lib/proximity/pick-winner';

describe('pickWinnerByDuration', () => {
  const candidates = [
    { placeId: 'a', name: 'A', lat: 1, lng: 1 },
    { placeId: 'b', name: 'B', lat: 2, lng: 2 },
  ];

  it('picks minimum duration among ok legs', () => {
    const winner = pickWinnerByDuration(candidates, [
      { destinationIndex: 0, durationSec: 600, distanceM: 1000, ok: true },
      { destinationIndex: 1, durationSec: 300, distanceM: 800, ok: true },
    ]);
    expect(winner?.poi.placeId).toBe('b');
    expect(winner?.durationSec).toBe(300);
  });

  it('returns null when no ok legs', () => {
    expect(
      pickWinnerByDuration(candidates, [
        { destinationIndex: 0, durationSec: 0, distanceM: 0, ok: false },
      ]),
    ).toBeNull();
  });
});
