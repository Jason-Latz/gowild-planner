import { describe, expect, it } from "vitest";

import { checkRateLimit } from "@/lib/api/rate-limit";

type FakeRequest = {
  headers: Headers;
};

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
});
