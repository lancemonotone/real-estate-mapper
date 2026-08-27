import { describe, expect, it } from 'vitest';
import {
  agentPatchHasFields,
  parseAgentListingPatch,
} from '../src/lib/listings/agent-write';

describe('parseAgentListingPatch', () => {
  it('accepts present keys and trims strings', () => {
    const result = parseAgentListingPatch({
      name: '  Breyley  ',
      beds: 2,
      price_monthly: 1499,
      amenities: [' pool ', 'gym'],
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.patch).toEqual({
      name: 'Breyley',
      beds: 2,
      price_monthly: 1499,
      amenities: ['pool', 'gym'],
    });
  });

  it('treats explicit null as clear', () => {
    const result = parseAgentListingPatch({ notes: null, fees_monthly: null });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.patch).toEqual({ notes: null, fees_monthly: null });
  });

  it('rejects non-objects', () => {
    expect(parseAgentListingPatch(null).ok).toBe(false);
    expect(parseAgentListingPatch([]).ok).toBe(false);
  });

  it('rejects wrong types', () => {
    const result = parseAgentListingPatch({ beds: '2' });
    expect(result.ok).toBe(false);
  });

  it('parses photo_urls arrays', () => {
    const result = parseAgentListingPatch({
      photo_urls: [' https://a.jpg ', '', 'https://b.jpg', 'https://a.jpg'],
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.patch.photo_urls).toEqual([
      'https://a.jpg',
      'https://b.jpg',
    ]);
  });
});

describe('agentPatchHasFields', () => {
  it('is false for empty patch', () => {
    expect(agentPatchHasFields({})).toBe(false);
  });

  it('is true when any key present', () => {
    expect(agentPatchHasFields({ name: null })).toBe(true);
  });
});
