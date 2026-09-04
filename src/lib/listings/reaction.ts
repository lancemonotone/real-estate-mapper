import type { SupabaseClient } from '@supabase/supabase-js';

export type ListingReaction = {
  favorite: boolean;
  passed: boolean;
};

/**
 * Heart and pass are mutually exclusive.
 * Turning one on clears the other; turning one off leaves the other unchanged.
 */
export function reactionUpdate(
  kind: 'favorite' | 'passed',
  next: boolean,
  current: ListingReaction,
): ListingReaction {
  if (kind === 'favorite') {
    return {
      favorite: next,
      passed: next ? false : current.passed,
    };
  }
  return {
    passed: next,
    favorite: next ? false : current.favorite,
  };
}

export async function applyListingReaction(
  supabase: SupabaseClient,
  listingId: string,
  kind: 'favorite' | 'passed',
  next: boolean,
): Promise<{ ok: true; reaction: ListingReaction } | { ok: false; error: string; status: number }> {
  const { data: row, error: readError } = await supabase
    .from('listings')
    .select('id, is_favorite, is_passed')
    .eq('id', listingId)
    .maybeSingle();

  if (readError) return { ok: false, error: readError.message, status: 400 };
  if (!row) return { ok: false, error: 'Not found', status: 404 };

  const reaction = reactionUpdate(kind, next, {
    favorite: Boolean(row.is_favorite),
    passed: Boolean(row.is_passed),
  });

  const { error } = await supabase
    .from('listings')
    .update({
      is_favorite: reaction.favorite,
      is_passed: reaction.passed,
      updated_at: new Date().toISOString(),
    })
    .eq('id', listingId);

  if (error) return { ok: false, error: error.message, status: 400 };
  return { ok: true, reaction };
}
