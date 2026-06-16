import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { SearchResultCard } from "@/lib/types/domain";

const { sendMock } = vi.hoisted(() => ({ sendMock: vi.fn() }));

vi.mock("resend", () => ({
  Resend: class {
    emails = { send: sendMock };
  },
}));

const procEnv = process.env as Record<string, string | undefined>;
const savedKey = procEnv.RESEND_API_KEY;

beforeEach(() => {
  sendMock.mockReset();
  sendMock.mockResolvedValue({ data: { id: "msg-1" }, error: null });
});

afterEach(() => {
  if (savedKey === undefined) {
    delete procEnv.RESEND_API_KEY;
  } else {
    procEnv.RESEND_API_KEY = savedKey;
  }
  vi.resetModules();
});

async function loadMailer() {
  vi.resetModules();
  procEnv.RESEND_API_KEY = "re_test_key";
  return import("@/lib/mailer");
}

function card(destination: string): SearchResultCard {
  const itinerary = {
    legs: [
      {
        providerId: "t",
        carrier: "F9",
        flightNo: "1",
        origin: "ORD",
        destination,
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
    destination,
    bestOutbound: itinerary,
    returnCheck: { feasible: true, bestReturn: itinerary, bestReturnDate: "2026-06-21" },
    bookingUrl: "https://example.com/book",
    bookingFallbackUrl: "https://example.com",
    bookingDetailsText: "x",
  };
}

describe("mailer html escaping", () => {
  it("escapes untrusted destination values in watch alert html", async () => {
    const mailer = await loadMailer();

    await mailer.sendWatchAlertEmail({
      to: "a@b.com",
      watchName: "CHI",
      results: [card('"><script>alert(1)</script>')],
    });

    expect(sendMock).toHaveBeenCalledTimes(1);
    const html = sendMock.mock.calls[0][0].html as string;
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });
});
