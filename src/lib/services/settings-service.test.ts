import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $transaction: vi.fn(),
    user: { update: vi.fn() },
    digestPreference: { upsert: vi.fn() },
  },
}));

vi.mock("@/lib/services/user-service", () => ({
  getOrCreateUserByEmail: vi.fn(),
  parseOriginCode: vi.fn(),
}));

import { prisma } from "@/lib/prisma";
import { getOrCreateUserByEmail, parseOriginCode } from "@/lib/services/user-service";
import { updateSettings } from "@/lib/services/settings-service";

const mockedPrisma = prisma as unknown as {
  $transaction: Mock;
  user: { update: Mock };
  digestPreference: { upsert: Mock };
};

const pref = {
  userId: "u1",
  sendDay: 4,
  sendLocalTime: "09:00",
  minNights: 2,
  maxNights: 4,
  topN: 15,
  sendEmptyDigest: false,
};

describe("settings-service updateSettings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (getOrCreateUserByEmail as Mock).mockResolvedValue({
      id: "u1",
      email: "a@b.com",
      timezone: "UTC",
      defaultOriginGroup: "CHI",
    });
    (parseOriginCode as Mock).mockReturnValue({ kind: "airport", code: "DEN" });
    // Run the transaction callback against the same prisma mock as `tx`.
    mockedPrisma.$transaction.mockImplementation(async (cb: (tx: unknown) => unknown) => cb(mockedPrisma));
    mockedPrisma.user.update.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
      id: "u1",
      email: "a@b.com",
      timezone: data.timezone,
      defaultOriginGroup: data.defaultOriginGroup,
    }));
    mockedPrisma.digestPreference.upsert.mockResolvedValue(pref);
  });

  it("returns the values written by the transaction (no upsert-shaped re-read)", async () => {
    const result = await updateSettings("a@b.com", {
      timezone: "America/Chicago",
      defaultOriginGroup: "DEN",
      sendLocalTime: "09:00",
      minNights: 2,
      maxNights: 4,
    });

    expect(result).toEqual({
      email: "a@b.com",
      timezone: "America/Chicago",
      defaultOriginGroup: "DEN",
      digestPreference: pref,
    });

    // Regression guard for the read-path-write removal: each write/read happens once.
    expect(getOrCreateUserByEmail).toHaveBeenCalledTimes(1);
    expect(mockedPrisma.user.update).toHaveBeenCalledTimes(1);
    expect(mockedPrisma.digestPreference.upsert).toHaveBeenCalledTimes(1);
  });

  it("normalizes swapped night bounds before writing", async () => {
    await updateSettings("a@b.com", { minNights: 5, maxNights: 2 });
    const upsertArgs = mockedPrisma.digestPreference.upsert.mock.calls[0][0];
    expect(upsertArgs.update.minNights).toBe(2);
    expect(upsertArgs.update.maxNights).toBe(5);
  });

  it("rejects an invalid timezone before touching the database", async () => {
    await expect(updateSettings("a@b.com", { timezone: "Nope/Nowhere" })).rejects.toThrow();
    expect(mockedPrisma.$transaction).not.toHaveBeenCalled();
  });
});
