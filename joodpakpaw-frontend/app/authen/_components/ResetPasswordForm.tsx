'use client'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useState, Suspense } from 'react'
import { resetPassword } from '@/lib/api'
import { useSearchParams } from 'next/navigation'
import { ApiError, getApiErrorMessages } from '@/lib/errorHandling'
import { isPasswordValid } from '@/lib/utils'
import PasswordRequirements from './PasswordRequirements'
import clsx from 'clsx'
import Link from 'next/link'

function ResetPasswordFormComponent({
  onSubmitSuccess,
  onTokenExpired,
}: {
  onSubmitSuccess: () => void
  onTokenExpired: () => void
}) {
  // Hooks
  const searchParams = useSearchParams()

  // State
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const [confirmPasswordError, setConfirmPasswordError] = useState<
    string | null
  >(null)
  const [generalError, setGeneralError] = useState<string | null>(null)

  const initialPayload = searchParams.get('payload')
  const {
    email: initialEmail,
    token: initialToken,
    error: initialError,
  } = (() => {
    if (initialPayload) {
      try {
        const decodedPayload = atob(initialPayload)
        const { email, resetPasswordToken } = JSON.parse(decodedPayload)
        if (email && resetPasswordToken) {
          return { email, token: resetPasswordToken, error: null }
        } else {
          return { email: null, token: null, error: 'Invalid payload in URL.' }
        }
      } catch (e) {
        console.error('Failed to decode payload:', e)
        return {
          email: null,
          token: null,
          error: 'Invalid or corrupted payload in URL.',
        }
      }
    } else {
      return { email: null, token: null, error: 'No payload found in URL.' }
    }
  })()

  const [token] = useState<string | null>(initialToken)
  const [email] = useState<string | null>(initialEmail)
  const [formGeneralError, setFormGeneralError] = useState<string | null>(
    initialError
  )
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Handlers
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    // Clear previous errors
    setPasswordError(null)
    setConfirmPasswordError(null)
    setFormGeneralError(null)

    if (password !== confirmPassword) {
      setConfirmPasswordError('Passwords do not match.')
      return
    }

    if (email && token) {
      setIsSubmitting(true)
      try {
        await resetPassword({
          email,
          resetPasswordToken: token,
          password,
          confirmPassword,
        })
        onSubmitSuccess()
      } catch (err) {
        console.error('Reset password failed:', err)

        if (err instanceof ApiError && err.code === 'A-3010') {
          onTokenExpired()
          return
        }

        const errorResponse = getApiErrorMessages(err)
        const passwordFieldErrors = errorResponse?.filter(
          (e) => e.field === 'password'
        )
        const generalFieldErrors = errorResponse?.filter(
          (e) => e.field === 'general'
        )

        if (passwordFieldErrors && passwordFieldErrors.length > 0) {
          setPasswordError(passwordFieldErrors[0].message)
        } else if (generalFieldErrors && generalFieldErrors.length > 0) {
          setFormGeneralError(generalFieldErrors[0].message)
        } else {
          setFormGeneralError('Failed to reset password. Please try again.')
        }
      } finally {
        setIsSubmitting(false)
      }
    }
  }

  if (!token || !email) {
    return (
      <div className="px-5 w-full max-w-sm text-center mx-auto mt-[30px]">
        {formGeneralError && (
          <p className="text-red-500 text-center mb-4">{formGeneralError}</p>
        )}
        <Link
          href="/authen/login"
          className="text-accent-orange font-semibold hover:underline text-[20px]"
        >
          Back to Login
        </Link>
      </div>
    )
  }

  return (
    <div className="px-5 w-full max-w-sm text-center mx-auto mt-[30px] ">
      <form onSubmit={handleResetPassword} className="space-y-[30px] mt-[70px]">
        <div>
          <Input
            type="password"
            placeholder="New Password"
            className={clsx('w-full', {
              'border-red-500': passwordError || formGeneralError,
            })}
            value={password}
            onChange={(e) => {
              setPassword(e.target.value)
              setPasswordError(null)
              setFormGeneralError(null)
            }}
            required
          />
          {passwordError && (
            <p className="text-red-500 text-left text-sm mt-1">
              {passwordError}
            </p>
          )}
          <PasswordRequirements password={password} />
          {formGeneralError && (
            <p className="text-red-500 text-left text-sm mt-1">{formGeneralError}</p>
          )}
        </div>
        <div>
          <Input
            type="password"
            placeholder="Confirm New Password"
            className={clsx('w-full', {
              'border-red-500': confirmPasswordError || generalError,
            })}
            value={confirmPassword}
            onChange={(e) => {
              setConfirmPassword(e.target.value)
              setConfirmPasswordError(null)
              setGeneralError(null)
            }}
            required
          />
          {(confirmPasswordError || generalError) && (
            <p className="text-red-500 text-left text-sm mt-1">
              {confirmPasswordError || generalError}
            </p>
          )}
        </div>
        <Button
          type="submit"
          disabled={!password || !confirmPassword || !isPasswordValid(password) || isSubmitting}
          className="w-full py-4 rounded-lg bg-accent-orange text-white hover:bg-accent-orange/80 h-auto text-[20px] font-semibold"
        >
          {isSubmitting ? 'Resetting...' : 'Reset Password'}
        </Button>
      </form>
    </div>
  )
}

export default function ResetPasswordForm({
  onSubmitSuccess,
  onTokenExpired,
}: {
  onSubmitSuccess: () => void
  onTokenExpired: () => void
}) {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <ResetPasswordFormComponent onSubmitSuccess={onSubmitSuccess} onTokenExpired={onTokenExpired} />
    </Suspense>
  )
}
