import { htmlToText, parseMoney } from './text.ts';
import type { ZillowExtract, ZillowUnit } from './types.ts';

const UNIT_PATTERNS = [
  /(\d+-\d+)\s+(\d+)\s*bd,\s*([\d.]+)\s*ba(?:\s+Special offer)?(?:\s+\d+\s+photos)?\s+([\d,]+)\s+(?:Now|[A-Za-z]{3}\s+\d+)\s+(?:Message|Take tour)\s+\$([\d,]+)/g,
  /(\d+-\d+)\s+(\d+)\s*bd,\s*([\d.]+)\s*ba\s+([\d,]+)\s+(?:Now|[A-Za-z]{3}\s+\d+)\s+\$([\d,]+)/g,
];

export function isZillowDump(html: string, text: string): boolean {
  return (
    html.includes('zillowstatic.com') ||
    html.includes('data-test-id="bdp-building-title"') ||
    text.includes('Building Amenities') ||
    /Available units/i.test(text)
  );
}

export function extractZillow(html: string): ZillowExtract {
  const text = htmlToText(html);

  const titleMatch = html.match(
    /data-test-id="bdp-building-title"[^>]*>([^<]+)/i,
  );
  const name = titleMatch?.[1]?.replace(/\s+/g, ' ').trim() ?? null;

  const addressMatch = text.match(
    /\b(\d{3,6}\s+[A-Za-z0-9.'\s-]+(?:Way|Ave|St|Rd|Dr|Blvd|Ln|Ct|Pl|Cir|Circle|Pkwy|Street|Road|Drive)[^,]*,\s*[A-Za-z\s]+,\s*[A-Z]{2}\s*\d{5})/i,
  );
  const address = addressMatch?.[1]?.trim() ?? null;

  const phoneMatch = text.match(/\(\d{3}\)\s*\d{3}-\d{4}/);
  const phone = phoneMatch?.[0] ?? null;

  const photoCandidates = extractPhotoCandidates(html);

  const units: ZillowUnit[] = [];
  const seenUnits = new Set<string>();
  for (const pattern of UNIT_PATTERNS) {
    for (const match of text.matchAll(pattern)) {
      const unitId = match[1];
      if (seenUnits.has(unitId)) continue;
      seenUnits.add(unitId);
      units.push({
        unit: unitId,
        beds: Number(match[2]),
        baths: Number(match[3]),
        sqft: parseMoney(match[4]),
        rent: parseMoney(match[5]),
      });
    }
  }

  const truncatedMatch = text.match(/Show\s+(\d+)\s+more units/i);
  const truncatedUnitCount = truncatedMatch
    ? Number(truncatedMatch[1])
    : null;

  const rawAmenities = extractZillowAmenities(text);

  const monthlySection = extractSection(
    text,
    'Monthly rent, fees & charges',
    ['One-time fees & charges', 'Estimated monthly total', 'Similar apartments'],
  );
  const oneTimeSection = extractSection(
    text,
    'One-time fees & charges',
    ['Estimated total', 'Similar apartments', 'Displayed pricing'],
  );

  const requiredMonthlyFees = monthlySection
    ? parseRequiredMonthlyFees(monthlySection)
    : [];
  const deposit = oneTimeSection ? parseDeposit(oneTimeSection) : null;

  const petBlock = extractSection(text, 'Pet essentials', [
    'Available units',
    'Skip to the beginning',
    'Show pet policy',
  ]);
  const catOneTimeFee = parsePetFee(text, oneTimeSection, petBlock, 'cat', 'one');
  const dogOneTimeFee = parsePetFee(text, oneTimeSection, petBlock, 'dog', 'one');
  const catMonthlyRent = parsePetFee(text, oneTimeSection, petBlock, 'cat', 'monthly');
  const dogMonthlyRent = parsePetFee(text, oneTimeSection, petBlock, 'dog', 'monthly');

  return {
    name,
    address,
    phone,
    photoCandidates,
    units,
    rawAmenities,
    requiredMonthlyFees,
    deposit,
    catOneTimeFee,
    dogOneTimeFee,
    catMonthlyRent,
    dogMonthlyRent,
    truncatedUnitCount,
    hasMonthlyFeesSection: monthlySection !== null,
    hasOneTimeFeesSection: oneTimeSection !== null,
  };
}

function extractSection(
  text: string,
  startMarker: string,
  endMarkers: string[],
): string | null {
  const start = text.indexOf(startMarker);
  if (start < 0) return null;
  let end = text.length;
  for (const marker of endMarkers) {
    const idx = text.indexOf(marker, start + startMarker.length);
    if (idx >= 0) end = Math.min(end, idx);
  }
  return text.slice(start, end);
}

function parseRequiredMonthlyFees(section: string): number[] {
  const requiredPart = section.split(/\bOptional\b/i)[0] ?? section;
  const fees: number[] = [];

  const namedFees: Array<{ pattern: RegExp }> = [
    { pattern: /Package Lockers[^$]*\$\s*([\d,]+)(?:\s*-\s*\$\s*([\d,]+))?/i },
    { pattern: /Pest Control[^$]*\$\s*([\d,]+)(?:\s*-\s*\$\s*([\d,]+))?/i },
    {
      pattern: /Smart Home[^$]*\$\s*([\d,]+)(?:\s*-\s*\$\s*([\d,]+))?/i,
    },
    { pattern: /Trash[^$]*\$\s*([\d,]+)(?:\s*-\s*\$\s*([\d,]+))?/i },
    { pattern: /Water[^$]*\$\s*([\d,]+)(?:\s*-\s*\$\s*([\d,]+))?/i },
    { pattern: /Liability Insurance[^$]*\$\s*([\d,]+)(?:\s*-\s*\$\s*([\d,]+))?/i },
  ];

  for (const { pattern } of namedFees) {
    const match = requiredPart.match(pattern);
    if (!match) continue;
    const low = parseMoney(match[1]);
    const high = match[2] ? parseMoney(match[2]) : low;
    fees.push((low + high) / 2);
  }

  if (fees.length > 0) return fees;

  const skipPatterns = [
    /monthly base rent/i,
    /see unit for details/i,
    /estimated monthly total/i,
    /pet fee/i,
    /pet rent/i,
    /deposit/i,
    /application fee/i,
    /admin fee/i,
  ];

  const amountPattern =
    /([A-Za-z][^$]{0,80}?)\$\s*([\d,]+)(?:\s*-\s*\$\s*([\d,]+))?/g;

  for (const match of requiredPart.matchAll(amountPattern)) {
    const label = match[1];
    if (skipPatterns.some((p) => p.test(label))) continue;
    const low = parseMoney(match[2]);
    const high = match[3] ? parseMoney(match[3]) : low;
    fees.push((low + high) / 2);
  }

  return fees;
}

function parseDeposit(section: string): number | null {
  const match = section.match(/\bDeposit\b[^$]*\$\s*([\d,]+)/i);
  return match ? parseMoney(match[1]) : null;
}

function parsePetFee(
  text: string,
  oneTimeSection: string | null,
  petBlock: string | null,
  species: 'cat' | 'dog',
  kind: 'one' | 'monthly',
): number | null {
  const speciesLabel = species === 'cat' ? 'cat' : 'dog';
  const patterns =
    kind === 'one'
      ? [
          new RegExp(
            `Pet Fee \\(${speciesLabel.charAt(0).toUpperCase() + speciesLabel.slice(1)}\\)[^$]*\\$\\s*([\\d,]+)`,
            'i',
          ),
          new RegExp(`One-time ${speciesLabel} fee \\$([\\d,]+)`, 'i'),
        ]
      : [
          new RegExp(`Monthly ${speciesLabel} rent \\$([\\d,]+)`, 'i'),
        ];

  const haystacks = [oneTimeSection, petBlock, text].filter(Boolean) as string[];
  for (const haystack of haystacks) {
    for (const pattern of patterns) {
      const match = haystack.match(pattern);
      if (match) return parseMoney(match[1]);
    }
  }
  return null;
}

function extractZillowAmenities(text: string): string[] {
  const start = text.indexOf('Building Amenities');
  if (start < 0) return [];
  const endMarkers = [
    'Pet essentials',
    'Unit Features',
    'Lease terms',
    'Office hours',
    'Available units',
  ];
  let end = text.length;
  for (const marker of endMarkers) {
    const idx = text.indexOf(marker, start + 1);
    if (idx >= 0) end = Math.min(end, idx);
  }
  const block = text.slice(start, end);

  const items: string[] = [];
  const seen = new Set<string>();

  function add(item: string) {
    const trimmed = item.trim().replace(/\s+/g, ' ');
    const key = trimmed.toLowerCase();
    if (!trimmed || seen.has(key)) return;
    seen.add(key);
    items.push(trimmed);
  }

  const rules: Array<{ pattern: RegExp; pick: (m: RegExpMatchArray) => string }> = [
    { pattern: /\bClub House\b/i, pick: () => 'Club House' },
    {
      pattern: /Fitness Center:\s*([^:]+?)(?=\s+Game Room|$)/i,
      pick: (m) => `Fitness Center: ${m[1].trim()}`,
    },
    {
      pattern: /Game Room:\s*([^:]+?)(?=\s+Lounge:|$)/i,
      pick: (m) => `Game Room: ${m[1].trim()}`,
    },
    {
      pattern: /Lounge:\s*([^:]+?)(?=\s+Fitness|$)/i,
      pick: (m) => `Lounge: ${m[1].trim()}`,
    },
    { pattern: /\bBasketball Court\b/i, pick: () => 'Basketball Court' },
    { pattern: /\bTennis Court\b/i, pick: () => 'Tennis Court' },
    {
      pattern: /In Unit:\s*([^:]+?)(?=\s+Swimming Pool|$)/i,
      pick: (m) => `In Unit: ${m[1].trim()}`,
    },
    {
      pattern: /Swimming Pool:\s*([^:]+?)(?=\s+Outdoor|$)/i,
      pick: (m) => `Swimming Pool: ${m[1].trim()}`,
    },
    {
      pattern: /Patio:\s*([^:]+?)(?=\s+Playground|$)/i,
      pick: (m) => `Patio: ${m[1].trim()}`,
    },
    {
      pattern: /Trail:\s*([^:]+?)(?=\s+Services|$)/i,
      pick: (m) => `Trail: ${m[1].trim()}`,
    },
    { pattern: /\bPlayground\b/i, pick: () => 'Playground' },
    { pattern: /\bSundeck\b/i, pick: () => 'Sundeck' },
    {
      pattern: /\bElectric Vehicle Charging Station\b/i,
      pick: () => 'Electric Vehicle Charging Station',
    },
    {
      pattern: /Package Service:\s*([^:]+?)(?=\s+Pet Park|$)/i,
      pick: (m) => `Package Service: ${m[1].trim()}`,
    },
    { pattern: /\bPet Park\b/i, pick: () => 'Pet Park' },
    {
      pattern: /Garage:\s*([^:]+?)(?=\s+Other|$)/i,
      pick: (m) => `Garage: ${m[1].trim()}`,
    },
    { pattern: /\bSurface Lot\b/i, pick: () => 'Surface Lot' },
    { pattern: /\bOutdoor Kitchens?\b/i, pick: (m) => m[0] },
  ];

  for (const rule of rules) {
    const match = block.match(rule.pattern);
    if (match) add(rule.pick(match));
  }

  return items;
}

function extractPhotoCandidates(html: string): string[] {
  const urls = html.match(
    /https:\/\/photos\.zillowstatic\.com\/fp\/[a-f0-9]+[^"'\s<>]*/gi,
  );
  if (!urls) return [];

  const seen = new Set<string>();
  const ordered: string[] = [];
  for (const raw of urls) {
    const url = raw.replace(/&amp;/g, '&').split('?')[0].replace(/\);$/, '');
    const hashMatch = url.match(/\/fp\/([a-f0-9]+)/i);
    const hash = hashMatch?.[1];
    if (!hash || seen.has(hash)) continue;
    seen.add(hash);
    const preferred = url.includes('-o_a.')
      ? url
      : url.replace(/-[a-z0-9_]+\.(jpg|webp|png)$/i, '-o_a.jpg');
    ordered.push(preferred);
  }
  return ordered;
}
