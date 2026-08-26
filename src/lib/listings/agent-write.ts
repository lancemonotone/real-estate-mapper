import type { SupabaseClient } from '@supabase/supabase-js';
import { ensureLocaleCoversPoint } from '../geo/ensure-locale-covers';
import { geocodeAddress } from '../google/geocode';
import { invalidateListingProximityResults } from '../proximity/invalidate';
import type { Database, Listing } from '../types/database';

type Client = SupabaseClient<Database>;

const WRITABLE_KEYS = [
  'name',
  'address',
  'phone',
  'source_url',
  'photo_url',
  'notes',
  'appointment_at',
  'price_monthly',
  'deposit',
  'fees_monthly',
  'sqft',
  'beds',
  'baths',
  'pet_rent_monthly',
  'pet_deposit',
  'amenities',
] as const;

export type AgentWritableKey = (typeof WRITABLE_KEYS)[number];

export type AgentListingPatch = Partial<{
  name: string | null;
  address: string | null;
  phone: string | null;
  source_url: string | null;
  photo_url: string | null;
  notes: string | null;
  appointment_at: string | null;
  price_monthly: number | null;
  deposit: number | null;
  fees_monthly: number | null;
  sqft: number | null;
  beds: number | null;
  baths: number | null;
  pet_rent_monthly: number | null;
  pet_deposit: number | null;
  amenities: string[] | null;
}>;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseOptionalString(value: unknown): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed || null;
}

function parseOptionalNumberJson(value: unknown): number | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== 'number' || !Number.isFinite(value)) return undefined;
  return value;
}

function parseOptionalIntJson(value: unknown): number | null | undefined {
  const n = parseOptionalNumberJson(value);
  if (n === undefined) return undefined;
  if (n === null) return null;
  return Math.trunc(n);
}

function parseAmenitiesJson(value: unknown): string[] | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (!Array.isArray(value)) return undefined;
  const tags = value
    .filter((t): t is string => typeof t === 'string')
    .map((t) => t.trim())
    .filter(Boolean);
  return tags.length > 0 ? tags : null;
}

function parseAppointmentAt(value: unknown): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const d = new Date(trimmed);
  if (Number.isNaN(d.getTime())) return undefined;
  return d.toISOString();
}

/** Parse agent JSON body into a patch of present keys only. */
export function parseAgentListingPatch(
  body: unknown,
): { ok: true; patch: AgentListingPatch } | { ok: false; error: string } {
  if (!isPlainObject(body)) {
    return { ok: false, error: 'JSON object required' };
  }

  const patch: AgentListingPatch = {};

  if ('name' in body) {
    const v = parseOptionalString(body.name);
    if (v === undefined && body.name !== null) {
      return { ok: false, error: 'name must be string or null' };
    }
    patch.name = v ?? null;
  }
  if ('address' in body) {
    const v = parseOptionalString(body.address);
    if (v === undefined && body.address !== null) {
      return { ok: false, error: 'address must be string or null' };
    }
    patch.address = v ?? null;
  }
  if ('phone' in body) {
    const v = parseOptionalString(body.phone);
    if (v === undefined && body.phone !== null) {
      return { ok: false, error: 'phone must be string or null' };
    }
    patch.phone = v ?? null;
  }
  if ('source_url' in body) {
    const v = parseOptionalString(body.source_url);
    if (v === undefined && body.source_url !== null) {
      return { ok: false, error: 'source_url must be string or null' };
    }
    patch.source_url = v ?? null;
  }
  if ('photo_url' in body) {
    const v = parseOptionalString(body.photo_url);
    if (v === undefined && body.photo_url !== null) {
      return { ok: false, error: 'photo_url must be string or null' };
    }
    patch.photo_url = v ?? null;
  }
  if ('notes' in body) {
    const v = parseOptionalString(body.notes);
    if (v === undefined && body.notes !== null) {
      return { ok: false, error: 'notes must be string or null' };
    }
    patch.notes = v ?? null;
  }
  if ('appointment_at' in body) {
    const v = parseAppointmentAt(body.appointment_at);
    if (v === undefined) {
      return { ok: false, error: 'appointment_at must be ISO datetime string or null' };
    }
    patch.appointment_at = v;
  }
  if ('price_monthly' in body) {
    const v = parseOptionalNumberJson(body.price_monthly);
    if (v === undefined) {
      return { ok: false, error: 'price_monthly must be number or null' };
    }
    patch.price_monthly = v;
  }
  if ('deposit' in body) {
    const v = parseOptionalNumberJson(body.deposit);
    if (v === undefined) {
      return { ok: false, error: 'deposit must be number or null' };
    }
    patch.deposit = v;
  }
  if ('fees_monthly' in body) {
    const v = parseOptionalNumberJson(body.fees_monthly);
    if (v === undefined) {
      return { ok: false, error: 'fees_monthly must be number or null' };
    }
    patch.fees_monthly = v;
  }
  if ('sqft' in body) {
    const v = parseOptionalIntJson(body.sqft);
    if (v === undefined) {
      return { ok: false, error: 'sqft must be number or null' };
    }
    patch.sqft = v;
  }
  if ('beds' in body) {
    const v = parseOptionalNumberJson(body.beds);
    if (v === undefined) {
      return { ok: false, error: 'beds must be number or null' };
    }
    patch.beds = v;
  }
  if ('baths' in body) {
    const v = parseOptionalNumberJson(body.baths);
    if (v === undefined) {
      return { ok: false, error: 'baths must be number or null' };
    }
    patch.baths = v;
  }
  if ('pet_rent_monthly' in body) {
    const v = parseOptionalNumberJson(body.pet_rent_monthly);
    if (v === undefined) {
      return { ok: false, error: 'pet_rent_monthly must be number or null' };
    }
    patch.pet_rent_monthly = v;
  }
  if ('pet_deposit' in body) {
    const v = parseOptionalNumberJson(body.pet_deposit);
    if (v === undefined) {
      return { ok: false, error: 'pet_deposit must be number or null' };
    }
    patch.pet_deposit = v;
  }
  if ('amenities' in body) {
    const v = parseAmenitiesJson(body.amenities);
    if (v === undefined) {
      return { ok: false, error: 'amenities must be string[] or null' };
    }
    patch.amenities = v;
  }

  return { ok: true, patch };
}

