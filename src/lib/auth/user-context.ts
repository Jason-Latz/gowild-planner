import type { NextRequest } from "next/server";

import { UnauthorizedError } from "@/lib/api/errors";
import { createSupabaseServerClient } from "@/lib/auth/supabase-server";
import { allowHeaderAuth } from "@/lib/env";

const EMAIL_HEADER = "x-user-email";
const DEMO_EMAIL = "demo@gowild.local";

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export async function resolveUserEmail(request?: NextRequest) {
  const headerEmail = request?.headers.get(EMAIL_HEADER)?.trim().toLowerCase();
  if (allowHeaderAuth() && headerEmail && isValidEmail(headerEmail)) {
    return headerEmail;
  }

  const supabase = await createSupabaseServerClient();
  if (supabase) {
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (!error && user?.email && isValidEmail(user.email)) {
      return user.email.toLowerCase();
    }
  }

  if (process.env.NODE_ENV !== "production") {
    return DEMO_EMAIL;
  }

  throw new UnauthorizedError("Could not resolve authenticated user email.");
}
