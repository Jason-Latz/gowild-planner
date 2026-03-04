export class AppError extends Error {
  status: number;
  code: string;
  details?: unknown;

  constructor(args: { message: string; status?: number; code?: string; details?: unknown }) {
    super(args.message);
    this.name = "AppError";
    this.status = args.status ?? 500;
    this.code = args.code ?? "INTERNAL_ERROR";
    this.details = args.details;
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "Unauthorized") {
    super({ message, status: 401, code: "UNAUTHORIZED" });
  }
}

export class NotFoundError extends AppError {
  constructor(message = "Not found") {
    super({ message, status: 404, code: "NOT_FOUND" });
  }
}

export class ValidationError extends AppError {
  constructor(message = "Invalid request", details?: unknown) {
    super({ message, status: 400, code: "VALIDATION_ERROR", details });
  }
}