export function agentPatchHasFields(patch: AgentListingPatch): boolean {
  return Object.keys(patch).length > 0;
}

async function resolveCoords(input: {
  address: string | null | undefined;
  existingAddress: string | null;
  existingLat: number | null;
  existingLng: number | null;
  addressInPatch: boolean;
}): Promise<{ lat: number | null; lng: number | null }> {
  if (!input.addressInPatch) {
    return { lat: input.existingLat, lng: input.existingLng };
  }
  if (!input.address) {
    return { lat: null, lng: null };
  }
  if (input.address === input.existingAddress) {
    return { lat: input.existingLat, lng: input.existingLng };
  }
  try {
    const geo = await geocodeAddress(input.address);
    return { lat: geo?.lat ?? null, lng: geo?.lng ?? null };
  } catch {
    return { lat: null, lng: null };
  }
}

export async function upsertListingBySourceUrl(
  supabase: Client,
  input: {
    localeId: string;
    userId: string;
    sourceUrl: string;
    patch: AgentListingPatch;
  },
): Promise<{ listing: Listing; created: boolean }> {
  const sourceUrl = input.sourceUrl.trim();
  if (!sourceUrl) {
    throw new Error('source_url required');
  }

  const { data: existing, error: findError } = await supabase
    .from('listings')
    .select('*')
    .eq('locale_id', input.localeId)
    .eq('source_url', sourceUrl)
    .maybeSingle();

  if (findError) {
    throw new Error(findError.message);
  }

  const patch: AgentListingPatch = {
    ...input.patch,
    source_url: sourceUrl,
  };

  if (existing) {
    return {
      listing: await applyListingPatch(supabase, existing, patch),
      created: false,
    };
  }

  const addressInPatch = Object.prototype.hasOwnProperty.call(patch, 'address');
  const address = addressInPatch ? (patch.address ?? null) : null;
  let lat: number | null = null;
  let lng: number | null = null;
  if (address) {
    const coords = await resolveCoords({
      address,
      existingAddress: null,
      existingLat: null,
      existingLng: null,
      addressInPatch: true,
    });
    lat = coords.lat;
    lng = coords.lng;
  }

  const row = {
    locale_id: input.localeId,
    name: Object.prototype.hasOwnProperty.call(patch, 'name')
      ? (patch.name ?? null)
      : null,
    address,
    phone: Object.prototype.hasOwnProperty.call(patch, 'phone')
      ? (patch.phone ?? null)
      : null,
    source_url: sourceUrl,
    photo_url: Object.prototype.hasOwnProperty.call(patch, 'photo_url')
      ? (patch.photo_url ?? null)
      : null,
    notes: Object.prototype.hasOwnProperty.call(patch, 'notes')
      ? (patch.notes ?? null)
      : null,
    appointment_at: Object.prototype.hasOwnProperty.call(patch, 'appointment_at')
      ? (patch.appointment_at ?? null)
      : null,
    lat,
    lng,
    price_monthly: Object.prototype.hasOwnProperty.call(patch, 'price_monthly')
      ? (patch.price_monthly ?? null)
      : null,
    deposit: Object.prototype.hasOwnProperty.call(patch, 'deposit')
      ? (patch.deposit ?? null)
      : null,
    fees_monthly: Object.prototype.hasOwnProperty.call(patch, 'fees_monthly')
      ? (patch.fees_monthly ?? null)
      : null,
    sqft: Object.prototype.hasOwnProperty.call(patch, 'sqft')
      ? (patch.sqft ?? null)
      : null,
    beds: Object.prototype.hasOwnProperty.call(patch, 'beds')
      ? (patch.beds ?? null)
      : null,
    baths: Object.prototype.hasOwnProperty.call(patch, 'baths')
      ? (patch.baths ?? null)
      : null,
    pet_rent_monthly: Object.prototype.hasOwnProperty.call(patch, 'pet_rent_monthly')
      ? (patch.pet_rent_monthly ?? null)
      : null,
    pet_deposit: Object.prototype.hasOwnProperty.call(patch, 'pet_deposit')
      ? (patch.pet_deposit ?? null)
      : null,
    amenities: Object.prototype.hasOwnProperty.call(patch, 'amenities')
      ? (patch.amenities ?? null)
      : null,
    created_by: input.userId,
  };

  const { data: listing, error } = await supabase
    .from('listings')
    .insert(row)
    .select('*')
    .single();

  if (error || !listing) {
    throw new Error(error?.message ?? 'Failed to create listing');
  }

  if (lat != null && lng != null) {
    await ensureLocaleCoversPoint(supabase, input.localeId, { lat, lng });
  }

  return { listing, created: true };
}

