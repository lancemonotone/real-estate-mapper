/** Pull a short message from Google JSON error bodies; fall back to raw text. */
export function formatGoogleApiError(status: number, body: string, label: string): string {
  try {
    const parsed = JSON.parse(body) as {
      error?: { message?: string; status?: string };
    };
    const message = parsed.error?.message?.trim();
    if (message) {
      return `${label} HTTP ${status}: ${message}`;
    }
  } catch {
    /* not JSON */
  }
  const trimmed = body.trim();
  const snippet = trimmed.length > 280 ? `${trimmed.slice(0, 280)}…` : trimmed;
  return `${label} HTTP ${status}: ${snippet || 'unknown error'}`;
}
