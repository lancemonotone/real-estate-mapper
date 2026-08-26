#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { parseListingDump, validateListingPrefs } from '../../src/lib/listings/import/parse.ts';

function usage(): never {
  console.error(
    'Usage: node --experimental-strip-types scripts/listing-import/parse.ts <dump-file> --prefs \'{"target_beds":2,"pets":{"cats":1,"dogs":1}}\'',
  );
  process.exit(2);
}

function parseArgs(argv: string[]): { file: string; prefs: unknown } {
  if (argv.length < 2) usage();
  const file = argv[0];
  let prefsRaw: string | null = null;
  for (let i = 1; i < argv.length; i++) {
    if (argv[i] === '--prefs' && argv[i + 1]) {
      prefsRaw = argv[i + 1];
      break;
    }
  }
  if (!prefsRaw) usage();
  try {
    return { file, prefs: JSON.parse(prefsRaw) };
  } catch {
    console.error('Invalid --prefs JSON');
    process.exit(2);
  }
}

const { file, prefs } = parseArgs(process.argv.slice(2));

if (!validateListingPrefs(prefs)) {
  console.error('Invalid listing_prefs shape (need target_beds, pets.cats, pets.dogs)');
  process.exit(1);
}

let content: string;
try {
  content = readFileSync(file, 'utf8');
} catch (e) {
  const message = e instanceof Error ? e.message : 'read failed';
  console.error(message);
  process.exit(1);
}

const result = parseListingDump(content, prefs);

if (!result.ok) {
  console.error(result.error);
  process.exit(1);
}

for (const warning of result.warnings) {
  console.error(`warning: ${warning}`);
}

process.stdout.write(`${JSON.stringify(result)}\n`);
