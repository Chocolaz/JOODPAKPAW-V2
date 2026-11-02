'use client'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useState } from 'react'
import { forgotPassword } from '@/lib/api'
import Link from 'next/link'
import { getApiErrorMessages } from '@/lib/errorHandling'
import clsx from 'clsx'

interface ForgotPasswordFormProps {
  onSubmitSuccess: (email: string) => void
}

export default function ForgotPasswordForm({
  onSubmitSuccess,
}: ForgotPasswordFormProps) {
  // State
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Handlers
  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (isSubmitting) return

    setIsSubmitting(true)
    try {
      await forgotPassword({ email })
      onSubmitSuccess(email)
    } catch (err) {
      console.error('Forgot password failed:', err)
      const errorResponse = getApiErrorMessages(err)
      const emailError = errorResponse?.find((e) => e.field === 'email')
      const generalError = errorResponse?.find((e) => e.field === 'general')

      if (emailError) {
        setError(emailError.message)
      } else if (generalError) {
        setError(generalError.message)
      } else {
        setError(
          'Failed to send password reset email. Please check the email address and try again.'
        )
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="px-5 w-full max-w-sm lg:max-w-md text-center mx-auto mt-[30px]">
      <form
        onSubmit={handleForgotPassword}
        className="space-y-[30px] mt-[70px]"
      >
        <div>
          <Input
            type="email"
            placeholder="Email"
            className={clsx('w-full', {
              'border-red-500': error,
            })}
            value={email}
            onChange={(e) => {
              setEmail(e.target.value)
              setError('')
            }}
            required
          />
          {error && (
            <p className="text-red-500 text-left text-sm mt-1">{error}</p>
          )}
        </div>
        <Button
          type="submit"
          disabled={!email || isSubmitting}
          className="w-full py-4 rounded-lg bg-accent-orange text-white hover:bg-accent-orange/80 h-auto text-[20px] font-semibold"
        >
          {isSubmitting ? 'Sending...' : 'Confirm'}
        </Button>
      </form>
      <div className="mt-[30px]">
        <Link href="/authen/login" passHref>
          <div className="py-4 text-deep-teal h-auto text-[20px] font-semibold">
            Back to Login
          </div>
        </Link>
      </div>
    </div>
  )
}
