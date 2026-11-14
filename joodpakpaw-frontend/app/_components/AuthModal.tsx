'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { signIn, signUp, verifyOtp, resendOtp, forgotPassword } from '@/lib/api'
import { useAuth } from '@/app/_components/AuthContext'
import { getApiErrorMessages, ApiError } from '@/lib/errorHandling'
import { isPasswordValid } from '@/lib/utils'
import { useCooldown } from '@/lib/authenUtils'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import clsx from 'clsx'
import Image from 'next/image'
import { assetPath } from '@/lib/utils'
import PasswordRequirements from '@/app/authen/_components/PasswordRequirements'
import type { AuthModalStep, AuthModalOptions } from '@/app/_context/AuthModalContext'

interface AuthModalProps {
  isOpen: boolean
  step: AuthModalStep
  options: AuthModalOptions
  onClose: () => void
  onStepChange: (step: AuthModalStep, opts?: Partial<AuthModalOptions>) => void
}

// ── Login ───────────────────────────────────────────────────────────────────

function LoginStep({
  options,
  onClose,
  onStepChange,
}: {
  options: AuthModalOptions
  onClose: () => void
  onStepChange: (step: AuthModalStep, opts?: Partial<AuthModalOptions>) => void
}) {
  const { login } = useAuth()
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isEmailError, setIsEmailError] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const isDisabled = !email || !password || password.length < 8

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (isDisabled || isSubmitting) return
    setIsSubmitting(true)
    try {
      const data = await signIn({ email, password })
      if (data.accessToken && data.refreshToken) {
        const user = await login(data.accessToken, data.refreshToken)
        const isAdmin = user?.role.some((r) => r.name === 'admin')
        onClose()
        router.push(isAdmin ? '/admin/dashboard' : (options.returnUrl || '/'))
      }
    } catch (err) {
      const messages = getApiErrorMessages(err)
      if (messages?.length) {
        setError(messages[0].message)
        setIsEmailError(err instanceof ApiError && err.code === 'T-2007')
      } else {
        setError('Sign in failed. Please check your credentials and try again.')
        setIsEmailError(false)
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col items-center gap-1">
        <div className="relative w-[110px] sm:w-[140px] h-[80px] sm:h-[104px]">
          <Image
            src={assetPath('/graphics/welcome.svg')}
            alt="Welcome"
            fill
            className="object-contain"
            priority
          />
        </div>
        <h2 className="text-xl sm:text-2xl font-bold text-accent-orange">Login Here</h2>
        <p className="text-xs sm:text-sm text-neutral-gray text-center max-w-xs sm:max-w-none">
          Glad to see you again! Let&apos;s find the perfect stay for your furry friend.
        </p>
      </div>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          type="email"
          placeholder="Email"
          value={email}
          className={clsx({ 'border-red-500': isEmailError })}
          onChange={(e) => {
            setEmail(e.target.value)
            setError('')
            setIsEmailError(false)
          }}
        />
        <div>
          <Input
            type="password"
            placeholder="Password"
            value={password}
            className={clsx({ 'border-red-500': error && !isEmailError })}
            onChange={(e) => {
              setPassword(e.target.value)
              setError('')
            }}
          />
          {error && <p className="text-red-500 text-sm mt-1">{error}</p>}
          <div className="text-right mt-1.5">
            <button
              type="button"
              onClick={() => onStepChange('forgot')}
              className="text-sm text-accent-orange hover:underline underline-offset-2"
            >
              Forgot your password?
            </button>
          </div>
        </div>
        <Button
          type="submit"
          disabled={isDisabled || isSubmitting}
          className="w-full bg-accent-orange hover:bg-accent-orange/80 text-white font-semibold h-11 rounded-xl"
        >
          {isSubmitting ? 'Signing in...' : 'Sign in'}
        </Button>
      </form>
      <div className="text-center">
        <button
          type="button"
          onClick={() => onStepChange('register')}
          className="text-deep-teal font-semibold hover:underline underline-offset-2"
        >
          Create new account
        </button>
      </div>
    </div>
  )
}

