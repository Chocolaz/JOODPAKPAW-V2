import { NextFunction, Request, Response, Router } from 'express';

export const MAX_PG_INT4 = 2147483647;

/**
 * Validates that a route parameter is strictly a positive base-10 integer
 * fitting inside PostgreSQL signed 32-bit INT4 (`1..2147483647`).
 * Rejects partial numeric strings (e.g. "12abc"), "0", negatives, floats, and INT4 overflows.
 */
export function isValidPositiveIntParam(raw: unknown): boolean {
  if (typeof raw !== 'string') return false;
  if (!/^[1-9]\d*$/.test(raw)) return false;
  const num = Number(raw);
  return Number.isSafeInteger(num) && num >= 1 && num <= MAX_PG_INT4;
}

/**
 * Registers Express `router.param(...)` guards for numeric ID route parameters.
 * Immediately responds with standardized `400 T-2007` before controllers or Prisma execute.
 */
export function attachNumericParamGuards(
  router: Router,
  paramNames: string[],
  options?: { allowMe?: string[] }
): void {
  const allowMeSet = new Set(options?.allowMe ?? []);

  for (const paramName of paramNames) {
    router.param(
      paramName,
      (_req: Request, res: Response, next: NextFunction, val: string) => {
        if (allowMeSet.has(paramName) && String(val).toLowerCase() === 'me') {
          next();
          return;
        }

        if (!isValidPositiveIntParam(val)) {
          res.status(400).json({
            code: 'T-2007',
            message: `Invalid route parameter: ${paramName} must be a positive integer`,
            errors: [
              {
                field: paramName,
                tag: 'numeric',
                value: String(val),
              },
            ],
          });
          return;
        }

        next();
      }
    );
  }
}
