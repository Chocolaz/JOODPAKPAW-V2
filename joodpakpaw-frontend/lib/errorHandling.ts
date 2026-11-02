// lib/errorHandling.ts

export class ApiError extends Error {
  code: string
  errors?: { field: string; tag: string; value: string }[]

  constructor(
    message: string,
    code: string,
    errors?: { field: string; tag: string; value: string }[]
  ) {
    super(message)
    this.name = 'ApiError'
    this.code = code
    this.errors = errors
  }
}

const errorMessages: { [key: string]: string } = {
  'A-3001': 'Invalid email or password.',
  'A-3003': 'Email is already in used.',
  'DB-1002': 'This email is not registered.',
  'A-3010': 'Reset password token already used.',
  'A-3012': 'New password same as old password.',
  'A-3011': 'Wrong password.',
  'A-3004': 'Phone number already exists.',
  // Add other error codes and messages here
}

export function getApiErrorMessages(
  error: unknown
):
  | { field: 'email' | 'password' | 'general' | 'phone'; message: string }[]
  | null {
  if (error instanceof ApiError) {
    if (error.code === 'T-2007' && error.errors && error.errors.length > 0) {
      return error.errors.map((err) => {
        // Use the 'tag' for more reliable error mapping
        switch (err.tag) {
          case 'email':
            return { field: 'email', message: 'Invalid email format.' }
          case 'min': // Assuming 'min' tag for password length
            if (err.field.toLowerCase().includes('password')) {
              return {
                field: 'password',
                message: 'Password must be at least 8 characters.',
              }
            }
            break
          case 'phone':
            return { field: 'phone', message: 'Invalid phone number format.' }
          // Add more cases for other tags like 'required', etc.
        }
        // Fallback for unhandled tags or fields
        return {
          field: 'general',
          message: 'An unknown validation error occurred.',
        }
      })
    }
    if (error.code === 'A-3004') {
      return [{ field: 'phone', message: errorMessages[error.code] }]
    }
    if (error.code === 'A-3003') {
      return [{ field: 'email', message: errorMessages[error.code] }]
    }
    if (error.code in errorMessages) {
      return [{ field: 'general', message: errorMessages[error.code] }]
    }
  }
  return null
}

export function handleError(
  error: unknown,
  defaultMessage: string,
  setters: {
    setGeneralError: (message: string) => void
    setFieldError?: (field: string, message: string) => void
  }
) {
  const { setGeneralError, setFieldError } = setters

  if (error instanceof ApiError) {
    if (error.code === 'A-3011' && setFieldError) {
      setFieldError('oldPassword', errorMessages[error.code])
      return
    }

    const apiErrorMessages = getApiErrorMessages(error)
    if (apiErrorMessages && apiErrorMessages.length > 0) {
      setGeneralError(apiErrorMessages[0].message)
    } else {
      setGeneralError(error.message || defaultMessage)
    }
  } else if (error instanceof Error) {
    setGeneralError(error.message || defaultMessage)
  } else {
    setGeneralError(defaultMessage)
  }
}
