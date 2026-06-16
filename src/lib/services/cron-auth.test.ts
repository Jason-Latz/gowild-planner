import { describe, expect, it } from "vitest";

import { isValidCronRequest } from "@/lib/services/cron-auth";

type FakeRequest = {
  headers: Headers;
};

function request(headers: Record<string, string>) {
  return { headers: new Headers(headers) } satisfies FakeRequest as never;
}

describe("cron auth", () => {
  it("accepts a valid x-cron-secret", () => {
    expect(isValidCronRequest(request({ "x-cron-secret": "dev-secret" }))).toBe(true);
  });

  it("accepts a valid Authorization: Bearer secret (Vercel cron path)", () => {
    expect(isValidCronRequest(request({ authorization: "Bearer dev-secret" }))).toBe(true);
  });

  it("rejects an invalid secret", () => {
    expect(isValidCronRequest(request({ "x-cron-secret": "wrong-secret" }))).toBe(false);
  });

  it("rejects an invalid Bearer token", () => {
    expect(isValidCronRequest(request({ authorization: "Bearer nope" }))).toBe(false);
  });

  // Regression: a forged x-vercel-cron header must NEVER authorize on its own.
  it("rejects x-vercel-cron:1 with no secret (closed forgeable bypass)", () => {
    expect(isValidCronRequest(request({ "x-vercel-cron": "1" }))).toBe(false);
  });

  it("rejects x-vercel-cron:1 paired with a wrong secret", () => {
    expect(
      isValidCronRequest(request({ "x-vercel-cron": "1", "x-cron-secret": "wrong" })),
    ).toBe(false);
  });

  it("rejects a request with no auth headers at all", () => {
    expect(isValidCronRequest(request({}))).toBe(false);
  });
});
