import { NextRequest, NextResponse } from "next/server";

import { isValidCronRequest } from "@/lib/services/cron-auth";
import { runDigest } from "@/lib/services/digest-service";
import { runWatchAlerts } from "@/lib/services/watch-service";

export async function POST(request: NextRequest) {
  if (!isValidCronRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const [digestResult, watchResult] = await Promise.all([runDigest(), runWatchAlerts()]);
    return NextResponse.json({ digestResult, watchResult });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Digest run failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
