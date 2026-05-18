export class AppError extends Error {
  readonly code: string;
  readonly statusCode: number;
  readonly cause?: unknown;

  constructor(code: string, message: string, statusCode = 500, cause?: unknown) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.statusCode = statusCode;
    if (cause !== undefined) this.cause = cause;
  }
}

export class AuthError extends AppError {
  constructor(message = "Authentication required", cause?: unknown) {
    super("UNAUTHORIZED", message, 401, cause);
    this.name = "AuthError";
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "Forbidden", cause?: unknown) {
    super("FORBIDDEN", message, 403, cause);
    this.name = "ForbiddenError";
  }
}

export class NotFoundError extends AppError {
  constructor(message = "Not found", cause?: unknown) {
    super("NOT_FOUND", message, 404, cause);
    this.name = "NotFoundError";
  }
}

export class ValidationError extends AppError {
  constructor(message = "Validation failed", cause?: unknown) {
    super("VALIDATION", message, 400, cause);
    this.name = "ValidationError";
  }
}

export class RateLimitError extends AppError {
  constructor(message = "Rate limit exceeded", cause?: unknown) {
    super("RATE_LIMIT", message, 429, cause);
    this.name = "RateLimitError";
  }
}
