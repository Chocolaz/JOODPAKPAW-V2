'use client'

import { useState, useEffect, useRef } from 'react'
import Image from 'next/image'
import { assetPath, cn } from '@/lib/utils'
import { CropModal } from '@/app/_components/CropModal'
import { useUserProfile } from '@/app/profile/_hooks/useUserProfile'
import { useProfileContext } from '@/app/profile/ProfileContext'
import { ErrorState } from '@/app/profile/_components/ErrorState'
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerClose,
} from '@/components/ui/drawer'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import { Input } from '@/components/ui/input'
import { EditProfileForm } from '@/app/profile/_components/EditProfileForm'
import { ChangePasswordForm } from '@/app/profile/_components/ChangePasswordForm'
import { updateUserProfile } from '@/lib/api'
import { useAuth } from '@/app/_components/AuthContext'
import { toast } from 'sonner'
import {
  ChevronLeft,
  PencilLine,
  Mail,
  Phone,
  ShieldCheck,
  Lock,
  Camera,
  X,
  Check,
  User,
  BadgeCheck,
  Loader2,
} from 'lucide-react'

export default function UserProfilePage() {
  const { profile, loading, error, refreshProfile } = useUserProfile()
  const { setMenu } = useProfileContext()
  const { refreshAuth } = useAuth()

  // Mobile drawer state
  const [isEditDrawerOpen, setIsEditDrawerOpen] = useState(false)
  const [isPasswordDrawerOpen, setIsPasswordDrawerOpen] = useState(false)

  // Desktop inline edit state
  const [isEditing, setIsEditing] = useState(false)
  const [isPasswordOpen, setIsPasswordOpen] = useState(false)
  const [saving, setSaving] = useState(false)

  // Crop state
  const [cropSrc, setCropSrc] = useState<string | null>(null)

  // Edit form state (seeded on edit start — avoids synchronous setState in useEffect)
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Mobile header edit button
  useEffect(() => {
    const editButton = (
      <button
        type="button"
        onClick={() => setIsEditDrawerOpen(true)}
        aria-label="Edit profile"
        className="p-2 rounded-full hover:bg-off-white transition-colors"
      >
        <Image
          src={assetPath('/icons/edit.svg')}
          alt="Edit"
          width={22}
          height={22}
        />
      </button>
    )
    setMenu(editButton)
    return () => {
      setMenu(null)
    }
  }, [setMenu])

  const isDirty =
    Boolean(profile) &&
    (firstName !== profile!.firstName ||
      lastName !== profile!.lastName ||
      avatarFile !== null)

  const handleStartEdit = () => {
    if (!profile) return
    setFirstName(profile.firstName)
    setLastName(profile.lastName)
    setAvatarPreview(profile.avatar || null)
    setAvatarFile(null)
    setIsEditing(true)
  }

  const handleCancel = () => {
    setAvatarFile(null)
    setAvatarPreview(null)
    setIsEditing(false)
  }

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
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

  const handleSave = async () => {
    if (!profile || !isDirty) return
    setSaving(true)
    try {
      const formData = new FormData()
      formData.append('firstName', firstName)
      formData.append('lastName', lastName)
      if (avatarFile) formData.append('avatar', avatarFile)
      await updateUserProfile(profile.id.toString(), formData)
      refreshProfile()
      refreshAuth()
      setAvatarFile(null)
      setAvatarPreview(null)
      setIsEditing(false)
      toast.success('Profile updated!')
    } catch {
      toast.error('Failed to update profile.')
    } finally {
      setSaving(false)
    }
  }

  if (error) return <ErrorState message={error} />

  if (loading || !profile) {
    return (
      <div className="max-w-2xl space-y-6">
        <div className="h-12 w-48 rounded-md bg-gray-200 animate-pulse motion-reduce:animate-none" />
        <div className="h-24 rounded-2xl border border-border bg-white animate-pulse motion-reduce:animate-none" />
        <div className="h-64 rounded-2xl border border-border bg-white animate-pulse motion-reduce:animate-none" />
      </div>
    )
  }

  const displayAvatar = (isEditing ? avatarPreview : profile.avatar) || undefined
  const roleLabel =
    profile.role?.map((r) => r.name).join(', ') ||
    (profile.isBecomeToHost ? 'host' : 'guest')

  return (
    <div className="max-w-2xl space-y-8">
      {/* Page Header */}
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-border">
        <div>
          <h1 className="font-bold text-deep-teal">Personal info</h1>
          <p className="text-sm text-neutral-gray mt-1">
            Manage your name, photo, contact details, and password
          </p>
        </div>

        {/* Desktop inline actions */}
        <div className="hidden lg:flex items-center gap-2 shrink-0">
          {isEditing ? (
            <>
              <button
                type="button"
                onClick={handleCancel}
                disabled={saving}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-border text-sm font-medium text-neutral-gray hover:text-deep-teal hover:bg-off-white transition-colors disabled:opacity-40 cursor-pointer"
              >
                <X className="w-4 h-4" />
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={!isDirty || saving}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-accent-orange text-white text-sm font-semibold hover:opacity-95 transition-opacity disabled:opacity-40 cursor-pointer"
              >
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    Save changes
                  </>
                )}
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={handleStartEdit}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-deep-teal text-white text-sm font-medium hover:opacity-95 transition-opacity cursor-pointer"
            >
              <PencilLine className="w-4 h-4" />
              Edit profile
            </button>
          )}
        </div>

        {/* Mobile edit drawer trigger */}
        <div className="lg:hidden">
          <button
            type="button"
            onClick={() => setIsEditDrawerOpen(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-deep-teal text-white text-sm font-medium cursor-pointer"
          >
            <PencilLine className="w-4 h-4" />
            Edit profile
          </button>
        </div>
      </header>

      {/* Avatar & Identity Card */}
      <section className="rounded-2xl border border-border bg-off-white/60 p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4 min-w-0">
          <div className="relative shrink-0">
            <Avatar className="w-18 h-18 ring-2 ring-white border border-border overflow-hidden">
              <AvatarImage
                src={displayAvatar}
                alt={`${profile.firstName} ${profile.lastName}`}
              />
              <AvatarFallback className="text-xl bg-white text-deep-teal font-semibold">
                {profile.firstName?.charAt(0)}
                {profile.lastName?.charAt(0)}
              </AvatarFallback>
            </Avatar>
            {saving && (
              <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/50">
                <Loader2 className="w-5 h-5 animate-spin text-white" />
              </div>
            )}
          </div>

          <div className="min-w-0 space-y-1">
            {isEditing ? (
              <div className="flex flex-wrap gap-2.5">
                <Input
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  maxLength={60}
                  placeholder="First name"
                  className="max-w-[170px] bg-white"
                  disabled={saving}
                />
                <Input
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  maxLength={60}
                  placeholder="Last name"
                  className="max-w-[170px] bg-white"
                  disabled={saving}
                />
              </div>
            ) : (
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="font-semibold text-deep-teal">
                  {profile.firstName} {profile.lastName}
                </h2>
                {profile.isVerifiedHost && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                    <BadgeCheck className="w-3.5 h-3.5" />
                    Verified host
                  </span>
                )}
              </div>
            )}
            <p className="text-sm text-neutral-gray truncate">{profile.email}</p>
          </div>
        </div>

        {isEditing && (
          <div className="shrink-0">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={saving}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-border bg-white text-sm font-medium text-deep-teal hover:bg-off-white transition-colors cursor-pointer"
            >
              <Camera className="w-4 h-4" />
              Change photo
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleAvatarChange}
              disabled={saving}
            />
          </div>
        )}
      </section>

      {/* Personal Information Table */}
      <section className="space-y-3">
        <h2 className="font-semibold text-deep-teal">Contact &amp; identity</h2>
        <div className="divide-y divide-border rounded-2xl border border-border bg-white px-5">
          <InfoRow
            icon={<User className="w-4 h-4" />}
            label="First name"
            value={isEditing ? firstName : profile.firstName}
          />
          <InfoRow
            icon={<User className="w-4 h-4" />}
            label="Last name"
            value={isEditing ? lastName : profile.lastName}
          />
          <InfoRow
            icon={<Mail className="w-4 h-4" />}
            label="Email address"
            value={profile.email}
            locked
          />
          <InfoRow
            icon={<Phone className="w-4 h-4" />}
            label="Phone number"
            value={profile.phone || '—'}
            locked
            tabular
          />
        </div>
      </section>

      {/* Account & Security Table */}
      <section className="space-y-3">
        <h2 className="font-semibold text-deep-teal">Account &amp; security</h2>
        <div className="divide-y divide-border rounded-2xl border border-border bg-white px-5">
          <InfoRow
            icon={<BadgeCheck className="w-4 h-4" />}
            label="Account role"
            value={roleLabel}
            locked
          />
          <InfoRow
            icon={<ShieldCheck className="w-4 h-4" />}
            label="Identity verification"
            value={profile.isVerifiedHost ? 'Verified' : 'Not verified'}
            locked
            verified={profile.isVerifiedHost}
          />
          <div className="flex items-center justify-between gap-4 py-4">
            <div className="flex items-center gap-3">
              <span className="text-neutral-gray">
                <Lock className="w-4 h-4" />
              </span>
              <div>
                <p className="text-sm font-medium text-deep-teal">Password</p>
                <p className="text-xs text-neutral-gray">
                  Update your password regularly to keep your account secure
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                if (typeof window !== 'undefined' && window.innerWidth < 1024) {
                  setIsPasswordDrawerOpen(true)
                } else {
                  setIsPasswordOpen(true)
                }
              }}
              className="px-3.5 py-2 rounded-xl border border-border text-sm font-medium text-deep-teal hover:bg-off-white transition-colors shrink-0 cursor-pointer"
            >
              Change password
            </button>
          </div>
        </div>
      </section>

      {/* Mobile Edit Profile Drawer */}
      <Drawer open={isEditDrawerOpen} onOpenChange={setIsEditDrawerOpen}>
        <DrawerContent aria-describedby={undefined} className="max-h-[90vh] overflow-y-auto">
          <DrawerHeader>
            <div className="flex items-center justify-between">
              <DrawerClose asChild>
                <button
                  type="button"
                  aria-label="Close"
                  className="p-2 rounded-full hover:bg-gray-100 transition-colors"
                >
                  <ChevronLeft className="w-6 h-6 text-neutral-gray" />
                </button>
              </DrawerClose>
              <DrawerTitle>Edit profile</DrawerTitle>
              <div className="w-10" />
            </div>
          </DrawerHeader>
          <EditProfileForm
            profile={profile}
            onRefreshProfile={refreshProfile}
            onCloseDrawer={() => setIsEditDrawerOpen(false)}
          />
        </DrawerContent>
      </Drawer>

      {/* Mobile Change Password Drawer */}
      <Drawer
        open={isPasswordDrawerOpen}
        onOpenChange={setIsPasswordDrawerOpen}
      >
        <DrawerContent aria-describedby={undefined} className="max-h-[90vh] overflow-y-auto">
          <DrawerHeader>
            <div className="flex items-center justify-between">
              <DrawerClose asChild>
                <button
                  type="button"
                  aria-label="Close"
                  className="p-2 rounded-full hover:bg-gray-100 transition-colors"
                >
                  <ChevronLeft className="w-6 h-6 text-neutral-gray" />
                </button>
              </DrawerClose>
              <DrawerTitle>Change password</DrawerTitle>
              <div className="w-10" />
            </div>
          </DrawerHeader>
          <ChangePasswordForm
            onCloseDrawer={() => setIsPasswordDrawerOpen(false)}
          />
        </DrawerContent>
      </Drawer>

      {/* Avatar crop modal */}
      <CropModal
        src={cropSrc}
        aspect={1}
        fileName="avatar.jpg"
        onConfirm={handleCropConfirm}
        onCancel={handleCropCancel}
      />

      {/* Desktop change password dialog */}
      <Dialog open={isPasswordOpen} onOpenChange={setIsPasswordOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>Change password</DialogTitle>
          </DialogHeader>
          <ChangePasswordForm onCloseDrawer={() => setIsPasswordOpen(false)} />
        </DialogContent>
      </Dialog>
    </div>
  )
}

function InfoRow({
  icon,
  label,
  value,
  locked,
  verified,
  tabular,
}: {
  icon: React.ReactNode
  label: string
  value: string
  locked?: boolean
  verified?: boolean
  tabular?: boolean
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-4">
      <div className="flex items-center gap-3 min-w-0">
        <span className="text-neutral-gray shrink-0">{icon}</span>
        <span className="text-sm text-neutral-gray">{label}</span>
      </div>
      <div className="flex items-center gap-2 min-w-0">
        <span
          className={cn(
            'text-sm font-medium truncate',
            tabular && 'tabular-nums',
            verified === true
              ? 'text-emerald-700'
              : verified === false
                ? 'text-neutral-gray'
                : 'text-foreground'
          )}
        >
          {value}
        </span>
        {locked && <Lock className="w-3.5 h-3.5 text-neutral-gray/50 shrink-0" />}
      </div>
    </div>
  )
}