// ── Register ─────────────────────────────────────────────────────────────────

function RegisterStep({
  options,
  onStepChange,
}: {
  options: AuthModalOptions
  onStepChange: (step: AuthModalStep, opts?: Partial<AuthModalOptions>) => void
}) {
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

  const isDisabled =
    !firstname ||
    !lastname ||
    !phone ||
    !email ||
    !password ||
    !confirmPassword ||
    !isPasswordValid(password) ||
    !!passwordMismatchError ||
    !!phoneError

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setEmailError('')
    setPasswordMismatchError('')
    setPasswordApiError('')
    setPhoneError('')
    if (isDisabled || isSubmitting) return
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
      onStepChange('verify-otp', { email, returnUrl: options.returnUrl })
    } catch (error) {
      const apiErrors = getApiErrorMessages(error)
      if (apiErrors) {
        apiErrors.forEach((apiError) => {
          if (apiError.field === 'email') setEmailError(apiError.message)
          else if (apiError.field === 'password') setPasswordApiError(apiError.message)
          else if (apiError.field === 'phone') setPhoneError(apiError.message)
          else toast.error(apiError.message)
        })
      } else {
        toast.error('An unexpected error occurred. Please try again.')
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="space-y-5">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-accent-orange">Create Account</h2>
        <p className="text-sm text-neutral-gray mt-1">Join JoodPakPaw today</p>
      </div>
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input
            placeholder="First Name"
            value={firstname}
            onChange={(e) => setFirstname(e.target.value)}
          />
          <Input
            placeholder="Last Name"
            value={lastname}
            onChange={(e) => setLastname(e.target.value)}
          />
        </div>
        <div>
          <Input
            type="tel"
            placeholder="Phone Number"
            value={phone}
            className={clsx({ 'border-red-500': phoneError })}
            onChange={(e) => {
              setPhone(e.target.value.replace(/\D/g, ''))
              setPhoneError('')
            }}
            maxLength={10}
          />
          {phoneError && <p className="text-red-500 text-sm mt-1">{phoneError}</p>}
        </div>
        <div>
          <Input
            type="email"
            placeholder="Email"
            value={email}
            className={clsx({ 'border-red-500': emailError })}
            onChange={(e) => {
              setEmail(e.target.value)
              setEmailError('')
            }}
          />
          {emailError && <p className="text-red-500 text-sm mt-1">{emailError}</p>}
        </div>
        <div>
          <Input
            type="password"
            placeholder="Password"
            value={password}
            className={clsx({ 'border-red-500': passwordMismatchError || passwordApiError })}
            onChange={(e) => {
              setPassword(e.target.value)
              setPasswordMismatchError('')
              setPasswordApiError('')
            }}
          />
          {passwordApiError && (
            <p className="text-red-500 text-sm mt-1">{passwordApiError}</p>
          )}
          <PasswordRequirements password={password} />
        </div>
        <div>
          <Input
            type="password"
            placeholder="Confirm Password"
            value={confirmPassword}
            className={clsx({ 'border-red-500': passwordMismatchError })}
            onChange={(e) => {
              setConfirmPassword(e.target.value)
              setPasswordMismatchError('')
            }}
          />
          {passwordMismatchError && (
            <p className="text-red-500 text-sm mt-1">{passwordMismatchError}</p>
          )}
        </div>
        <Button
          type="submit"
          disabled={isDisabled || isSubmitting}
          className="w-full bg-accent-orange hover:bg-accent-orange/80 text-white font-semibold h-11 rounded-xl"
        >
          {isSubmitting ? 'Signing up...' : 'Sign up'}
        </Button>
      </form>
      <div className="text-center">
        <button
          type="button"
          onClick={() => onStepChange('login')}
          className="text-deep-teal font-semibold hover:underline underline-offset-2"
        >
          Already have an account
        </button>
      </div>
    </div>
  )
}

