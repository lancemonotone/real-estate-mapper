#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { parseListingDump, validateListingPrefs } from '../../src/lib/listings/import/parse.ts';
import { defaultOutputPath } from '../../src/lib/listings/import/output-path.ts';

function usage(): never {
  console.error(`Usage: npm run listing:parse -- <dump-file> --prefs '<json>' [--out <path>]

Writes parsed listing JSON to a file (default: same dir/name as dump, .json extension).
Prints the output path on stdout. Warnings go to stderr.`);
  process.exit(2);
}

function parseArgs(argv: string[]): {
  file: string;
  prefs: unknown;
  out: string | null;
} {
  if (argv.length < 2) usage();
  const file = argv[0];
  let prefsRaw: string | null = null;
  let out: string | null = null;
  for (let i = 1; i < argv.length; i++) {
    if (argv[i] === '--prefs' && argv[i + 1]) {
      prefsRaw = argv[i + 1];
      i++;
    } else if (argv[i] === '--out' && argv[i + 1]) {
      out = argv[i + 1];
      i++;
    }
  }
  if (!prefsRaw) usage();
  try {
    return { file, prefs: JSON.parse(prefsRaw), out };
  } catch {
    console.error('Invalid --prefs JSON');
    process.exit(2);
  }
}

const isMain =
  process.argv[1] &&
  pathToFileURL(process.argv[1]).href === import.meta.url;

if (isMain) {
  const { file, prefs, out } = parseArgs(process.argv.slice(2));

  if (!validateListingPrefs(prefs)) {
    console.error(
      'Invalid listing_prefs shape (need target_beds, pets.cats, pets.dogs)',
    );
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

  const outputPath = out ?? defaultOutputPath(file);
  writeFileSync(outputPath, `${JSON.stringify(result, null, 2)}\n`, 'utf8');
  process.stdout.write(`${outputPath}\n`);
}
