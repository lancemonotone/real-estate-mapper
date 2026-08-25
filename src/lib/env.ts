export function requireEnv(name: string): string {
  // Astro 6+: non-PUBLIC secrets are runtime `process.env` on Node adapters
  // (Vercel). `import.meta.env` still covers PUBLIC_* and local Vite loads.
  const fromImportMeta = (import.meta.env as Record<string, string | undefined>)[
    name
  ];
  const fromProcess =
    typeof process !== 'undefined' ? process.env[name] : undefined;
  const value = fromImportMeta || fromProcess;
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}
