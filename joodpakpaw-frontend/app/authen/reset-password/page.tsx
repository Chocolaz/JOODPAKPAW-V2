'use client'

import { useState } from 'react'
import AuthHeader from '../_components/AuthHeader'
import ResetPasswordForm from '../_components/ResetPasswordForm'
import Link from 'next/link'
import { Button } from '@/components/ui/button'

type PageState = 'form' | 'success' | 'expired'

const titles: Record<PageState, { heading: string; sub: string }> = {
  form: {
    heading: 'Create a new password',
    sub: "Choose a strong password you'll remember.",
  },
  success: {
    heading: 'Password Reset Successful',
    sub: 'You can now log in with your new password.',
  },
  expired: {
    heading: 'Link Expired',
    sub: 'This reset link has already been used. Please request a new one.',
  },
}

export default function ResetPasswordPage() {
  const [pageState, setPageState] = useState<PageState>('form')
  const { heading, sub } = titles[pageState]

  return (
    <div className="bg-white text-foreground w-full flex flex-col items-center lg:min-h-0">
      <AuthHeader>
        <div className="mt-20 text-center mx-5">
          <h1 className="text-4xl font-bold text-accent-orange mb-[25px]">{heading}</h1>
          <div className="text-[20px]">{sub}</div>
        </div>
      </AuthHeader>

      {/* Desktop title */}
      <div className="hidden lg:block text-center mb-2 mt-2">
        <h1 className="text-3xl xl:text-4xl font-bold text-accent-orange mb-2">{heading}</h1>
        <p className="text-neutral-gray">{sub}</p>
      </div>

      {pageState === 'success' && (
        <div className="px-5 w-full max-w-sm lg:max-w-md text-center mx-auto mt-[30px]">
          <Link href="/authen/login" passHref>
            <Button className="w-full py-4 rounded-lg bg-accent-orange text-white hover:bg-accent-orange/80 h-auto text-[20px] font-semibold">
              Go to Login
            </Button>
          </Link>
        </div>
      )}
      {pageState === 'expired' && (
        <div className="px-5 w-full max-w-sm lg:max-w-md text-center mx-auto mt-[30px] space-y-4">
          <Link href="/authen/forgot-password" passHref>
            <Button className="w-full py-4 rounded-lg bg-accent-orange text-white hover:bg-accent-orange/80 h-auto text-[20px] font-semibold">
              Request New Link
            </Button>
          </Link>
          <Link href="/authen/login" passHref>
            <Button
              variant="outline"
              className="w-full py-4 rounded-lg border-deep-teal text-deep-teal h-auto text-[20px] font-semibold mt-3"
            >
              Back to Login
            </Button>
          </Link>
        </div>
      )}
      {pageState === 'form' && (
        <ResetPasswordForm
          onSubmitSuccess={() => setPageState('success')}
          onTokenExpired={() => setPageState('expired')}
        />
      )}
    </div>
  )
}
