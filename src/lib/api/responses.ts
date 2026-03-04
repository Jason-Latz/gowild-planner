import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { AppError } from "@/lib/api/errors";

export function okJson<T>(data: T, status = 200) {
  return NextResponse.json(data, { status });
}

export function errorJson(error: unknown) {
  if (error instanceof AppError) {
    return NextResponse.json(
      {
        error: error.message,
        code: error.code,
        details: error.details,
      },
      { status: error.status },
    );
  }

  if (error instanceof ZodError) {
    return NextResponse.json(
      {
        error: "Invalid request",
        code: "VALIDATION_ERROR",
        details: error.flatten(),
      },
      { status: 400 },
    );
  }

  const message = error instanceof Error ? error.message : "Internal server error";

  return NextResponse.json(
    {
      error: message,
      code: "INTERNAL_ERROR",
    },
    { status: 500 },
  );
}
