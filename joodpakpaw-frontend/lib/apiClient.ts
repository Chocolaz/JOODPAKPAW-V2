import { ApiError } from './errorHandling'
import { getAccessToken, refreshAccessToken, clearTokens } from './authenUtils'
import { AuthRequiredError, authErrorEmitter } from './authErrors'
const BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL

// JWT tokens are base64url-encoded and must be ASCII-only.
// If the cookie was manually edited with non-ASCII chars the Headers API throws.
function isSafeToken(token: string): boolean {
  return /^[\x20-\x7E]+$/.test(token)
}

interface RequestOptions extends Omit<RequestInit, 'body'> {
  endpoint: string
  errorContext?: string
  requiresAuth?: boolean
  sendAuthIfAvailable?: boolean
  silentAuth?: boolean
  body?: unknown
}

async function request<T>({
  endpoint,
  method = 'GET',
  body,
  headers: customHeaders,
  errorContext = 'API request',
  requiresAuth = false,
  sendAuthIfAvailable = false,
  silentAuth = false,
  ...rest
}: RequestOptions): Promise<T> {
  const headers = new Headers(customHeaders)

  if (requiresAuth) {
    let token = getAccessToken()
    if (!token || !isSafeToken(token)) {
      if (token) clearTokens() // corrupt token — wipe it
      token = await refreshAccessToken()
      if (!token) {
        clearTokens()
        const error = new AuthRequiredError('no_token')
        if (!silentAuth) authErrorEmitter.emit(error)
        throw error
      }
    }
    headers.set('Authorization', `Bearer ${token}`)
  } else if (sendAuthIfAvailable) {
    const token = getAccessToken()
    if (token && isSafeToken(token)) {
      headers.set('Authorization', `Bearer ${token}`)
    } else if (token) {
      clearTokens() // corrupt token — wipe it silently
    }
  }

  if (body && !(body instanceof FormData)) {
    headers.set('Content-Type', 'application/json')
  }

  const config: RequestInit = {
    method,
    headers,
    body: body instanceof FormData ? body : JSON.stringify(body),
    ...rest,
  }

  try {
    let response = await fetch(`${BASE_URL}${endpoint}`, config)

    if (response.status === 401 && requiresAuth) {
      const newAccessToken = await refreshAccessToken()
      if (newAccessToken && isSafeToken(newAccessToken)) {
        headers.set('Authorization', `Bearer ${newAccessToken}`)
        config.headers = headers
        response = await fetch(`${BASE_URL}${endpoint}`, config)
      } else {
        clearTokens()
        const error = new AuthRequiredError('expired_token')
        if (!silentAuth) authErrorEmitter.emit(error)
        throw error
      }
    }

    const text = await response.text()
    let data: unknown = null
    try {
      data = text ? JSON.parse(text) : null
    } catch {
      data = text
    }

    const payload =
      typeof data === 'object' && data !== null
        ? (data as {
            message?: string
            code?: string
            errors?: { field: string; tag: string; value: string }[]
          })
        : null

    if (!response.ok) {
      throw new ApiError(
        payload?.message ||
          (response.status === 403
            ? 'Access forbidden.'
            : response.status === 404
            ? 'Resource not found.'
            : 'Something went wrong'),
        payload?.code || '',
        payload?.errors,
        response.status
      )
    }

    return data as T
  } catch (error: unknown) {
    if (error instanceof ApiError) {
      console.error(`${errorContext} failed:`, error.message, error.code)
    } else if (error instanceof Error) {
      console.error(`${errorContext} failed:`, error.message)
    } else {
      console.error(`${errorContext} failed:`, error)
    }
    throw error
  }
}

export default request
