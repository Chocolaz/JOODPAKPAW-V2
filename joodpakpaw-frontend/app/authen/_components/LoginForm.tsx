'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useState, useMemo } from 'react'
import { signIn } from '@/lib/api'
import { useRouter, useSearchParams } from 'next/navigation'
import { getApiErrorMessages, ApiError } from '@/lib/errorHandling'
import clsx from 'clsx'
import { useAuth } from '@/app/_components/AuthContext'

export default function LoginForm() {
  // Hooks
  const router = useRouter()
  const searchParams = useSearchParams()
  const { login } = useAuth()

  const returnUrl = searchParams.get('returnUrl')
  const safeReturnUrl = returnUrl?.startsWith('/') ? returnUrl : '/'

  // State
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isEmailError, setIsEmailError] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Memoized values
  const isButtonDisabled = useMemo(() => {
    return !email || !password || password.length < 8
  }, [email, password])

  // Handlers
  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault()
    if (isButtonDisabled || isSubmitting) return

    setIsSubmitting(true)
    try {
      const data = await signIn({ email, password })
      if (data.accessToken && data.refreshToken) {
        const user = await login(data.accessToken, data.refreshToken)
        const isAdmin = user?.role.some((r) => r.name === 'admin')
        router.push(isAdmin ? '/admin/dashboard' : safeReturnUrl)
      } else {
        console.error('Sign in successful, but no tokens received.')
        setError('Sign in failed. Please try again.')
        setIsEmailError(false)
      }
    } catch (err: unknown) {
      console.error('Sign in failed:', err)
      const messages = getApiErrorMessages(err)
      if (messages && messages.length > 0) {
        setError(messages[0].message)
        if (err instanceof ApiError && err.code === 'T-2007') {
          setIsEmailError(true)
        } else {
          setIsEmailError(false)
        }
      } else {
        setError('Sign in failed. Please check your credentials and try again.')
        setIsEmailError(false)
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="px-5 w-full max-w-sm lg:max-w-md text-center mx-auto mt-[30px]">
      <form onSubmit={handleSignIn} className="space-y-[30px] mt-[70px]">
        <div>
          <Input
            type="email"
            placeholder="Email"
            className={clsx('w-full', {
              'border-red-500': isEmailError,
            })}
            value={email}
            onChange={(e) => {
              setEmail(e.target.value)
              setError('')
              setIsEmailError(false)
            }}
          />
        </div>
        <div>
          <Input
            type="password"
            placeholder="Password"
            className={clsx('w-full', {
              'border-red-500': error && !isEmailError,
            })}
            value={password}
            onChange={(e) => {
              setPassword(e.target.value)
              setError('')
              setIsEmailError(false)
            }}
          />
          {error && (
            <p className="text-red-500 text-left text-sm mt-1">{error}</p>
          )}
          <div className="text-right mt-2">
            <Link
              href="/authen/forgot-password"
              className="text-sm text-accent-orange font-medium hover:underline"
            >
              Forgot your password?
            </Link>
          </div>
        </div>
        <Button
          type="submit"
          disabled={isButtonDisabled || isSubmitting}
          className="w-full py-4 rounded-lg bg-accent-orange text-white hover:bg-accent-orange/80 h-auto text-[20px] font-semibold"
        >
          {isSubmitting ? 'Signing in...' : 'Sign in'}
        </Button>
      </form>
      <div className="mt-[30px]">
        <Link href="/authen/register" passHref>
          <div className="py-4  text-deep-teal h-auto text-[20px] font-semibold">
            Create new account
          </div>
        </Link>
      </div>
    </div>
  )
}
