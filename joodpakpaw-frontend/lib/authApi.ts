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

export interface RefreshTokenResult {
  accessToken: string
  refreshToken?: string
}

export const refreshToken = async (token: string): Promise<RefreshTokenResult> => {
  const response = await post<any>(
    'api/v1/auth/refresh-token',
    { refreshToken: token },
    'Refresh Token'
  )
  const accessToken =
    response?.data?.accessToken || response?.accessToken || ''
  const newRefreshToken =
    response?.data?.refreshToken || response?.refreshToken || token
  return {
    accessToken,
    refreshToken: newRefreshToken,
  }
}

export const changePassword = async (
  credentials: ChangePasswordCredentials
): Promise<void> => {
  await request<void>({
    endpoint: 'api/v1/users/me/change-password',
    method: 'PATCH',
    body: credentials,
    errorContext: 'Change Password',
    requiresAuth: true,
  })
}

export const resetPassword = async (
  _userId: string,
  credentials: ChangePasswordCredentials
): Promise<void> => {
  await request<void>({
    endpoint: 'api/v1/users/me/change-password',
    method: 'PATCH',
    body: credentials,
    errorContext: 'Change Password',
    requiresAuth: true,
  })
}

export const signOut = async (refreshToken?: string): Promise<void> => {
  try {
    await request<void>({
      endpoint: 'api/v1/auth/sign-out',
      method: 'POST',
      body: refreshToken ? { refreshToken } : {},
      errorContext: 'Sign Out',
      requiresAuth: true,
    })
  } catch (error) {
    console.error('Sign out error:', error)
  }
}
