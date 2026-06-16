import { NextRequest, NextResponse } from "next/server";

import { createSupabaseServerClient } from "@/lib/auth/supabase-server";

// Magic-link landing endpoint. signInWithOtp + emailRedirectTo uses the PKCE
// code flow: the browser stored the verifier cookie at sign-in time, so the
// server can exchange the `code` for a session here and set the auth cookies.
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";
  // Only allow same-origin relative redirects to avoid open-redirect abuse.
  const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/";

  if (code) {
    const supabase = await createSupabaseServerClient();
    if (supabase) {
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (!error) {
        return NextResponse.redirect(new URL(safeNext, origin));
      }
    }
  }

  return NextResponse.redirect(new URL("/login?error=auth", origin));
}
