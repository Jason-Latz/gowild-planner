import type { User } from "@prisma/client";

import { ValidationError } from "@/lib/api/errors";
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

const IATA_AIRPORT_CODE = /^[A-Z]{3}$/;

export function normalizeOriginCode(value: string) {
  return value.trim().toUpperCase();
}

export function parseOriginCode(value: string) {
  const code = normalizeOriginCode(value);

  if (ORIGIN_GROUP_FALLBACKS[code]) {
    return { kind: "group" as const, code };
  }

  if (IATA_AIRPORT_CODE.test(code)) {
    return { kind: "airport" as const, code };
  }

  return { kind: "invalid" as const, code };
}

export async function getOriginGroupAirports(originGroupCode: string): Promise<string[]> {
  const parsed = parseOriginCode(originGroupCode);

  if (parsed.kind === "invalid") {
    throw new ValidationError(
      "originGroup must be a known metro code (for example CHI) or a 3-letter airport code (for example DEN)",
    );
  }

  if (parsed.kind === "airport") {
    return [parsed.code];
  }

  let originGroup = await prisma.originGroup.findUnique({
    where: { code: parsed.code },
    include: {
      airports: {
        orderBy: {
          position: "asc",
        },
      },
    },
  });

  if (!originGroup) {
    const fallback = ORIGIN_GROUP_FALLBACKS[parsed.code] ?? ORIGIN_GROUP_FALLBACKS[DEFAULT_ORIGIN_GROUP];
    originGroup = await prisma.originGroup.create({
      data: {
        code: parsed.code,
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
