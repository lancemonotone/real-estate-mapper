/**
 * Resolve listing ids targeted by an appointment-time request.
 * Prefer listing_ids when present; else single listing_id.
 */
export function resolveAppointmentListingIds(input: {
  listing_id?: string | null;
  listing_ids?: string[] | null;
}): string[] {
  if (Array.isArray(input.listing_ids) && input.listing_ids.length > 0) {
    const out: string[] = [];
    const seen = new Set<string>();
    for (const raw of input.listing_ids) {
      const id = String(raw ?? '').trim();
      if (!id || seen.has(id)) continue;
      seen.add(id);
      out.push(id);
    }
    return out;
  }
  const single = input.listing_id?.trim();
  return single ? [single] : [];
}
