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
    success: false,
    code: 'ROUTE_NOT_FOUND',
    message,
    error: {
      code: 'ROUTE_NOT_FOUND',
      message,
    },
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
  const details = err instanceof AppError ? err.details : undefined;
  const errors = err instanceof AppError ? err.errors : undefined;

  // In production, mask unhandled 500 internal errors
  const message =
    process.env.NODE_ENV === 'production' && statusCode === 500
      ? 'An unexpected internal server error occurred.'
      : err.message || 'Internal Server Error';

  res.status(statusCode).json({
    success: false,
    code: errorCode,
    message,
    ...(errors ? { errors } : {}),
    error: {
      code: errorCode,
      message,
      ...(details ? { details } : {}),
      ...(errors ? { errors } : {}),
      ...(process.env.NODE_ENV === 'development' && !(err instanceof AppError)
        ? { stack: err.stack }
        : {}),
    },
  });
}
