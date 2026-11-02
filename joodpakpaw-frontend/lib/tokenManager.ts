import Cookies from 'js-cookie'

// --- Token Management ---
// Note: When setting cookies, the path defaults to the current path.
// Setting path: '/' makes the cookie available across the entire site.

export const saveTokens = (accessToken: string, refreshToken: string) => {
  Cookies.remove('accessToken', { path: '/' })
  Cookies.remove('refreshToken', { path: '/' })

  Cookies.set('accessToken', accessToken, {
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
  })

  Cookies.set('refreshToken', refreshToken, {
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
  })
}

export const clearTokens = () => {
  Cookies.remove('accessToken', { path: '/' })
  Cookies.remove('refreshToken', { path: '/' })
  Cookies.remove('userRole', { path: '/' })
}

export const saveUserRole = (role: string) => {
  Cookies.set('userRole', role, { path: '/', sameSite: 'lax' })
}

export const getUserRole = (): string | null => {
  return Cookies.get('userRole') || null
}

export const getAccessToken = (): string | null => {
  return Cookies.get('accessToken') || null
}

export const getRefreshToken = (): string | null => {
  return Cookies.get('refreshToken') || null
}

export const isAuthenticated = (): boolean => {
  return getAccessToken() !== null
}
