import type { NextRequest } from "next/server";

import { env } from "@/lib/env";

export function isValidCronRequest(request: NextRequest) {
  const provided = request.headers.get("x-cron-secret");
  const authorization = request.headers.get("authorization");
  const bearer = authorization?.startsWith("Bearer ")
    ? authorization.replace("Bearer ", "")
    : null;

  return Boolean(
    (provided && provided === env.CRON_SECRET) || (bearer && bearer === env.CRON_SECRET),
  );
}
