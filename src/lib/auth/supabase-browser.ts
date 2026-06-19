import { createBrowserClient } from "@supabase/ssr";

// NEXT_PUBLIC_* values must be read via DIRECT `process.env.NEXT_PUBLIC_*` member
// access so Next.js inlines the literal strings into the client bundle at build
// time. Reading them through the zod-parsed `env` object in `@/lib/env` (which
// calls `safeParse(process.env)` on the whole object) works on the server but
// yields `undefined` in the browser, which made the client think Supabase was
// not configured.
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export function createSupabaseBrowserClient() {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return null;
  }

  return createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}
