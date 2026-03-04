import { describe, expect, it } from "vitest";

import { getUpcomingWeekendDepartures, isValidDateOnly, isWeeklySendWindow } from "@/lib/utils/date";

describe("date utils", () => {
  it("matches Thursday send window by local timezone", () => {
    const now = new Date("2026-03-05T14:15:00Z"); // 08:15 America/Chicago

    const withinWindow = isWeeklySendWindow({
      now,
      timezone: "America/Chicago",
      sendDay: 4,
      sendLocalTime: "08:00",
      allowedWindowMinutes: 30,
    });

    expect(withinWindow).toBe(true);
  });

  it("computes upcoming Friday and Saturday dates", () => {
    const now = new Date("2026-03-05T14:15:00Z");
    const departures = getUpcomingWeekendDepartures(now, "America/Chicago");

    expect(departures).toEqual(["2026-03-06", "2026-03-07"]);
  });

  it("validates strict yyyy-mm-dd dates", () => {
    expect(isValidDateOnly("2026-02-28")).toBe(true);
    expect(isValidDateOnly("2026-02-30")).toBe(false);
  });
});
