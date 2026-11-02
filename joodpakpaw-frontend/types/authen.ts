// --- Credentials Interfaces ---
export interface SignInCredentials {
  email: string
  password: string
}

export interface SignUpCredentials {
  email: string
  password: string
  confirmPassword: string
  firstname: string
  lastname: string
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

  confirmPassword: string

  resetPasswordToken: string
}

export interface ChangePasswordCredentials {
  oldPassword: string

  newPassword: string

  confirmPassword: string
}

// --- Response Interfaces ---

export interface SignInResponse {
  accessToken: string

  refreshToken: string

  code: number

  expiresIn: number

  message: string

  tokenType: string
}
