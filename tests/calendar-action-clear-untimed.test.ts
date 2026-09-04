import { describe, expect, it } from 'vitest';
import { partitionStopsForClearUntimed } from '../src/lib/tours/clear-untimed';

describe('partitionStopsForClearUntimed', () => {
  it('clears all when every stop is untimed', () => {
    const result = partitionStopsForClearUntimed([
      { listing_id: 'a', appointment_time: null },
      { listing_id: 'b', appointment_time: null },
    ]);
    expect(result.clearIds).toEqual(['a', 'b']);
    expect(result.keptTimedCount).toBe(0);
  });

  it('keeps timed stops and clears only untimed', () => {
    const result = partitionStopsForClearUntimed([
      { listing_id: 'a', appointment_time: null },
      { listing_id: 'b', appointment_time: '10:00:00' },
      { listing_id: 'c', appointment_time: null },
      { listing_id: 'd', appointment_time: '14:30' },
    ]);
    expect(result.clearIds).toEqual(['a', 'c']);
    expect(result.keptTimedCount).toBe(2);
  });

  it('clears nothing when every stop is timed', () => {
    const result = partitionStopsForClearUntimed([
      { listing_id: 'a', appointment_time: '09:00:00' },
      { listing_id: 'b', appointment_time: '11:15:00' },
    ]);
    expect(result.clearIds).toEqual([]);
    expect(result.keptTimedCount).toBe(2);
  });

  it('treats empty string time as untimed', () => {
    const result = partitionStopsForClearUntimed([
      { listing_id: 'a', appointment_time: '' },
      { listing_id: 'b', appointment_time: '   ' },
    ]);
    expect(result.clearIds).toEqual(['a', 'b']);
    expect(result.keptTimedCount).toBe(0);
  });

  it('returns empty partition for no stops', () => {
    const result = partitionStopsForClearUntimed([]);
    expect(result.clearIds).toEqual([]);
    expect(result.keptTimedCount).toBe(0);
  });
});
