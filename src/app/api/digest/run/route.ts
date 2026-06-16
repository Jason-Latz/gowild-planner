import { NextRequest } from "next/server";

import { UnauthorizedError } from "@/lib/api/errors";
import { errorJson, okJson } from "@/lib/api/responses";
import { isValidCronRequest } from "@/lib/services/cron-auth";
import { runDigest } from "@/lib/services/digest-service";
import { runWatchAlerts } from "@/lib/services/watch-service";

// The digest + watch fan-out issues many provider searches per user, so give the
// function room to finish in one invocation. A run killed mid-loop could leave
// users unprocessed; the claim-first dedupe makes a re-run safe but bounded
// execution avoids partial work. (Vercel clamps to the plan's max.)
export const maxDuration = 300;

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
