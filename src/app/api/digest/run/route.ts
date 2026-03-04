import { NextRequest } from "next/server";

import { UnauthorizedError } from "@/lib/api/errors";
import { errorJson, okJson } from "@/lib/api/responses";
import { isValidCronRequest } from "@/lib/services/cron-auth";
import { runDigest } from "@/lib/services/digest-service";
import { runWatchAlerts } from "@/lib/services/watch-service";

export async function POST(request: NextRequest) {
  try {
    if (!isValidCronRequest(request)) {
      throw new UnauthorizedError("Unauthorized cron request");
    }

    const [digestResult, watchResult] = await Promise.all([runDigest(), runWatchAlerts()]);
    return okJson({ digestResult, watchResult });
  } catch (error) {
    return errorJson(error);
  }
}
