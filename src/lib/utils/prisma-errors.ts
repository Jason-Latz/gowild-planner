import { Prisma } from "@prisma/client";

/**
 * True for a Prisma unique-constraint violation (P2002). Used so the digest and
 * watch loops can treat a claim-insert collision as "another run already owns
 * this slot" (skip, do not resend) rather than a generic failure.
 */
export function isUniqueConstraintError(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}
