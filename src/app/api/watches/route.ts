import { NextRequest } from "next/server";

import { AppError } from "@/lib/api/errors";
import { checkRateLimit } from "@/lib/api/rate-limit";
import { errorJson, okJson } from "@/lib/api/responses";
import { resolveUserEmail } from "@/lib/auth/user-context";
import { createWatch, listWatches, watchInputSchema } from "@/lib/services/watch-service";

export async function GET(request: NextRequest) {
  try {
    const rateLimit = checkRateLimit({
      request,
      namespace: "watches:read",
      max: 120,
      windowMs: 60_000,
    });

    if (!rateLimit.allowed) {
      throw new AppError({
        message: "Rate limit exceeded",
        status: 429,
        code: "RATE_LIMITED",
        details: { retryAfterSeconds: rateLimit.retryAfterSeconds },
      });
    }

    const email = await resolveUserEmail(request);
    const watches = await listWatches(email);
    return okJson({ watches });
  } catch (error) {
    return errorJson(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const rateLimit = checkRateLimit({
      request,
      namespace: "watches:write",
      max: 30,
      windowMs: 60_000,
    });

    if (!rateLimit.allowed) {
      throw new AppError({
        message: "Rate limit exceeded",
        status: 429,
        code: "RATE_LIMITED",
        details: { retryAfterSeconds: rateLimit.retryAfterSeconds },
      });
    }

    const email = await resolveUserEmail(request);
    const payload = await request.json();
    const parsed = watchInputSchema.parse(payload);
    const watch = await createWatch(email, parsed);

    return okJson({ watch }, 201);
  } catch (error) {
    return errorJson(error);
  }
}
