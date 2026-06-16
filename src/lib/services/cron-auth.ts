import { timingSafeEqual } from "node:crypto";

import type { NextRequest } from "next/server";

import { env } from "@/lib/env";

function safeEqual(input: string, expected: string) {
  const inputBuffer = Buffer.from(input);
  const expectedBuffer = Buffer.from(expected);

  if (inputBuffer.length !== expectedBuffer.length) {
    return false;
  }

  return timingSafeEqual(inputBuffer, expectedBuffer);
}

export function isValidCronRequest(request: NextRequest) {
  const provided = request.headers.get("x-cron-secret");
  const authorization = request.headers.get("authorization");
  const bearer = authorization?.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length)
    : null;

  // Authorize ONLY via the shared secret, compared timing-safely. Vercel injects
  // `Authorization: Bearer ${CRON_SECRET}` on scheduled cron invocations, so the
  // job still authenticates. The `x-vercel-cron` header is forgeable by any
  // external caller and must never grant access on its own (doing so was a
  // secret-free production auth bypass that could trigger digest/alert email
  // sends and cost amplification).
  if (provided && safeEqual(provided, env.CRON_SECRET)) {
    return true;
  }

  if (bearer && safeEqual(bearer, env.CRON_SECRET)) {
    return true;
  }

  return false;
}
