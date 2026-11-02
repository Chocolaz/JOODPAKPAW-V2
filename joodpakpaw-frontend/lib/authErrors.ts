export type AuthErrorReason = 'no_token' | 'expired_token'

export class AuthRequiredError extends Error {
  reason: AuthErrorReason

  constructor(reason: AuthErrorReason) {
    const message =
      reason === 'no_token'
        ? 'Authentication required. Please login.'
        : 'Session expired. Please login again.'
    super(message)
    this.name = 'AuthRequiredError'
    this.reason = reason
  }
}

type AuthErrorListener = (error: AuthRequiredError) => void

class AuthErrorEmitter {
  private listeners: Set<AuthErrorListener> = new Set()

  subscribe(listener: AuthErrorListener) {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  emit(error: AuthRequiredError) {
    this.listeners.forEach((listener) => listener(error))
  }
}

export const authErrorEmitter = new AuthErrorEmitter()
