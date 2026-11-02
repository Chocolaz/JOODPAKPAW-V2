import { ApiError } from './errorHandling'
import request from './apiClient'
import { ChangePasswordCredentials } from '@/types/authen'

const BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL

// This is a simplified post function that does not handle authentication
// or token refresh, suitable for the refresh token call itself.
async function post<T>(
  endpoint: string,
  body: unknown,
  errorContext: string
): Promise<T> {
  try {
    const response = await fetch(`${BASE_URL}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })

    const data = await response.json()

    if (!response.ok) {
      throw new ApiError(
        data.message || 'Something went wrong',
        data.code,
        data.errors
      )
    }

    return data
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

export const refreshToken = async (token: string): Promise<string> => {
  const response = await post<{ accessToken: string }>(
    'api/v1/auth/refresh-token',
    { refreshToken: token },
    'Refresh Token'
  )
  return response.accessToken
}

export const resetPassword = async (
  userId: string,
  credentials: ChangePasswordCredentials
): Promise<void> => {
  await request<void>({
    endpoint: `api/v1/users/${userId}/change-password`,
    method: 'PATCH',
    body: credentials,
    errorContext: 'Change Password',
    requiresAuth: true,
  })
}
