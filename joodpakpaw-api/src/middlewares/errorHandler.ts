import { Request, Response, NextFunction } from 'express';

export interface FieldValidationError {
  field: string;
  tag: string;
  value: string;
}

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly details?: unknown;
  public readonly errors?: FieldValidationError[];

  constructor(
    message: string,
    statusCode = 500,
    code = 'INTERNAL_SERVER_ERROR',
    details?: unknown,
    errors?: FieldValidationError[]
  ) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.errors = errors;
    Object.setPrototypeOf(this, new.target.prototype);
    Error.captureStackTrace(this, this.constructor);
  }
}

export function notFoundHandler(req: Request, res: Response, _next?: NextFunction): void {
  const message = `Cannot ${req.method} ${req.originalUrl}`;
  res.status(404).json({
    code: 'ROUTE_NOT_FOUND',
    message,
  });
}

export function errorHandler(
  err: Error | AppError,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  const statusCode = err instanceof AppError ? err.statusCode : 500;
  const errorCode = err instanceof AppError ? err.code : 'INTERNAL_SERVER_ERROR';
  const errors = err instanceof AppError ? err.errors : undefined;

  // In production, mask unhandled 500 internal errors
  const message =
    process.env.NODE_ENV === 'production' && statusCode === 500
      ? 'An unexpected internal server error occurred.'
      : err.message || 'Internal Server Error';

  // Redact any password field values in validation errors
  const sanitizedErrors = errors?.map((e) => ({
    field: e.field,
    tag: e.tag,
    value: e.field.toLowerCase().includes('password') ? '[REDACTED]' : e.value,
  }));

  const responseBody: Record<string, unknown> = {
    code: errorCode,
    message,
  };

  if (sanitizedErrors && sanitizedErrors.length > 0) {
    responseBody.errors = sanitizedErrors;
  }

  // Attach data if details is a structured object (e.g. A-3006 { email })
  if (
    err instanceof AppError &&
    err.details &&
    typeof err.details === 'object' &&
    !Array.isArray(err.details)
  ) {
    responseBody.data = err.details;
  }

  res.status(statusCode).json(responseBody);
}
