import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

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
    const email = await resolveUserEmail(request);
    const settings = await getSettings(email);
    return NextResponse.json(settings);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not load settings";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const email = await resolveUserEmail(request);
    const payload = await request.json();
    const parsed = settingsSchema.parse(payload);
    const settings = await updateSettings(email, parsed);
    return NextResponse.json(settings);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not update settings";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
