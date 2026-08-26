const DROP_EXACT = new Set(
  [
    'refrigerator',
    'window coverings',
    'linen closet',
    'cable satellite',
    'garbage disposal',
    'ceiling fan',
    'other community rooms',
    'other unit features',
    'dryer',
    'washer',
    'air conditioning',
    'dishwasher',
    'community rooms',
    'appliances',
    'cooling',
    'flooring',
    'furnished',
    'furnished apartments available',
    'lease terms',
    'policies',
    'services & facilities',
    'fitness & sports',
    'outdoor common areas',
    'unit features',
    'other',
    'building amenities',
    'facts, features & policies',
  ].map((s) => s.toLowerCase()),
);

const ASSUME_PRESENT = new Set(
  ['ac', 'air conditioning', 'dishwasher', 'refrigerator', 'basic parking'].map(
    (s) => s.toLowerCase(),
  ),
);

const RENAME: Record<string, string> = {
  'club house': 'Clubhouse',
  clubhouse: 'Clubhouse',
  'fitness center: 24-hour fitness center': '24-hour Fitness Center',
  'fitness center': 'Fitness Center',
  'game room: billiards': 'Game Room / Billiards',
  'lounge: tv lounge': 'TV Lounge',
  'swimming pool: swimming pools': 'Swimming Pools',
  'patio: screened-in patio': 'Screened-in Patio',
  'trail: fitness trail': 'Fitness Trail',
  'package service: 24-hour package lockers': 'Package Lockers',
  'package lockers': 'Package Lockers',
  'in unit: washer and dryer': 'In-Unit Washer/Dryer',
  'swimming pool': 'Swimming Pool',
  'patio balcony: balcony': 'Balcony / Patio',
  'electric vehicle charging station': 'EV Charging',
  'pet park': 'Bark Park',
  'basketball court': 'Basketball Court',
  'tennis court': 'Tennis Court',
  playground: 'Playground',
  sundeck: 'Sundeck',
  'garage: detached garages': 'Detached Garage',
  'other surface lot': 'Surface Lot Parking',
  'surface lot': 'Surface Lot Parking',
  'dogs allowed': 'Pets Allowed',
  'cats allowed': 'Pets Allowed',
};

function normalizeLabel(raw: string): string {
  const key = raw.trim().toLowerCase().replace(/\s+/g, ' ');
  if (RENAME[key]) return RENAME[key];
  const titled = raw
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
  return titled;
}

function shouldDrop(label: string): boolean {
  const key = label.trim().toLowerCase().replace(/\s+/g, ' ');
  if (!key || key.length < 3) return true;
  if (DROP_EXACT.has(key)) return true;
  if (ASSUME_PRESENT.has(key)) return true;
  if (key.includes('disclaimer')) return true;
  if (/^\d/.test(key)) return true;
  return false;
}

export function filterAmenities(rawItems: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();

  for (const raw of rawItems) {
    const wholeKey = raw.trim().toLowerCase().replace(/\s+/g, ' ');
    if (RENAME[wholeKey]) {
      const label = RENAME[wholeKey];
      if (!seen.has(label.toLowerCase())) {
        seen.add(label.toLowerCase());
        out.push(label);
      }
      continue;
    }

    const parts = raw.split(/(?<=[a-z])(?=[A-Z])|:\s*/);
    for (const part of parts) {
      const label = normalizeLabel(part);
      if (shouldDrop(label)) continue;
      const dedupeKey = label.toLowerCase();
      if (seen.has(dedupeKey)) continue;
      seen.add(dedupeKey);
      out.push(label);
    }
  }

  if (
    out.some((a) => a.toLowerCase().includes('bark park')) ||
    out.some((a) => a.toLowerCase().includes('pet'))
  ) {
    if (!seen.has('pets allowed')) {
      out.push('Pets Allowed');
    }
  }

  return out;
}

export function extractRawAmenityTokens(text: string): string[] {
  const start = text.indexOf('Building Amenities');
  if (start < 0) return [];
  const endMarkers = ['Pet essentials', 'Unit Features', 'Lease terms', 'Office hours'];
  let end = text.length;
  for (const marker of endMarkers) {
    const idx = text.indexOf(marker, start + 1);
    if (idx >= 0) end = Math.min(end, idx);
  }
  const block = text.slice(start, end);
  const withoutHeading = block.replace(/^Building Amenities\s*/i, '');
  return withoutHeading
    .split(/(?<=[a-z])(?=[A-Z])|(?<=[a-z])\s+(?=[A-Z][a-z]+ [A-Z])/)
    .map((s) => s.trim())
    .filter((s) => s.length > 2);
}
