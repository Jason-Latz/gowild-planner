import { THURSDAY } from "@/lib/constants";
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
  const user = await getOrCreateUserByEmail(email);

  await prisma.user.update({
    where: { id: user.id },
    data: {
      timezone: input.timezone,
      defaultOriginGroup: input.defaultOriginGroup,
    },
  });

  await prisma.digestPreference.upsert({
    where: { userId: user.id },
    update: {
      sendDay: input.sendDay,
      sendLocalTime: input.sendLocalTime,
      minNights: input.minNights,
      maxNights: input.maxNights,
      topN: input.topN,
      sendEmptyDigest: input.sendEmptyDigest,
    },
    create: {
      userId: user.id,
      sendDay: input.sendDay ?? THURSDAY,
      sendLocalTime: input.sendLocalTime ?? "08:00",
      minNights: input.minNights ?? 1,
      maxNights: input.maxNights ?? 3,
      topN: input.topN ?? 15,
      sendEmptyDigest: input.sendEmptyDigest ?? false,
    },
  });

  return getSettings(email);
}