// ── Verify OTP ───────────────────────────────────────────────────────────────

function VerifyOtpStep({
  options,
  onClose,
}: {
  options: AuthModalOptions
  onClose: () => void
}) {
  const { login } = useAuth()
  const router = useRouter()
  const { cooldown, startCooldown } = useCooldown()
  const email = options.email || ''
  const [otp, setOtp] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (otp.length !== 6 || isSubmitting) return
    setIsSubmitting(true)
    try {
      const data = await verifyOtp({ email, otp })
      if (data.accessToken && data.refreshToken) {
        await login(data.accessToken, data.refreshToken)
        onClose()
        router.push(options.returnUrl || '/')
      }
    } catch {
      toast.error('Invalid or expired OTP. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleResend = async () => {
    if (cooldown > 0) return
    try {
      await resendOtp({ email })
      toast.success('A new OTP has been sent to your email.')
      startCooldown(60)
    } catch {
      toast.error('Failed to resend OTP. Please try again later.')
    }
  }

  return (
    <div className="space-y-5">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-accent-orange">Verify your email</h2>
        <p className="text-sm text-neutral-gray mt-1">
          We&apos;ve sent a 6-digit code to{' '}
          <strong className="text-deep-teal">{email}</strong>
        </p>
      </div>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          type="text"
          placeholder="000000"
          className="text-center tracking-[0.5rem] sm:tracking-[1rem] text-lg sm:text-xl font-mono"
          value={otp}
          onChange={(e) => setOtp(e.target.value.replace(/[^0-9]/g, ''))}
          maxLength={6}
        />
        <Button
          type="submit"
          disabled={otp.length !== 6 || isSubmitting}
          className="w-full bg-accent-orange hover:bg-accent-orange/80 text-white font-semibold h-11 rounded-xl"
        >
          {isSubmitting ? 'Verifying...' : 'Confirm'}
        </Button>
      </form>
      <div className="text-center text-sm">
        <span className="text-neutral-gray">Didn&apos;t get the code? </span>
        <button
          type="button"
          onClick={handleResend}
          disabled={cooldown > 0}
          className="text-accent-orange font-semibold disabled:text-gray-400 disabled:cursor-not-allowed"
        >
          {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend OTP'}
        </button>
      </div>
    </div>
  )
}

// ── Forgot Password ───────────────────────────────────────────────────────────

function ForgotStep({
  onStepChange,
}: {
  onStepChange: (step: AuthModalStep, opts?: Partial<AuthModalOptions>) => void
}) {
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || isSubmitting) return
    setIsSubmitting(true)
    try {
      await forgotPassword({ email })
      onStepChange('forgot-sent', { email })
    } catch (err) {
      const errors = getApiErrorMessages(err)
      setError(
        errors?.find((e) => e.field === 'email')?.message ||
        errors?.find((e) => e.field === 'general')?.message ||
        'Failed to send reset email. Please try again.'
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="space-y-5">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-accent-orange">Forgot Password?</h2>
        <p className="text-sm text-neutral-gray mt-1">
          Enter your email and we&apos;ll send you a reset link.
        </p>
      </div>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <Input
            type="email"
            placeholder="Email"
            value={email}
            className={clsx({ 'border-red-500': error })}
            onChange={(e) => {
              setEmail(e.target.value)
              setError('')
            }}
            required
          />
          {error && <p className="text-red-500 text-sm mt-1">{error}</p>}
        </div>
        <Button
          type="submit"
          disabled={!email || isSubmitting}
          className="w-full bg-accent-orange hover:bg-accent-orange/80 text-white font-semibold h-11 rounded-xl"
        >
          {isSubmitting ? 'Sending...' : 'Send Reset Link'}
        </Button>
      </form>
      <div className="text-center">
        <button
          type="button"
          onClick={() => onStepChange('login')}
          className="text-deep-teal font-semibold hover:underline underline-offset-2"
        >
          Back to Login
        </button>
      </div>
    </div>
  )
}

// ── Forgot Sent ───────────────────────────────────────────────────────────────

function ForgotSentStep({
  options,
  onStepChange,
}: {
  options: AuthModalOptions
  onStepChange: (step: AuthModalStep) => void
}) {
  return (
    <div className="space-y-5 text-center py-2">
      <div className="w-16 h-16 rounded-full bg-deep-teal/10 flex items-center justify-center mx-auto">
        <svg className="w-8 h-8 text-deep-teal" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.917V6.75" />
        </svg>
      </div>
      <div>
        <h2 className="text-2xl font-bold text-accent-orange">Check your email</h2>
        <p className="text-sm text-neutral-gray mt-2">
          We&apos;ve sent a password reset link to{' '}
          <strong className="text-deep-teal">{options.email}</strong>
        </p>
      </div>
      <button
        type="button"
        onClick={() => onStepChange('login')}
        className="text-deep-teal font-semibold hover:underline underline-offset-2"
      >
        Back to Login
      </button>
    </div>
  )
}

// ── Main Modal ────────────────────────────────────────────────────────────────

const BACK_STEPS: Partial<Record<AuthModalStep, AuthModalStep>> = {
  register: 'login',
  forgot: 'login',
  'forgot-sent': 'login',
  'verify-otp': 'register',
}

export function AuthModal({ isOpen, step, options, onClose, onStepChange }: AuthModalProps) {
  const backStep = BACK_STEPS[step]

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50">
          <motion.div
            className="absolute inset-0 bg-black/60"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
          />
          <div className="absolute inset-0 flex items-center justify-center p-3 sm:p-4 pointer-events-none">
            <motion.div
              className="relative bg-white rounded-2xl shadow-xl w-full max-w-md pointer-events-auto overflow-hidden flex flex-col max-h-[calc(100dvh-1.5rem)] sm:max-h-[calc(100dvh-2rem)]"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              transition={{ duration: 0.22, ease: 'easeOut' }}
            >
              {/* Diagonal radial gradient — orange from top */}
              <div
                className="pointer-events-none absolute top-0 inset-x-0 h-72"
                style={{
                  background: 'radial-gradient(ellipse 140% 120% at 15% -5%, rgba(255,111,60,0.22) 0%, transparent 65%)',
                }}
              />

              {/* Header */}
              <div className="relative flex items-center justify-between px-4 sm:px-5 pt-4 shrink-0">
                {backStep ? (
                  <button
                    onClick={() => onStepChange(backStep)}
                    className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-neutral-gray transition"
                  >
                    <ArrowLeft className="w-4 h-4" />
                  </button>
                ) : (
                  <div className="w-8" />
                )}
                <button
                  onClick={onClose}
                  className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-neutral-gray transition"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Step content */}
              <div className="relative px-4 sm:px-6 pb-6 pt-2 overflow-y-auto overscroll-contain flex-1">
                <AnimatePresence>
                  <motion.div
                    key={step}
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10, position: 'absolute' }}
                    transition={{ duration: 0.15 }}
                  >
                    {step === 'login' && (
                      <LoginStep options={options} onClose={onClose} onStepChange={onStepChange} />
                    )}
                    {step === 'register' && (
                      <RegisterStep options={options} onStepChange={onStepChange} />
                    )}
                    {step === 'verify-otp' && (
                      <VerifyOtpStep options={options} onClose={onClose} />
                    )}
                    {step === 'forgot' && (
                      <ForgotStep onStepChange={onStepChange} />
                    )}
                    {step === 'forgot-sent' && (
                      <ForgotSentStep options={options} onStepChange={onStepChange} />
                    )}
                  </motion.div>
                </AnimatePresence>
              </div>
            </motion.div>
          </div>
        </div>
      )}
    </AnimatePresence>
  )
}
