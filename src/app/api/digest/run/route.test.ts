import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";

vi.mock("@/lib/services/digest-service", () => ({
  runDigest: vi.fn(async () => ({ processedUsers: 1, sentEmails: 1, skippedUsers: 0, failedUsers: 0 })),
}));

vi.mock("@/lib/services/watch-service", () => ({
  runWatchAlerts: vi.fn(async () => ({ watchesChecked: 1, emailsSent: 1, failedWatches: 0 })),
}));

import { POST } from "@/app/api/digest/run/route";
import { runDigest } from "@/lib/services/digest-service";

function post(headers: Record<string, string> = {}) {
  return new NextRequest("http://localhost/api/digest/run", { method: "POST", headers });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("POST /api/digest/run", () => {
  it("rejects an unauthenticated request (no secret, forged vercel-cron)", async () => {
    const res = await POST(post({ "x-vercel-cron": "1" }));

    expect(res.status).toBe(401);
    expect(runDigest).not.toHaveBeenCalled();
  });

  it("runs the digest + watch alerts with a valid secret", async () => {
    const res = await POST(post({ "x-cron-secret": "dev-secret" }));

    expect(res.status).toBe(200);
    expect(runDigest).toHaveBeenCalledTimes(1);
    const body = (await res.json()) as { digestResult: unknown; watchResult: unknown };
    expect(body).toHaveProperty("digestResult");
    expect(body).toHaveProperty("watchResult");
  });
});
