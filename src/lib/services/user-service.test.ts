import { describe, expect, it } from "vitest";

import { normalizeOriginCode, parseOriginCode } from "@/lib/services/user-service";

describe("origin parsing", () => {
  it("parses known metro group codes", () => {
    const parsed = parseOriginCode("chi");

    expect(parsed.kind).toBe("group");
    expect(parsed.code).toBe("CHI");
  });

  it("parses unknown 3-letter codes as airport codes", () => {
    const parsed = parseOriginCode("den");

    expect(parsed.kind).toBe("airport");
    expect(parsed.code).toBe("DEN");
  });

  it("rejects invalid origin codes", () => {
    const parsed = parseOriginCode("chicago");

    expect(parsed.kind).toBe("invalid");
  });

  it("normalizes whitespace and casing", () => {
    expect(normalizeOriginCode("  mDw ")).toBe("MDW");
  });
});
