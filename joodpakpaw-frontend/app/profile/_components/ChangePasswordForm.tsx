'use client'

import { toast } from 'sonner'
import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { resetPassword } from '@/lib/authApi'
import { handleError } from '@/lib/errorHandling'
import { isPasswordValid } from '@/lib/utils'
import PasswordRequirements from '@/app/authen/_components/PasswordRequirements'
import { useAuth } from '@/app/_components/AuthContext'

export const ChangePasswordForm = ({
  onCloseDrawer,
}: {
  onCloseDrawer: () => void
}) => {
  const { user } = useAuth()
  const [oldPassword, setOldPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<{ [key: string]: string }>({})

  const isDirty =
    oldPassword !== '' || newPassword !== '' || confirmPassword !== ''

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setError(null)
    setFieldErrors({})

    if (!user?.id) {
      setError('User not authenticated.')
      return
    }

    if (newPassword !== confirmPassword) {
      setError("New passwords don't match.")
      return
    }
    if (!isPasswordValid(newPassword)) {
      setError('Password does not meet all requirements.')
      return
    }
    if (newPassword.length > 128) {
      setError('Password cannot exceed 128 characters.')
      return
    }

    try {
      await resetPassword(user.id.toString(), {
        oldPassword,
        newPassword,
        confirmPassword,
      })
      setOldPassword('')
      setNewPassword('')
      setConfirmPassword('')
      onCloseDrawer()
      toast.success('Password changed successfully!')
    } catch (error) {
      handleError(error, 'Failed to change password. Please try again.', {
        setGeneralError: setError,
        setFieldError: (field, message) => {
          setFieldErrors((prev) => ({ ...prev, [field]: message }))
        },
      })
    }
  }

  return (
    <form onSubmit={handleSubmit} className="pb-4 px-14">
      <div className="space-y-4">
        <div className="space-y-1">
          <label htmlFor="oldPassword" className="text-sm text-deep-teal">
            Old Password
          </label>
          <Input
            id="oldPassword"
            type="password"
            value={oldPassword}
            onChange={(e) => setOldPassword(e.target.value)}
            placeholder="Enter your old password"
            maxLength={128}
          />
          {fieldErrors.oldPassword && (
            <p className="text-sm text-red-500">{fieldErrors.oldPassword}</p>
          )}
        </div>
        <div className="space-y-1">
          <label htmlFor="newPassword" className="text-sm text-deep-teal">
            New Password
          </label>
          <Input
            id="newPassword"
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="Enter your new password"
            maxLength={128}
          />
          <PasswordRequirements password={newPassword} />
        </div>
        <div className="space-y-1">
          <label htmlFor="confirmPassword" className="text-sm text-deep-teal">
            Confirm New Password
          </label>
          <Input
            id="confirmPassword"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Confirm your new password"
            maxLength={128}
          />
          {error && <p className="text-sm text-red-500">{error}</p>}
        </div>
      </div>
      <Button
        type="submit"
        className="w-full mt-6 bg-positive-green h-12 text-[16px]"
        disabled={
          !isDirty ||
          oldPassword.length < 8 ||
          !isPasswordValid(newPassword) ||
          confirmPassword.length < 8
        }
      >
        Change Password
      </Button>
    </form>
  )
}
