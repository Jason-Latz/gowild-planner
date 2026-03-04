import { describe, expect, it } from "vitest";

import { searchRequestSchema } from "@/lib/services/search-service";

describe("search request schema", () => {
  it("normalizes defaults and bounds", () => {
    const parsed = searchRequestSchema.parse({
      originGroup: "chi",
      maxStops: "2",
      requireReturn: "false",
      minNights: "4",
      maxNights: "2",
    });

    expect(parsed.originGroup).toBe("CHI");
    expect(parsed.requireReturn).toBe(false);
    expect(parsed.minNights).toBe(2);
    expect(parsed.maxNights).toBe(4);
  });

  it("rejects invalid calendar dates", () => {
    expect(() =>
      searchRequestSchema.parse({
        originGroup: "CHI",
        departDate: "2026-02-30",
      }),
    ).toThrowError();
  });
});
