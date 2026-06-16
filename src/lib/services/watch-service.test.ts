import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    watchRule: { findMany: vi.fn() },
    alertEvent: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn(async () => ({})) },
  },
}));

vi.mock("@/lib/mailer", () => ({
  sendWatchAlertEmail: vi.fn(async () => ({ id: "msg-1" })),
  sendWeekendDigestEmail: vi.fn(async () => ({ id: "msg-1" })),
}));

vi.mock("@/lib/services/search-service", () => ({
  searchFlights: vi.fn(),
}));

import { sendWatchAlertEmail } from "@/lib/mailer";
import { prisma } from "@/lib/prisma";
import { searchFlights } from "@/lib/services/search-service";
import { runWatchAlerts, watchInputSchema } from "@/lib/services/watch-service";

const watch = {
  id: "watch-1",
  userId: "user-1",
  originGroup: "CHI",
  dateMode: "TOMORROW",
  exactDate: null,
  maxStops: 2,
  requireReturn: true,
  minNights: 1,
  maxNights: 3,
  emailEnabled: true,
  user: { email: "a@b.com" },
};

function searchResponseWithOneResult() {
  const itinerary = {
    legs: [
      {
        providerId: "t",
        carrier: "F9",
        flightNo: "1",
        origin: "ORD",
        destination: "LAS",
        depTs: "2026-06-19T08:00:00",
        arrTs: "2026-06-19T10:00:00",
        durationMinutes: 120,
      },
    ],
    stops: 0,
    layovers: [],
    totalMinutes: 120,
    score: 120,
  };

  return {
    meta: {},
    results: [
      {
        destination: "LAS",
        bestOutbound: itinerary,
        returnCheck: { feasible: true, bestReturn: itinerary, bestReturnDate: "2026-06-21" },
        bookingUrl: "https://x",
        bookingFallbackUrl: "https://x",
        bookingDetailsText: "x",
      },
    ],
  };
}

function p2002() {
  return new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
    code: "P2002",
    clientVersion: "6",
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  (prisma.watchRule.findMany as Mock).mockResolvedValue([watch]);
  (searchFlights as Mock).mockResolvedValue(searchResponseWithOneResult());
  (sendWatchAlertEmail as Mock).mockResolvedValue({ id: "msg-1" });
});

describe("runWatchAlerts claim-first dedupe", () => {
  it("skips without sending when the dedupe row already exists", async () => {
    (prisma.alertEvent.findUnique as Mock).mockResolvedValue({ id: "existing" });

    const result = await runWatchAlerts();

    expect(sendWatchAlertEmail).not.toHaveBeenCalled();
    expect(prisma.alertEvent.create).not.toHaveBeenCalled();
    expect(result.emailsSent).toBe(0);
  });

  it("claims before sending so a racing run cannot resend or fail", async () => {
    (prisma.alertEvent.findUnique as Mock).mockResolvedValue(null);
    const claimed = new Set<string>();
    (prisma.alertEvent.create as Mock).mockImplementation(async ({ data }) => {
      if (claimed.has(data.dedupeHash)) {
        throw p2002();
      }
      claimed.add(data.dedupeHash);
      return { id: "evt", ...data };
    });

    const first = await runWatchAlerts();
    const second = await runWatchAlerts();

    expect(sendWatchAlertEmail).toHaveBeenCalledTimes(1);
    expect(first.emailsSent).toBe(1);
    expect(second.emailsSent).toBe(0);
    expect(second.failedWatches).toBe(0);
  });
});

describe("watchInputSchema validation", () => {
  it("rejects an impossible calendar exactDate", () => {
    expect(() =>
      watchInputSchema.parse({ dateMode: "EXACT_DATE", exactDate: "2026-02-30" }),
    ).toThrowError();
  });

  it("rejects non-letter originGroup junk", () => {
    expect(() => watchInputSchema.parse({ originGroup: "A1" })).toThrowError();
    expect(() => watchInputSchema.parse({ originGroup: "<x>" })).toThrowError();
  });

  it("accepts valid origin codes and a real exactDate", () => {
    expect(watchInputSchema.parse({ originGroup: "chi" }).originGroup).toBe("CHI");
    expect(
      watchInputSchema.parse({ originGroup: "DEN", dateMode: "EXACT_DATE", exactDate: "2026-06-20" })
        .exactDate,
    ).toBe("2026-06-20");
  });
});