export async function patchListingById(
  supabase: Client,
  input: { listingId: string; patch: AgentListingPatch },
): Promise<Listing> {
  if (!agentPatchHasFields(input.patch)) {
    throw new Error('At least one field required');
  }

  const { data: existing, error: findError } = await supabase
    .from('listings')
    .select('*')
    .eq('id', input.listingId)
    .maybeSingle();

  if (findError) {
    throw new Error(findError.message);
  }
  if (!existing) {
    throw new Error('Not found');
  }

  return applyListingPatch(supabase, existing, input.patch);
}

async function applyListingPatch(
  supabase: Client,
  existing: Listing,
  patch: AgentListingPatch,
): Promise<Listing> {
  const addressInPatch = Object.prototype.hasOwnProperty.call(patch, 'address');
  const nextAddress = addressInPatch ? (patch.address ?? null) : existing.address;

  const { lat, lng } = await resolveCoords({
    address: nextAddress,
    existingAddress: existing.address,
    existingLat: existing.lat,
    existingLng: existing.lng,
    addressInPatch,
  });

  const update: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
    lat,
    lng,
  };

  for (const key of WRITABLE_KEYS) {
    if (Object.prototype.hasOwnProperty.call(patch, key)) {
      update[key] = patch[key] ?? null;
    }
  }

  const coordsChanged = lat !== existing.lat || lng !== existing.lng;

  const { data: listing, error } = await supabase
    .from('listings')
    .update(update)
    .eq('id', existing.id)
    .select('*')
    .single();

  if (error || !listing) {
    throw new Error(error?.message ?? 'Failed to update listing');
  }

  if (coordsChanged) {
    await invalidateListingProximityResults(supabase, existing.id);
  }

  if (lat != null && lng != null) {
    await ensureLocaleCoversPoint(supabase, existing.locale_id, { lat, lng });
  }

  return listing;
}

export const AGENT_LIST_SELECT =
  'id, name, address, phone, source_url, beds, baths, price_monthly, fees_monthly, photo_url, updated_at';
