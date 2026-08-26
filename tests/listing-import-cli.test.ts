import { describe, expect, it } from 'vitest';
import { defaultOutputPath } from '../src/lib/listings/import/output-path.ts';

describe('listing-import CLI', () => {
  it('derives json path from dump path', () => {
    expect(defaultOutputPath('_listings/listing.txt').replace(/\\/g, '/')).toBe(
      '_listings/listing.json',
    );
  });
});
