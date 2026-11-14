import { User } from './user'

// --- Credentials Interfaces ---
export interface SignInCredentials {
  email: string
  password: string
}

export interface SignUpCredentials {
  email: string
  password: string
  confirmPassword?: string
  firstName: string
  lastName: string
  firstname?: string
  lastname?: string
  phone: string
}

export interface VerifyOtpCredentials {
  email: string
  otp: string
}

export interface ForgotPasswordCredentials {
  email: string
}

export interface ResetPasswordCredentials {
  email: string
  password: string
  confirmPassword?: string
  resetPasswordToken: string
}

export interface ChangePasswordCredentials {
  oldPassword: string
  newPassword: string
  confirmPassword?: string
}

// --- Response Interfaces ---

export interface SignInResponse {
  code: string | number
  message: string
  data: {
    accessToken: string
    refreshToken: string
    expiresIn: number
    tokenType: string
    user: User
  }
  // Optional backward compatibility getters or properties if needed by UI
  accessToken?: string
  refreshToken?: string
  expiresIn?: number
  tokenType?: string
  user?: User
}
