'use client'
import { useState, useMemo } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { signUp } from '@/lib/api'
import { getApiErrorMessages } from '@/lib/errorHandling'
import { isPasswordValid } from '@/lib/utils'
import PasswordRequirements from './PasswordRequirements'
import clsx from 'clsx'

export default function RegisterForm() {
  // Hooks
  const router = useRouter()
  const searchParams = useSearchParams()
  const returnUrl = searchParams.get('returnUrl')

  // State
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [firstname, setFirstname] = useState('')
  const [lastname, setLastname] = useState('')
  const [phone, setPhone] = useState('')
  const [emailError, setEmailError] = useState('')
  const [passwordMismatchError, setPasswordMismatchError] = useState('')
  const [passwordApiError, setPasswordApiError] = useState('')
  const [phoneError, setPhoneError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Memoized values
  const isButtonDisabled = useMemo(() => {
    return (
      !firstname ||
      !lastname ||
      !phone ||
      !email ||
      !password ||
      !confirmPassword ||
      !isPasswordValid(password) ||
      !!passwordMismatchError ||
      !!phoneError
    )
  }, [
    firstname,
    lastname,
    phone,
    email,
    password,
    confirmPassword,
    passwordMismatchError,
    phoneError,
  ])

  // Handlers
  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault()
    setEmailError('')
    setPasswordMismatchError('')
    setPasswordApiError('')
    setPhoneError('')

    if (isButtonDisabled || isSubmitting) return

    if (password !== confirmPassword) {
      setPasswordMismatchError("Passwords don't match")
      return
    }

    setIsSubmitting(true)
    try {
      await signUp({
        email,
        password,
        confirmPassword,
        firstName: firstname,
        lastName: lastname,
        firstname,
        lastname,
        phone,
      })
      const verifyUrl = returnUrl
        ? `/authen/verify-otp?email=${email}&returnUrl=${encodeURIComponent(returnUrl)}`
        : `/authen/verify-otp?email=${email}`
      router.push(verifyUrl)
    } catch (error: unknown) {
      console.error('Sign up failed:', error)
      const apiErrors = getApiErrorMessages(error)
      if (apiErrors) {
        apiErrors.forEach((apiError) => {
          if (apiError.field === 'email') {
            setEmailError(apiError.message)
          } else if (apiError.field === 'password') {
            setPasswordApiError(apiError.message)
          } else if (apiError.field === 'phone') {
            setPhoneError(apiError.message)
          } else {
            toast.error(apiError.message)
          }
        })
      } else {
        toast.error('An unexpected error occurred. Please try again.')
      }
      if (!apiErrors?.some((e) => e.field === 'email')) setEmailError('')
      if (!apiErrors?.some((e) => e.field === 'password'))
        setPasswordApiError('')
      if (!apiErrors?.some((e) => e.field === 'phone')) setPhoneError('')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="px-5 w-full max-w-sm lg:max-w-md text-center mx-auto">
      <form onSubmit={handleSignUp} className="space-y-[30px] mt-10">
        <div>
          <Input
            type="text"
            placeholder="First Name"
            className="w-full"
            value={firstname}
            onChange={(e) => setFirstname(e.target.value)}
          />
        </div>
        <div>
          <Input
            type="text"
            placeholder="Last Name"
            className="w-full"
            value={lastname}
            onChange={(e) => setLastname(e.target.value)}
          />
        </div>
        <div>
          <Input
            type="tel"
            placeholder="Phone Number"
            className={clsx('w-full', {
              'border-red-500': phoneError,
            })}
            value={phone}
            onChange={(e) => {
              const numericValue = e.target.value.replace(/\D/g, '')
              setPhone(numericValue)
              setPhoneError('')
            }}
            maxLength={10}
          />
          {phoneError && (
            <p className="text-red-500 text-left text-sm mt-1">{phoneError}</p>
          )}
        </div>
        <div>
          <Input
            type="email"
            placeholder="Email"
            className={clsx('w-full', {
              'border-red-500': emailError,
            })}
            value={email}
            onChange={(e) => {
              setEmail(e.target.value)
              setEmailError('')
            }}
          />
          {emailError && (
            <p className="text-red-500 text-left text-sm mt-1">{emailError}</p>
          )}
        </div>
        <div>
          <Input
            type="password"
            placeholder="Password"
            className={clsx('w-full', {
              'border-red-500': passwordMismatchError || passwordApiError,
            })}
            value={password}
            onChange={(e) => {
              setPassword(e.target.value)
              setPasswordMismatchError('')
              setPasswordApiError('')
            }}
          />
          {passwordApiError && (
            <p className="text-red-500 text-left text-sm mt-1">
              {passwordApiError}
            </p>
          )}
          <PasswordRequirements password={password} />
        </div>
        <div>
          <Input
            type="password"
            placeholder="Confirm Password"
            className={clsx('w-full', {
              'border-red-500': passwordMismatchError,
            })}
            value={confirmPassword}
            onChange={(e) => {
              setConfirmPassword(e.target.value)
              setPasswordMismatchError('')
            }}
          />
          {passwordMismatchError && (
            <p className="text-red-500 text-left text-sm mt-1">
              {passwordMismatchError}
            </p>
          )}
        </div>
        <Button
          type="submit"
          disabled={isButtonDisabled || isSubmitting}
          className="w-full py-4 rounded-lg bg-accent-orange text-white hover:bg-accent-orange/80 h-auto text-[20px] font-semibold"
        >
          {isSubmitting ? 'Signing up...' : 'Sign up'}
        </Button>
      </form>
      <div className="mt-[30px]">
        <Link href="/authen/login" passHref>
          <div className=" py-4 h-auto text-[20px] font-semibold text-deep-teal">
            Already have an account
          </div>
        </Link>
      </div>
    </div>
  )
}
