import { ApiError } from './errorHandling'
import { AuthRequiredError } from './authErrors'

export const MAX_PG_INT4 = 2147483647

export type NavigationErrorKind =
  | 'unauthorized'
  | 'forbidden'
  | 'not_found'
  | 'error'

export function getSingleParam(
  raw: string | string[] | undefined | null
): string | null {
  if (Array.isArray(raw)) {
    return typeof raw[0] === 'string' && raw[0].length > 0 ? raw[0] : null
  }
  return typeof raw === 'string' && raw.length > 0 ? raw : null
}

/**
 * Strictly parses a positive base-10 integer fitting PostgreSQL INT4 (`1..2147483647`).
 * Rejects partial numbers (e.g. "12abc"), "0", negative integers, floats, and overflows.
 */
export function parsePositiveIntParam(
  raw: string | string[] | undefined | null
): number | null {
  const val = getSingleParam(raw)
  if (!val || !/^[1-9]\d*$/.test(val)) return null
  const num = Number(val)
  if (!Number.isSafeInteger(num) || num < 1 || num > MAX_PG_INT4) return null
  return num
}

export function isPositiveIntParam(
  raw: string | string[] | undefined | null
): boolean {
  return parsePositiveIntParam(raw) !== null
}

export function classifyNavigationError(error: unknown): NavigationErrorKind {
  if (error instanceof AuthRequiredError) {
    return 'unauthorized'
  }

  if (error instanceof ApiError || (typeof error === 'object' && error !== null)) {
    const errObj = error as {
      status?: unknown
      statusCode?: unknown
      code?: unknown
      message?: unknown
    }
    const status =
      typeof errObj.status === 'number'
        ? errObj.status
        : typeof errObj.statusCode === 'number'
        ? errObj.statusCode
        : undefined
    const code = typeof errObj.code === 'string' ? errObj.code : ''
    const message = typeof errObj.message === 'string' ? errObj.message : ''

    if (status === 401 || code === 'A-3005') {
      return 'unauthorized'
    }
    if (status === 403 || code === 'A-3007' || code === 'A-3002') {
      return 'forbidden'
    }
    if (
      status === 404 ||
      code === 'DB-1002' ||
      (status === 400 && code === 'T-2007') ||
      message === 'Resource not found.'
    ) {
      return 'not_found'
    }
  }

  return 'error'
}
