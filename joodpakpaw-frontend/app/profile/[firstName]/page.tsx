'use client'

import { useState, useEffect, useRef } from 'react'
import Image from 'next/image'
import { motion, AnimatePresence } from 'framer-motion'
import { assetPath } from '@/lib/utils'
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
import { ProfileCard } from '@/app/profile/_components/ProfileCard'
import { EditProfileForm } from '@/app/profile/_components/EditProfileForm'
import { ChangePasswordForm } from '@/app/profile/_components/ChangePasswordForm'
import { updateUserProfile } from '@/lib/api'
import { useAuth } from '@/app/_components/AuthContext'
import { toast } from 'sonner'
import {
  ArrowLeft,
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
} from 'lucide-react'
import { useRouter } from 'next/navigation'

export default function UserProfilePage() {
  const { profile, loading, error, refreshProfile } = useUserProfile()
  const { setMenu } = useProfileContext()
  const { refreshAuth } = useAuth()
  const router = useRouter()

  // Mobile drawer state
  const [isEditDrawerOpen, setIsEditDrawerOpen] = useState(false)
  const [isPasswordDrawerOpen, setIsPasswordDrawerOpen] = useState(false)

  // Desktop state
  const [isEditing, setIsEditing] = useState(false)
  const [isPasswordOpen, setIsPasswordOpen] = useState(false)
  const [saving, setSaving] = useState(false)

  // Crop state
  const [cropSrc, setCropSrc] = useState<string | null>(null)

  // Edit form state
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const basePath = process.env.NEXT_PUBLIC_BASE_PATH || ''
  const guestAvatarSrc = `${basePath}/graphics/guest.jpg`

  // Sync edit state when profile loads
  useEffect(() => {
    if (profile) {
      setFirstName(profile.firstName)
      setLastName(profile.lastName)
      setAvatarPreview(profile.avatar || null)
    }
  }, [profile])

  // Mobile header edit button
  useEffect(() => {
    const editButton = (
      <button
        onClick={() => setIsEditDrawerOpen(true)}
        className="p-2 rounded-full hover:bg-gray-100 transition-colors"
      >
        <Image
          src={assetPath('/icons/edit.svg')}
          alt="Edit"
          width={24}
          height={24}
        />
      </button>
    )
    setMenu(editButton)
    return () => {
      setMenu(null)
    }
  }, [setMenu])

  const isDirty =
    firstName !== profile?.firstName ||
    lastName !== profile?.lastName ||
    avatarFile !== null

  const handleStartEdit = () => {
    if (profile) {
      setFirstName(profile.firstName)
      setLastName(profile.lastName)
      setAvatarPreview(profile.avatar || null)
      setAvatarFile(null)
    }
    setIsEditing(true)
  }

  const handleCancel = () => {
    if (profile) {
      setFirstName(profile.firstName)
      setLastName(profile.lastName)
      setAvatarPreview(profile.avatar || null)
      setAvatarFile(null)
    }
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
      setIsEditing(false)
      toast.success('Profile updated!')
    } catch {
      toast.error('Failed to update profile.')
    } finally {
      setSaving(false)
    }
  }

  if (error) return <ErrorState message={error} />

  const displayAvatar = avatarPreview || guestAvatarSrc
  const roleLabel =
    profile?.role?.map((r) => r.name).join(', ') ||
    (profile?.isBecomeToHost ? 'Host' : 'Guest')

  return (
    <AnimatePresence mode="wait">
    {!profile ? null : (
    <motion.div
      key="profile"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
    >

      {/* ── Mobile ── */}
      <div className="lg:hidden">
        <Drawer open={isEditDrawerOpen} onOpenChange={setIsEditDrawerOpen}>
          <div className="px-5">
            <ProfileCard
              profile={profile}
              onPasswordChangeClick={() => setIsPasswordDrawerOpen(true)}
            />
          </div>
          <DrawerContent aria-describedby={undefined}>
            <DrawerHeader>
              <div className="flex items-center">
                <DrawerClose asChild>
                  <button className="p-2 rounded-full hover:bg-gray-100 transition-colors">
                    <ChevronLeft className="w-6 h-6 text-neutral-gray" />
                  </button>
                </DrawerClose>
                <DrawerTitle>Edit Profile</DrawerTitle>
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

        <Drawer
          open={isPasswordDrawerOpen}
          onOpenChange={setIsPasswordDrawerOpen}
        >
          <DrawerContent aria-describedby={undefined}>
            <DrawerHeader>
              <div className="flex items-center">
                <DrawerClose asChild>
                  <button className="p-2 rounded-full hover:bg-gray-100 transition-colors">
                    <ChevronLeft className="w-6 h-6 text-neutral-gray" />
                  </button>
                </DrawerClose>
                <DrawerTitle>Change Password</DrawerTitle>
                <div className="w-10" />
              </div>
            </DrawerHeader>
            <ChangePasswordForm
              onCloseDrawer={() => setIsPasswordDrawerOpen(false)}
            />
          </DrawerContent>
        </Drawer>
      </div>

      {/* ── Desktop ── */}
      <div className="hidden lg:block px-12 py-8 max-w-3xl mx-auto w-full">
        {/* Main card */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          {/* Banner */}
          <div className="h-36 relative bg-gradient-to-br from-deep-teal via-deep-teal/80 to-positive-green/60">
            <div className="absolute top-2 right-6 w-24 h-24 rounded-full bg-white/10" />
            <div className="absolute -bottom-2 left-8 w-16 h-16 rounded-full bg-white/5" />
            <div className="absolute top-4 left-1/2 w-12 h-12 rounded-full bg-white/5" />

            {/* Back — top left of banner */}
            <button
              onClick={() => router.back()}
              className="absolute top-4 left-4 flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/20 text-white/80 text-sm hover:bg-white/10 transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Back
            </button>

            {/* Edit / Save / Cancel — top right of banner */}
            <div className="absolute top-4 right-4 flex items-center gap-2">
              <AnimatePresence mode="wait">
                {isEditing ? (
                  <motion.div
                    key="editing-btns"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="flex items-center gap-2"
                  >
                    <button
                      onClick={handleCancel}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/20 text-white/80 text-sm hover:bg-white/10 transition-colors"
                    >
                      <X className="w-3.5 h-3.5" />
                      Cancel
                    </button>
                    <button
                      onClick={handleSave}
                      disabled={!isDirty || saving}
                      className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-white text-deep-teal text-sm font-semibold hover:bg-white/90 transition-colors disabled:opacity-40"
                    >
                      <Check className="w-3.5 h-3.5" />
                      {saving ? 'Saving…' : 'Save'}
                    </button>
                  </motion.div>
                ) : (
                  <motion.button
                    key="edit-btn"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={handleStartEdit}
                    className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg border border-white/20 text-white/80 text-sm hover:bg-white/10 transition-colors"
                  >
                    <PencilLine className="w-3.5 h-3.5" />
                    Edit Profile
                  </motion.button>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Avatar + name — avatar overlaps banner */}
          <div className="px-8 pb-6">
            <div className="flex items-end justify-between -mt-12">
              {/* Avatar */}
              <div className="relative shrink-0">
                <Avatar className="w-24 h-24 ring-4 ring-white shadow-lg">
                  <AvatarImage
                    src={displayAvatar}
                    alt={`${profile.firstName} ${profile.lastName}`}
                  />
                  <AvatarFallback className="text-2xl bg-gray-100 text-deep-teal font-semibold">
                    {profile.firstName?.charAt(0)}
                    {profile.lastName?.charAt(0)}
                  </AvatarFallback>
                </Avatar>
                <AnimatePresence>
                  {isEditing && (
                    <motion.button
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.8 }}
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40 backdrop-blur-sm"
                    >
                      <Camera className="w-5 h-5 text-white" />
                    </motion.button>
                  )}
                </AnimatePresence>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleAvatarChange}
                />
              </div>
            </div>

            {/* Name + role */}
            <div className="mt-3">
              <AnimatePresence mode="wait">
                {isEditing ? (
                  <motion.div
                    key="edit-name"
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    className="flex gap-3"
                  >
                    <Input
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      maxLength={60}
                      placeholder="First name"
                      className="max-w-[180px]"
                    />
                    <Input
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      maxLength={60}
                      placeholder="Last name"
                      className="max-w-[180px]"
                    />
                  </motion.div>
                ) : (
                  <motion.div
                    key="view-name"
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                  >
                    <div className="flex items-center gap-2">
                      <h2 className="text-xl font-semibold text-deep-teal">
                        {profile.firstName} {profile.lastName}
                      </h2>
                      {profile.isVerifiedHost && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-500">
                          <BadgeCheck className="w-3 h-3" />
                          Verified Host
                        </span>
                      )}
                    </div>
                    <div className="mt-1.5 flex flex-col gap-1">
                      <div className="flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5 text-neutral-gray/70 shrink-0" />
                        <span className="text-sm text-neutral-gray">
                          {(profile.role?.some(r => r.name === 'host') || profile.isBecomeToHost) ? 'Host' : 'Guest'}
                        </span>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Body */}
          <div className="px-8 py-6 space-y-8">
            {/* Personal Information */}
            <section>
              <h3 className="text-xs font-semibold text-neutral-gray uppercase tracking-widest mb-4">
                Personal Information
              </h3>
              <div className="divide-y divide-gray-50">
                <InfoRow
                  icon={<User className="w-4 h-4" />}
                  label="First Name"
                  value={profile.firstName}
                  editable={isEditing}
                  editNode={
                    <span className="text-sm text-gray-700">{firstName}</span>
                  }
                />
                <InfoRow
                  icon={<User className="w-4 h-4" />}
                  label="Last Name"
                  value={profile.lastName}
                  editable={isEditing}
                  editNode={
                    <span className="text-sm text-gray-700">{lastName}</span>
                  }
                />
                <InfoRow
                  icon={<Mail className="w-4 h-4" />}
                  label="Email"
                  value={profile.email}
                  locked
                />
                <InfoRow
                  icon={<Phone className="w-4 h-4" />}
                  label="Phone"
                  value={profile.phone || '—'}
                  locked
                />
              </div>
            </section>

            {/* Security */}
            <section>
              <h3 className="text-xs font-semibold text-neutral-gray uppercase tracking-widest mb-4">
                Account & Security
              </h3>
              <div className="divide-y divide-gray-50">
                <InfoRow
                  icon={<BadgeCheck className="w-4 h-4" />}
                  label="Role"
                  value={roleLabel}
                  locked
                />
                <InfoRow
                  icon={<ShieldCheck className="w-4 h-4" />}
                  label="Identity Verification"
                  value={profile.isVerifiedHost ? 'Verified' : 'Not verified'}
                  locked
                  verified={profile.isVerifiedHost}
                />
                <div className="flex items-center justify-between py-3.5">
                  <div className="flex items-center gap-3">
                    <span className="text-neutral-gray">
                      <ShieldCheck className="w-4 h-4" />
                    </span>
                    <span className="text-sm text-neutral-gray">Password</span>
                  </div>
                  <button
                    onClick={() => setIsPasswordOpen(true)}
                    className="flex items-center gap-1.5 text-sm text-deep-teal font-medium hover:underline transition-all"
                  >
                    Change Password
                  </button>
                </div>
              </div>
            </section>
          </div>
        </div>
      </div>

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
        <DialogContent className="max-w-md" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>Change Password</DialogTitle>
          </DialogHeader>
          <ChangePasswordForm onCloseDrawer={() => setIsPasswordOpen(false)} />
        </DialogContent>
      </Dialog>
    </motion.div>
    )}
    </AnimatePresence>
  )
}

function InfoRow({
  icon,
  label,
  value,
  locked,
  editable,
  editNode,
  verified,
}: {
  icon: React.ReactNode
  label: string
  value: string
  locked?: boolean
  editable?: boolean
  editNode?: React.ReactNode
  verified?: boolean
}) {
  return (
    <div className="flex items-center justify-between py-3.5">
      <div className="flex items-center gap-3">
        <span className="text-neutral-gray">{icon}</span>
        <span className="text-sm text-neutral-gray">{label}</span>
      </div>
      <div className="flex items-center gap-2">
        {editable && editNode ? (
          editNode
        ) : (
          <span className={`text-sm font-medium ${verified === true ? 'text-blue-500' : verified === false ? 'text-neutral-gray' : 'text-gray-800'}`}>
            {value}
          </span>
        )}
        {locked && <Lock className="w-3 h-3 text-gray-300" />}
      </div>
    </div>
  )
}
