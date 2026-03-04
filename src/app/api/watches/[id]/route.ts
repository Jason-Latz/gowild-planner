import { NextRequest } from "next/server";

import { AppError } from "@/lib/api/errors";
import { checkRateLimit } from "@/lib/api/rate-limit";
import { errorJson, okJson } from "@/lib/api/responses";
import { resolveUserEmail } from "@/lib/auth/user-context";
import { deleteWatch } from "@/lib/services/watch-service";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const rateLimit = checkRateLimit({
      request,
      namespace: "watches:delete",
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
    const { id } = await params;
    await deleteWatch(email, id);

    return okJson({ ok: true });
  } catch (error) {
    return errorJson(error);
  }
}
