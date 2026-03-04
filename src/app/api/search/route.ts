import { NextRequest } from "next/server";

import { AppError } from "@/lib/api/errors";
import { checkRateLimit } from "@/lib/api/rate-limit";
import { errorJson, okJson } from "@/lib/api/responses";
import { searchFlights, searchRequestSchema } from "@/lib/services/search-service";

export async function GET(request: NextRequest) {
  try {
    const rateLimit = checkRateLimit({
      request,
      namespace: "search",
      max: 60,
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

    const params = Object.fromEntries(request.nextUrl.searchParams.entries());
    const parsed = searchRequestSchema.parse(params);
    const response = await searchFlights(parsed);

    return okJson(response);
  } catch (error) {
    return errorJson(error);
  }
}
