import type { User } from "@prisma/client";

import { DEFAULT_ORIGIN_GROUP, ORIGIN_GROUP_FALLBACKS } from "@/lib/constants";
import { prisma } from "@/lib/prisma";

export async function getOrCreateUserByEmail(email: string): Promise<User> {
  return prisma.user.upsert({
    where: { email },
    update: {},
    create: {
      email,
      defaultOriginGroup: DEFAULT_ORIGIN_GROUP,
    },
  });
}

export async function getOriginGroupAirports(originGroupCode: string): Promise<string[]> {
  let originGroup = await prisma.originGroup.findUnique({
    where: { code: originGroupCode },
    include: {
      airports: {
        orderBy: {
          position: "asc",
        },
      },
    },
  });

  if (!originGroup) {
    const fallback = ORIGIN_GROUP_FALLBACKS[originGroupCode] ?? ORIGIN_GROUP_FALLBACKS[DEFAULT_ORIGIN_GROUP];
    originGroup = await prisma.originGroup.create({
      data: {
        code: originGroupCode,
        name: fallback.name,
        airports: {
          create: fallback.airports.map((airportCode, index) => ({
            airportCode,
            position: index,
          })),
        },
      },
      include: {
        airports: {
          orderBy: {
            position: "asc",
          },
        },
      },
    });
  }

  return originGroup.airports.map((airport) => airport.airportCode);
}
