import { type EmailOtpType } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

import { createSupabaseServerClient } from "@/lib/auth/supabase-server";

// Magic-link landing endpoint. Supports two flows:
//  - token_hash + type (verifyOtp): the recommended server-side flow; works
//    regardless of which browser/device opens the email link.
//  - code (exchangeCodeForSession): the PKCE flow, which requires the link to be
//    opened in the same browser that requested it. Kept as a fallback.
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";
  // Only allow same-origin relative redirects to avoid open-redirect abuse.
  const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/";

  const supabase = await createSupabaseServerClient();
  if (supabase) {
    if (tokenHash && type) {
      const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
      if (!error) {
        return NextResponse.redirect(new URL(safeNext, origin));
      }
    } else if (code) {
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (!error) {
        return NextResponse.redirect(new URL(safeNext, origin));
      }
    }
  }

  return NextResponse.redirect(new URL("/login?error=auth", origin));
}
