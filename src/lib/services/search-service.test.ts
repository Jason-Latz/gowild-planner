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
});
