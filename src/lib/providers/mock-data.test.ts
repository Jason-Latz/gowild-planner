import { describe, expect, it } from "vitest";

import { getMockFrontierDepartures } from "@/lib/providers/mock-data";

describe("mock-data", () => {
  it("emits naive local wall-clock timestamps (no Z / offset)", () => {
    const legs = getMockFrontierDepartures("ORD", "2026-04-16");

    expect(legs.length).toBeGreaterThan(0);
    for (const leg of legs) {
      expect(leg.depTs).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/);
      expect(leg.arrTs).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/);
      expect(leg.depTs.endsWith("Z")).toBe(false);
    }
  });

  it("keeps evening departures on the requested service date (regression: UTC-roll drop)", () => {
    // Flight 1801 DEN->MCO departs 18:50 local. Previously toISOString() at a
    // fixed -06:00 offset rolled it to the next UTC calendar day, so a search for
    // the requested date silently dropped it.
    const legs = getMockFrontierDepartures("DEN", "2026-04-16");
    const evening = legs.find((leg) => leg.flightNo === "1801");

    expect(evening).toBeDefined();
    expect(evening?.depTs.slice(0, 10)).toBe("2026-04-16");
  });

  it("derives duration from local wall-clock minutes", () => {
    const legs = getMockFrontierDepartures("ORD", "2026-04-16");
    const ordDen = legs.find((leg) => leg.flightNo === "1201"); // 06:25 -> 08:25

    expect(ordDen?.durationMinutes).toBe(120);
  });
});
