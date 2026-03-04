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
    ? authorization.replace("Bearer ", "")
    : null;
  const vercelCron = request.headers.get("x-vercel-cron");

  if (vercelCron === "1" && process.env.NODE_ENV === "production") {
    return true;
  }

  if (provided && safeEqual(provided, env.CRON_SECRET)) {
    return true;
  }

  if (bearer && safeEqual(bearer, env.CRON_SECRET)) {
    return true;
  }

  return false;
}
