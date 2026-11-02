'use client'

import {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
  useCallback,
} from 'react'
import { User } from '@/types'
import { getAccessToken, clearTokens, saveTokens, saveUserRole } from '@/lib/tokenManager'
import { refreshAccessToken } from '@/lib/authenUtils'
import { getProfile } from '@/lib/api'
import { AuthRequiredError, authErrorEmitter } from '@/lib/authErrors'

interface AuthContextType {
  user: User | null
  isAuthenticated: boolean
  login: (accessToken: string, refreshToken: string) => Promise<User | null>
  logout: () => void
  loading: boolean
  refreshAuth: () => Promise<User | null>
  requireAuth: () => boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshTrigger, setRefreshTrigger] = useState(0)

  const refreshAuth = useCallback(async (): Promise<User | null> => {
    setLoading(true)
    try {
      const profile = await getProfile()
      setUser(profile.data)
      const role = profile.data.role.find((r) => r.name === 'admin') ? 'admin' : 'user'
      saveUserRole(role)
      return profile.data
    } catch (e) {
      console.error('Failed to refresh auth:', e)
      return null
    } finally {
      setLoading(false)
    }
  }, [])

  const login = async (accessToken: string, refreshToken: string): Promise<User | null> => {
    saveTokens(accessToken, refreshToken)
    return refreshAuth()
  }

  const logout = useCallback(() => {
    clearTokens()
    setUser(null)
  }, [])

  useEffect(() => {
    const loadUser = async () => {
      setLoading(true)
      try {
        let token = getAccessToken()
        if (!token) {
          // ถ้า access token ไม่มี ให้ลอง refresh
          token = await refreshAccessToken()
        }

        if (!token) {
          // ถ้า refresh ไม่ได้ logout → reload หน้าใหม่
          logout()
          return
        }

        const profile = await getProfile()
        setUser(profile.data)
      } catch (e) {
        console.error('Failed to load user:', e)
        logout()
      } finally {
        setLoading(false)
      }
    }

    loadUser()
  }, [refreshTrigger, logout])

  const isAuthenticated = !!user

  const requireAuth = useCallback(() => {
    if (!isAuthenticated) {
      const error = new AuthRequiredError('no_token')
      authErrorEmitter.emit(error)
      return false
    }
    return true
  }, [isAuthenticated])

  return (
    <AuthContext.Provider
      value={{ user, isAuthenticated, login, logout, loading, refreshAuth, requireAuth }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
