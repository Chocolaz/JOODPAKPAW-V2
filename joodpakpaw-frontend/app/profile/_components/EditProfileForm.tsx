'use client'

import { useState, useRef } from 'react'
import { toast } from 'sonner'
import { UserProfile } from '@/types'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Camera } from 'lucide-react'
import { assetPath } from '@/lib/utils'
import { updateUserProfile } from '@/lib/api'
import { useAuth } from '@/app/_components/AuthContext'
import { CropModal } from '@/app/_components/CropModal'

export const EditProfileForm = ({
  profile,
  onRefreshProfile,
  onCloseDrawer,
}: {
  profile: UserProfile
  onRefreshProfile: () => void
  onCloseDrawer: () => void
}) => {
  const guestAvatarSrc = assetPath('/graphics/guest.jpg')
  const { refreshAuth } = useAuth()
  const [firstName, setFirstName] = useState(profile.firstName)
  const [lastName, setLastName] = useState(profile.lastName)
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(profile.avatar)
  const [cropSrc, setCropSrc] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const isDirty =
    firstName !== profile.firstName ||
    lastName !== profile.lastName ||
    avatarFile !== null

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    setCropSrc(URL.createObjectURL(file))
  }

  const handleCropConfirm = (file: File) => {
    setAvatarFile(file)
    setAvatarPreview(URL.createObjectURL(file))
    if (cropSrc) URL.revokeObjectURL(cropSrc)
    setCropSrc(null)
  }

  const handleCropCancel = () => {
    if (cropSrc) URL.revokeObjectURL(cropSrc)
    setCropSrc(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      const formData = new FormData()
      formData.append('firstName', firstName)
      formData.append('lastName', lastName)
      if (avatarFile) formData.append('avatar', avatarFile)
      await updateUserProfile(profile.id.toString(), formData)
      onRefreshProfile()
      refreshAuth()
      onCloseDrawer()
      toast.success('Profile updated!')
    } catch {
      toast.error('Failed to update profile.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <CropModal
        src={cropSrc}
        aspect={1}
        fileName="avatar.jpg"
        onConfirm={handleCropConfirm}
        onCancel={handleCropCancel}
      />

      <form onSubmit={handleSubmit} className="px-5 pb-8 pt-2 space-y-6">
        {/* Avatar */}
        <div className="flex justify-center">
          <div className="relative">
            <Avatar className="w-24 h-24 ring-4 ring-gray-100">
              <AvatarImage src={avatarPreview || guestAvatarSrc} alt="Avatar preview" />
              <AvatarFallback className="text-2xl bg-gray-100 text-neutral-gray">
                {profile.firstName?.charAt(0)}{profile.lastName?.charAt(0)}
              </AvatarFallback>
            </Avatar>
            {avatarPreview ? (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="absolute bottom-0 right-0 w-8 h-8 flex items-center justify-center rounded-full bg-white shadow-md border border-gray-100 hover:bg-gray-50 transition-colors"
              >
                <Camera className="w-4 h-4 text-neutral-gray" />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40 backdrop-blur-sm"
              >
                <Camera className="w-6 h-6 text-white" />
              </button>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileChange}
            />
          </div>
        </div>

        {/* Fields */}
        <div className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="firstName" className="text-sm font-medium text-neutral-gray">
              First name
            </label>
            <Input
              id="firstName"
              value={firstName}
              onChange={e => setFirstName(e.target.value)}
              placeholder="First name"
              maxLength={60}
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="lastName" className="text-sm font-medium text-neutral-gray">
              Last name
            </label>
            <Input
              id="lastName"
              value={lastName}
              onChange={e => setLastName(e.target.value)}
              placeholder="Last name"
              maxLength={60}
            />
          </div>
        </div>

        <Button
          type="submit"
          className="w-full h-12 text-base bg-positive-green hover:bg-positive-green/90"
          disabled={!isDirty || saving}
        >
          {saving ? 'Saving…' : 'Save changes'}
        </Button>
      </form>
    </>
  )
}
