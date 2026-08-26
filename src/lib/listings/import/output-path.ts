import { basename, dirname, extname, join } from 'node:path';

/** Default JSON path for a dump file (e.g. `_listings/listing.txt` → `_listings/listing.json`). */
export function defaultOutputPath(inputFile: string): string {
  const dir = dirname(inputFile);
  const base = basename(inputFile, extname(inputFile));
  return join(dir, `${base}.json`);
}
