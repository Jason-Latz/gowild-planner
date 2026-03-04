import { createBrowserClient } from "@supabase/ssr";

import { env, hasSupabaseConfig } from "@/lib/env";

export function createSupabaseBrowserClient() {
  if (!hasSupabaseConfig()) {
    return null;
  }

  return createBrowserClient(
    env.NEXT_PUBLIC_SUPABASE_URL || "",
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "",
  );
}
