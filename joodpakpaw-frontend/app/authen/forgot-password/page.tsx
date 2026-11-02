'use client'

import AuthHeader from '../_components/AuthHeader'
import ForgotPasswordForm from '../_components/ForgotPasswordForm'
import { useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'

export default function ForgotPasswordPage() {
  const [isSubmitted, setIsSubmitted] = useState(false)
  const [email, setEmail] = useState('')

  const handleSuccess = (submittedEmail: string) => {
    setEmail(submittedEmail)
    setIsSubmitted(true)
  }

  return (
    <div className="bg-white text-foreground w-full flex flex-col items-center lg:min-h-0">
      <AuthHeader>
        <div className="mt-20 text-center mx-5">
          {isSubmitted ? (
            <>
              <h1 className="text-4xl font-bold text-accent-orange mb-[25px]">
                Check your email
              </h1>
              <div className="text-[20px]">
                We have sent a password reset link to <strong>{email}</strong>
                <br /> Please check your email
              </div>
            </>
          ) : (
            <>
              <h1 className="text-4xl font-bold text-accent-orange mb-[25px]">
                Forgot your password?
              </h1>
              <div className="text-[20px]">
                Enter your email and we&apos;ll send you a link to create a new password.
              </div>
            </>
          )}
        </div>
      </AuthHeader>

      {/* Desktop title */}
      <div className="hidden lg:block text-center mb-2 mt-2">
        {isSubmitted ? (
          <>
            <h1 className="text-3xl xl:text-4xl font-bold text-accent-orange mb-2">Check your email</h1>
            <p className="text-neutral-gray">We have sent a password reset link to <strong>{email}</strong></p>
          </>
        ) : (
          <>
            <h1 className="text-3xl xl:text-4xl font-bold text-accent-orange mb-2">Forgot your password?</h1>
            <p className="text-neutral-gray">Enter your email and we&apos;ll send you a link to create a new password.</p>
          </>
        )}
      </div>

      {isSubmitted ? (
        <div className="px-5 w-full max-w-sm lg:max-w-md text-center mx-auto mt-[30px]">
          <div className="mt-6">
            <Link href="/authen/login" passHref>
              <Button className="w-full py-4 rounded-lg bg-accent-orange text-white hover:bg-accent-orange/80 h-auto text-[20px] font-semibold">
                Back to Login
              </Button>
            </Link>
          </div>
        </div>
      ) : (
        <ForgotPasswordForm onSubmitSuccess={handleSuccess} />
      )}
    </div>
  )
}
