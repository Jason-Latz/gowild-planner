import type { NextRequest } from "next/server";

import { AppError } from "@/lib/api/errors";
import { checkRateLimit } from "@/lib/api/rate-limit";
import { errorJson, okJson } from "@/lib/api/responses";

import { checkProvidersHealth } from "@/lib/providers/provider-manager";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  // Health is public and triggers a DB query + provider probes, so rate-limit it
  // like every other route to prevent unauthenticated amplification.
  const rateLimit = checkRateLimit({
    request,
    namespace: "health",
    max: 60,
    windowMs: 60_000,
  });

  if (!rateLimit.allowed) {
    return errorJson(
      new AppError({
        message: "Rate limit exceeded",
        status: 429,
        code: "RATE_LIMITED",
        details: { retryAfterSeconds: rateLimit.retryAfterSeconds },
      }),
    );
  }

  const started = Date.now();
  let dbOk = false;

  try {
    await prisma.$queryRaw`SELECT 1`;
    dbOk = true;
  } catch {
    dbOk = false;
  }

  const providerHealth = await checkProvidersHealth();

  return okJson({
    ok: dbOk,
    db: {
      ok: dbOk,
    },
    providers: providerHealth,
    generatedAt: new Date().toISOString(),
    latencyMs: Date.now() - started,
  });
}
