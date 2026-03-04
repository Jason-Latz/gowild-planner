import { THURSDAY } from "@/lib/constants";
import { ValidationError } from "@/lib/api/errors";
import { prisma } from "@/lib/prisma";
import { getOrCreateUserByEmail } from "@/lib/services/user-service";

export type SettingsInput = {
  timezone?: string;
  defaultOriginGroup?: string;
  sendDay?: number;
  sendLocalTime?: string;
  minNights?: number;
  maxNights?: number;
  topN?: number;
  sendEmptyDigest?: boolean;
};

function isValidTimezone(timezone?: string) {
  if (!timezone) {
    return true;
  }

  try {
    Intl.DateTimeFormat("en-US", { timeZone: timezone });
    return true;
  } catch {
    return false;
  }
}

function normalizeNights(minNights?: number, maxNights?: number) {
  const min = minNights ?? 1;
  const max = maxNights ?? 3;

  return {
    minNights: Math.min(min, max),
    maxNights: Math.max(min, max),
  };
}

export async function getSettings(email: string) {
  const user = await getOrCreateUserByEmail(email);

  const digestPreference = await prisma.digestPreference.upsert({
    where: { userId: user.id },
    update: {},
    create: {
      userId: user.id,
      sendDay: THURSDAY,
      sendLocalTime: "08:00",
      minNights: 1,
      maxNights: 3,
      topN: 15,
      sendEmptyDigest: false,
    },
  });

  return {
    email: user.email,
    timezone: user.timezone,
    defaultOriginGroup: user.defaultOriginGroup,
    digestPreference,
  };
}

export async function updateSettings(email: string, input: SettingsInput) {
  if (!isValidTimezone(input.timezone)) {
    throw new ValidationError("Invalid timezone");
  }

  const user = await getOrCreateUserByEmail(email);
  const nights = normalizeNights(input.minNights, input.maxNights);

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: user.id },
      data: {
        timezone: input.timezone,
        defaultOriginGroup: input.defaultOriginGroup?.toUpperCase(),
      },
    });

    await tx.digestPreference.upsert({
      where: { userId: user.id },
      update: {
        sendDay: input.sendDay,
        sendLocalTime: input.sendLocalTime,
        minNights: nights.minNights,
        maxNights: nights.maxNights,
        topN: input.topN,
        sendEmptyDigest: input.sendEmptyDigest,
      },
      create: {
        userId: user.id,
        sendDay: input.sendDay ?? THURSDAY,
        sendLocalTime: input.sendLocalTime ?? "08:00",
        minNights: nights.minNights,
        maxNights: nights.maxNights,
        topN: input.topN ?? 15,
        sendEmptyDigest: input.sendEmptyDigest ?? false,
      },
    });
  });

  return getSettings(email);
}
