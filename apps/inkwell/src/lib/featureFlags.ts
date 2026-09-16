// Feature flags: boolean toggles read from environment variables, for
// turning functionality on/off without deleting code or committing to
// shipping it everywhere at once. Same "unset = off, not an error" spirit
// as the optional integrations in config.ts (GOOGLE_OAUTH_CONFIGURED). See
// README's "Feature flags" section for the full write-up.
//
// This module is server-side only - `process.env.FEATURE_*` reads happen in
// Node (page/layout components, route handlers), never inside a "use
// client" component, where `process.env` entries that aren't prefixed
// NEXT_PUBLIC_ are undefined. A flag that a client component needs to check
// (e.g. ReviewEditor) must be read here on the server and passed down as a
// prop - the same pattern NotePage already uses for `googleConfigured`/
// `googleConnected` in src/app/notes/[id]/page.tsx.
//
// To add a flag:
//   1. export const FEATURE_MY_THING = flag("FEATURE_MY_THING", false);
//   2. Document it in .env.local.example.
//   3. Check it where it matters - directly if that's server code, or pass
//      it down as a prop if the check happens in a client component.
//
// Flags are read once, at server start - like the rest of config.ts,
// changing .env.local requires restarting `npm run dev`.

/**
 * Parses a boolean env var. Unset or empty -> `defaultValue`. Otherwise
 * "1" or "true" (case-insensitive) is on; anything else is off.
 */
export function flag(envVar: string, defaultValue: boolean): boolean {
  const raw = process.env[envVar];
  if (raw === undefined || raw === "") return defaultValue;
  return raw === "1" || raw.toLowerCase() === "true";
}

// No flags are defined yet - add them above this line as features need
// gating, for example:
//
//   export const FEATURE_EXAMPLE = flag("FEATURE_EXAMPLE", false);
