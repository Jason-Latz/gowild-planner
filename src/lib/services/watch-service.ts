import { DateMode, Prisma } from "@prisma/client";
import { z } from "zod";

import { DEFAULT_ORIGIN_GROUP } from "@/lib/constants";
import { sendWatchAlertEmail } from "@/lib/mailer";
import { prisma } from "@/lib/prisma";
import { searchFlights } from "@/lib/services/search-service";
import { getOrCreateUserByEmail } from "@/lib/services/user-service";
import { tomorrowDateOnly } from "@/lib/utils/date";
import { hashPayload } from "@/lib/utils/hash";

export const watchInputSchema = z
  .object({
    originGroup: z.string().trim().min(2).max(6).default(DEFAULT_ORIGIN_GROUP),
    dateMode: z.nativeEnum(DateMode).default(DateMode.TOMORROW),
    exactDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    maxStops: z.coerce.number().int().min(0).max(2).default(2),
    requireReturn: z.boolean().default(true),
    minNights: z.coerce.number().int().min(1).max(7).default(1),
    maxNights: z.coerce.number().int().min(1).max(10).default(3),
    emailEnabled: z.boolean().default(true),
    digestEnabled: z.boolean().default(true),
    filters: z.record(z.string(), z.unknown()).optional(),
  })
  .transform((input) => {
    return {
      ...input,
      originGroup: input.originGroup.toUpperCase(),
      minNights: Math.min(input.minNights, input.maxNights),
      maxNights: Math.max(input.minNights, input.maxNights),
    };
  });

function deriveDepartDate(dateMode: DateMode, exactDate?: Date | null) {
  if (dateMode === DateMode.EXACT_DATE && exactDate) {
    return exactDate.toISOString().slice(0, 10);
  }
  return tomorrowDateOnly();
}

export async function createWatch(email: string, input: z.input<typeof watchInputSchema>) {
  const user = await getOrCreateUserByEmail(email);
  const data = watchInputSchema.parse(input);

  const watch = await prisma.watchRule.create({
    data: {
      userId: user.id,
      originGroup: data.originGroup,
      dateMode: data.dateMode,
      exactDate: data.exactDate ? new Date(`${data.exactDate}T00:00:00.000Z`) : null,
      maxStops: data.maxStops,
      requireReturn: data.requireReturn,
      minNights: data.minNights,
      maxNights: data.maxNights,
      emailEnabled: data.emailEnabled,
      digestEnabled: data.digestEnabled,
      filters: data.filters ? (data.filters as Prisma.InputJsonValue) : undefined,
    },
  });

  return watch;
}

export async function listWatches(email: string) {
  const user = await getOrCreateUserByEmail(email);

  return prisma.watchRule.findMany({
    where: {
      userId: user.id,
    },
    orderBy: {
      createdAt: "desc",
    },
  });
}

export async function deleteWatch(email: string, watchId: string) {
  const user = await getOrCreateUserByEmail(email);

  const watch = await prisma.watchRule.findFirst({
    where: {
      id: watchId,
      userId: user.id,
    },
  });

  if (!watch) {
    throw new Error("Watch not found");
  }

  await prisma.watchRule.delete({
    where: {
      id: watch.id,
    },
  });
}

export async function runWatchAlerts() {
  const activeWatches = await prisma.watchRule.findMany({
    where: {
      emailEnabled: true,
    },
    include: {
      user: true,
    },
  });

  let sent = 0;

  for (const watch of activeWatches) {
    const departDate = deriveDepartDate(watch.dateMode, watch.exactDate);

    const search = await searchFlights({
      originGroup: watch.originGroup,
      departDate,
      maxStops: watch.maxStops,
      requireReturn: watch.requireReturn,
      minNights: watch.minNights,
      maxNights: watch.maxNights,
    });

    const topResults = search.results.slice(0, 10);
    if (topResults.length === 0) {
      continue;
    }

    const dedupeHash = hashPayload({
      watchId: watch.id,
      topResults: topResults.map((result) => ({
        destination: result.destination,
        outboundScore: result.bestOutbound.score,
        returnScore: result.returnCheck.bestReturn?.score ?? null,
      })),
    });

    const existing = await prisma.alertEvent.findUnique({
      where: {
        dedupeHash,
      },
    });

    if (existing) {
      continue;
    }

    const emailResponse = await sendWatchAlertEmail({
      to: watch.user.email,
      watchName: watch.originGroup,
      results: topResults,
    });

    await prisma.alertEvent.create({
      data: {
        userId: watch.userId,
        watchRuleId: watch.id,
        dedupeHash,
        destination: topResults[0]?.destination,
        payload: {
          results: topResults,
          messageId: emailResponse.id,
        },
      },
    });

    sent += 1;
  }

  return {
    watchesChecked: activeWatches.length,
    emailsSent: sent,
  };
}
