import { describe, expect, it } from "vitest";

import { checkRateLimit, getActiveBucketCount, resetRateLimiter } from "@/lib/api/rate-limit";

type FakeRequest = {
  headers: Headers;
};

function reqFromIp(ip: string) {
  return { headers: new Headers({ "x-real-ip": ip }) } as never;
}

describe("rate limit", () => {
  it("blocks requests after max is reached", () => {
    const request = {
      headers: new Headers({
        "x-real-ip": "127.0.0.1",
      }),
    } satisfies FakeRequest;

    const first = checkRateLimit({
      request: request as never,
      namespace: "test",
      max: 2,
      windowMs: 60_000,
    });
    const second = checkRateLimit({
      request: request as never,
      namespace: "test",
      max: 2,
      windowMs: 60_000,
    });
    const third = checkRateLimit({
      request: request as never,
      namespace: "test",
      max: 2,
      windowMs: 60_000,
    });

    expect(first.allowed).toBe(true);
    expect(second.allowed).toBe(true);
    expect(third.allowed).toBe(false);
    expect(third.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("resets the per-key window after it elapses", () => {
    resetRateLimiter();
    const request = reqFromIp("203.0.113.7");
    const opts = { request, namespace: "window", max: 1, windowMs: 1_000 } as const;

    expect(checkRateLimit(opts, 0).allowed).toBe(true);
    expect(checkRateLimit(opts, 500).allowed).toBe(false); // still within the window
    expect(checkRateLimit(opts, 1_000).allowed).toBe(true); // window elapsed → fresh bucket
  });

  it("reclaims abandoned expired buckets only once per cleanup interval", () => {
    resetRateLimiter();
    const opts = (ip: string) => ({ request: reqFromIp(ip), namespace: "sweep", max: 5, windowMs: 1_000 });

    // t=0: client A registers a bucket that expires at t=1000.
    checkRateLimit(opts("10.0.0.1"), 0);
    expect(getActiveBucketCount()).toBe(1);

    // t=2000: A is expired but never revisited; a different client B arrives.
    // The cleanup sweep is throttled (< interval), so A is NOT reclaimed yet.
    checkRateLimit(opts("10.0.0.2"), 2_000);
    expect(getActiveBucketCount()).toBe(2);

    // t=70000: past the cleanup interval → the sweep runs and reclaims both
    // stale buckets before registering a fresh one for B.
    checkRateLimit(opts("10.0.0.2"), 70_000);
    expect(getActiveBucketCount()).toBe(1);
  });
});
