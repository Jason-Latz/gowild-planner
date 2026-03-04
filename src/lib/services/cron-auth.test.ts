import { describe, expect, it } from "vitest";

import { isValidCronRequest } from "@/lib/services/cron-auth";

type FakeRequest = {
  headers: Headers;
};

describe("cron auth", () => {
  it("accepts valid x-cron-secret", () => {
    const request = {
      headers: new Headers({
        "x-cron-secret": "dev-secret",
      }),
    } satisfies FakeRequest;

    expect(isValidCronRequest(request as never)).toBe(true);
  });

  it("rejects invalid secret", () => {
    const request = {
      headers: new Headers({
        "x-cron-secret": "wrong-secret",
      }),
    } satisfies FakeRequest;

    expect(isValidCronRequest(request as never)).toBe(false);
  });
});
