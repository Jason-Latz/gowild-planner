import { NextRequest } from "next/server";
import { z } from "zod";

import { AppError } from "@/lib/api/errors";
import { checkRateLimit } from "@/lib/api/rate-limit";
import { errorJson, okJson } from "@/lib/api/responses";
import { resolveUserEmail } from "@/lib/auth/user-context";
import { getSettings, updateSettings } from "@/lib/services/settings-service";

const settingsSchema = z.object({
  timezone: z.string().min(2).max(64).optional(),
  defaultOriginGroup: z.string().min(2).max(6).optional(),
  sendDay: z.number().int().min(0).max(6).optional(),
  sendLocalTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  minNights: z.number().int().min(1).max(7).optional(),
  maxNights: z.number().int().min(1).max(10).optional(),
  topN: z.number().int().min(1).max(30).optional(),
  sendEmptyDigest: z.boolean().optional(),
});

export async function GET(request: NextRequest) {
  try {
    const rateLimit = checkRateLimit({
      request,
      namespace: "settings:read",
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
    const settings = await getSettings(email);
    return okJson(settings);
  } catch (error) {
    return errorJson(error);
  }
}

export async function PUT(request: NextRequest) {
  try {
    const rateLimit = checkRateLimit({
      request,
      namespace: "settings:write",
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
    const parsed = settingsSchema.parse(payload);
    const settings = await updateSettings(email, parsed);
    return okJson(settings);
  } catch (error) {
    return errorJson(error);
  }
}
