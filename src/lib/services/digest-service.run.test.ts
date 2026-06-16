import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findMany: vi.fn() },
    digestEvent: { findFirst: vi.fn(), create: vi.fn(), update: vi.fn(async () => ({})) },
  },
}));

vi.mock("@/lib/mailer", () => ({
  sendWeekendDigestEmail: vi.fn(async () => ({ id: "msg-1" })),
  sendWatchAlertEmail: vi.fn(async () => ({ id: "msg-1" })),
}));

vi.mock("@/lib/services/search-service", () => ({
  searchFlights: vi.fn(),
}));

vi.mock("@/lib/utils/date", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/utils/date")>();
  return { ...actual, isWeeklySendWindow: () => true };
});

import { sendWeekendDigestEmail } from "@/lib/mailer";
import { prisma } from "@/lib/prisma";
import { runDigest } from "@/lib/services/digest-service";
import { searchFlights } from "@/lib/services/search-service";

const user = {
  id: "user-1",
  email: "a@b.com",
  timezone: "America/Chicago",
  defaultOriginGroup: "CHI",
  digestPreference: {
    sendDay: 4,
    sendLocalTime: "08:00",
    minNights: 1,
    maxNights: 3,
    topN: 5,
    sendEmptyDigest: false,
  },
};

function searchResponseWithOneTrip() {
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

const NOW = new Date("2026-06-18T13:05:00Z");

beforeEach(() => {
  vi.clearAllMocks();
  (prisma.user.findMany as Mock).mockResolvedValue([user]);
  (searchFlights as Mock).mockResolvedValue(searchResponseWithOneTrip());
  (sendWeekendDigestEmail as Mock).mockResolvedValue({ id: "msg-1" });
});

describe("runDigest claim-first dedupe", () => {
  it("skips without sending when the weekly event already exists", async () => {
    (prisma.digestEvent.findFirst as Mock).mockResolvedValue({ id: "existing" });

    const result = await runDigest(NOW);

    expect(sendWeekendDigestEmail).not.toHaveBeenCalled();
    expect(prisma.digestEvent.create).not.toHaveBeenCalled();
    expect(result.skippedUsers).toBe(1);
  });

  it("claims before sending so a racing run cannot resend or fail", async () => {
    // Both runs pass the cheap pre-check (findFirst null), simulating overlap.
    (prisma.digestEvent.findFirst as Mock).mockResolvedValue(null);
    const claimed = new Set<string>();
    (prisma.digestEvent.create as Mock).mockImplementation(async ({ data }) => {
      const key = `${data.userId}-${data.isoWeek}-${data.digestType}`;
      if (claimed.has(key)) {
        throw p2002();
      }
      claimed.add(key);
      return { id: "evt", ...data };
    });

    const first = await runDigest(NOW);
    const second = await runDigest(NOW);

    expect(sendWeekendDigestEmail).toHaveBeenCalledTimes(1);
    expect(first.sentEmails).toBe(1);
    expect(second.sentEmails).toBe(0);
    expect(second.skippedUsers).toBe(1);
    expect(second.failedUsers).toBe(0);
  });

  it("sends only after the claim row is committed", async () => {
    (prisma.digestEvent.findFirst as Mock).mockResolvedValue(null);
    const order: string[] = [];
    (prisma.digestEvent.create as Mock).mockImplementation(async () => {
      order.push("create");
      return { id: "evt" };
    });
    (sendWeekendDigestEmail as Mock).mockImplementation(async () => {
      order.push("send");
      return { id: "msg-1" };
    });

    await runDigest(NOW);

    expect(order).toEqual(["create", "send"]);
  });
});
