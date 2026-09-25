function readEnv(name: string): string {
  const fromImportMeta = (import.meta.env as Record<string, string | undefined>)[
    name
  ];
  const fromProcess =
    typeof process !== 'undefined' ? process.env[name] : undefined;
  return (fromImportMeta || fromProcess || '').trim();
}

/** Empty string when unset (feature off). Does not throw. */
export function getDemoVisitorToken(): string {
  return readEnv('DEMO_VISITOR_TOKEN');
}

/** Null when unset. */
export function getDemoSessionSecret(): string | null {
  const value = readEnv('DEMO_SESSION_SECRET');
  return value || null;
}

/** Throws when DEMO_NEST_ID is missing (fail closed when establishing demo). */
export function requireDemoNestId(): string {
  const nestId = readEnv('DEMO_NEST_ID');
  if (!nestId) {
    throw new Error('Missing required environment variable: DEMO_NEST_ID');
  }
  return nestId;
}

export function getDemoNestId(): string | null {
  const nestId = readEnv('DEMO_NEST_ID');
  return nestId || null;
}
