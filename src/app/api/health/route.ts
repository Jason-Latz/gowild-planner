import { NextResponse } from "next/server";

import { checkProvidersHealth } from "@/lib/providers/provider-manager";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const started = Date.now();
  let dbOk = false;

  try {
    await prisma.$queryRaw`SELECT 1`;
    dbOk = true;
  } catch {
    dbOk = false;
  }

  const providerHealth = await checkProvidersHealth();

  return NextResponse.json({
    ok: dbOk,
    db: {
      ok: dbOk,
    },
    providers: providerHealth,
    generatedAt: new Date().toISOString(),
    latencyMs: Date.now() - started,
  });
}
