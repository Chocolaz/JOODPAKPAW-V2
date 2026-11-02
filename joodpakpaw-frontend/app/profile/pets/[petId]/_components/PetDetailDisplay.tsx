'use client'

import { useState, useEffect } from 'react'
import { PetProfile } from '@/types'
import { Button } from '@/components/ui/button'
import {
  Phone,
  User,
  Mars,
  Venus,
  Zap,
  Scale,
  Edit,
  Trash2,
  ChevronLeft,
  Cake,
  PawPrint,
  Notebook,
} from 'lucide-react'
import { differenceInYears, differenceInMonths, format } from 'date-fns'
import { useProfileContext } from '@/app/profile/ProfileContext'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { deletePetProfile } from '@/lib/api'
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { ConfirmationModal } from '@/app/_components/ConfirmationModal'
import EditPetProfileForm from './EditPetProfileForm'

interface PetDetailDisplayProps {
  pet: PetProfile
  onDelete?: () => void
  onPetUpdate: () => void
}

export default function PetDetailDisplay({
  pet,
  onDelete,
  onPetUpdate,
}: PetDetailDisplayProps) {
  const { petProfiles } = useProfileContext()
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH || ''
  const pawPrintSrc = `${basePath}/icons/PawPrint.svg`

  const birthDate = pet.birthDate ? new Date(pet.birthDate) : null
  const ageYears = birthDate ? differenceInYears(new Date(), birthDate) : null
  const ageMonths = birthDate
    ? differenceInMonths(new Date(), birthDate) % 12
    : null
  const formattedBirthDate = birthDate
    ? format(birthDate, 'MMM d, yyyy')
    : 'N/A'

  const ageDisplay =
    ageYears !== null
      ? ageYears > 0
        ? `${ageYears} yr${ageYears !== 1 ? 's' : ''}${ageMonths ? ` ${ageMonths} mo` : ''}`
        : `${ageMonths} mo`
      : 'N/A'

  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [isEditDrawerOpen, setIsEditDrawerOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const [isHydrated, setIsHydrated] = useState(false)
  const router = useRouter()

  useEffect(() => {
    setIsHydrated(true)
    const checkMobile = () => setIsMobile(window.innerWidth < 768)
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  const handleDelete = async () => {
    try {
      setIsDeleting(true)
      await deletePetProfile(String(pet.id))
      await petProfiles.refetch()
      toast.success(`${pet.name} has been deleted.`)
      router.push('/profile/pets')
    } catch (error) {
      console.error('Failed to delete pet profile:', error)
      toast.error('Failed to delete pet profile.')
    } finally {
      setIsDeleting(false)
      setIsDeleteDialogOpen(false)
    }
  }

  // Energy level bar (1-5)
  const energyLevel = pet.rating ?? 0
  const energyLabel =
    energyLevel <= 1
      ? 'Calm'
      : energyLevel <= 2
        ? 'Low'
        : energyLevel <= 3
          ? 'Medium'
          : energyLevel <= 4
            ? 'Active'
            : 'Hyper'

  return (
    <div className="bg-white">
      {/* ========== MOBILE LAYOUT ========== */}
      <div className="md:hidden">
        {/* Hero image */}
        <div className="relative w-full aspect-[4/3]">
          {pet.image ? (
            <img src={pet.image} alt={pet.name} className="object-cover w-full h-full" />
          ) : (
            <div className="w-full h-full bg-gray-100 flex items-center justify-center">
              <img src={pawPrintSrc} alt="No image" className="w-24 h-24 opacity-20" />
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />

          {/* Top bar */}
          <button
            onClick={() => router.push('/profile/pets')}
            className="absolute top-4 left-4 p-2 bg-white/80 backdrop-blur-sm rounded-full shadow-sm hover:bg-white transition-colors"
          >
            <ChevronLeft className="w-5 h-5 text-neutral-gray" />
          </button>

          <div className="absolute top-4 right-4 flex gap-2">
            <button
              onClick={() => setIsEditDrawerOpen(true)}
              className="p-2 bg-white/80 backdrop-blur-sm rounded-full shadow-sm hover:bg-white transition-colors"
            >
              <Edit className="w-4 h-4 text-neutral-gray" />
            </button>
            <button
              onClick={() => setIsDeleteDialogOpen(true)}
              className="p-2 bg-white/80 backdrop-blur-sm rounded-full shadow-sm hover:bg-white transition-colors"
            >
              <Trash2 className="w-4 h-4 text-red-500" />
            </button>
          </div>

          {/* Name overlay on image */}
          <div className="absolute bottom-0 left-0 right-0 px-5 pb-5">
            <h1 className="text-3xl font-bold text-white drop-shadow-md">
              {pet.name}
            </h1>
            {pet.petBreedName && (
              <p className="text-white/90 text-sm mt-0.5 capitalize drop-shadow-sm">
                {pet.petBreedName}
              </p>
            )}
          </div>
        </div>

        {/* Stat pills row */}
        <div className="px-5 -mt-4 relative z-10">
          <div className="flex gap-2 overflow-x-auto hide-scrollbar pb-1">
            <StatPill
              icon={<Cake className="w-3.5 h-3.5" />}
              value={ageDisplay}
              color="bg-orange-50 text-accent-orange"
            />
            <StatPill
              icon={
                pet.sex === 'male' ? (
                  <Mars className="w-3.5 h-3.5" />
                ) : (
                  <Venus className="w-3.5 h-3.5" />
                )
              }
              value={pet.sex === 'male' ? 'Male' : 'Female'}
              color={
                pet.sex === 'male'
                  ? 'bg-blue-50 text-blue-600'
                  : 'bg-pink-50 text-pink-600'
              }
            />
            {pet.petSizeName && (
              <StatPill
                icon={<Scale className="w-3.5 h-3.5" />}
                value={pet.petSizeName}
                color="bg-teal-50 text-deep-teal"
              />
            )}
            <StatPill
              icon={<Zap className="w-3.5 h-3.5" />}
              value={energyLabel}
              color="bg-yellow-50 text-yellow-600"
            />
          </div>
        </div>

        {/* Detail cards */}
        <div className="px-5 mt-4 space-y-3">
          {/* Birthday card */}
          <DetailCard>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-orange-50 flex items-center justify-center shrink-0">
                <Cake className="w-5 h-5 text-accent-orange" />
              </div>
              <div>
                <p className="text-xs text-neutral-gray">Birthday</p>
                <p className="font-medium text-deep-teal">
                  {formattedBirthDate}
                </p>
              </div>
            </div>
          </DetailCard>

          {/* Energy level card */}
          <DetailCard>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-yellow-50 flex items-center justify-center shrink-0">
                  <Zap className="w-5 h-5 text-yellow-500" />
                </div>
                <div>
                  <p className="text-xs text-neutral-gray">Energy Level</p>
                  <p className="font-medium text-deep-teal">{energyLabel}</p>
                </div>
              </div>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((level) => (
                  <div
                    key={level}
                    className={`w-2 h-5 rounded-full ${
                      level <= energyLevel ? 'bg-yellow-400' : 'bg-gray-200'
                    }`}
                  />
                ))}
              </div>
            </div>
          </DetailCard>

          {/* Owner contact card */}
          {(pet.contactName || pet.contactPhone) && (
            <DetailCard>
              <p className="text-xs text-neutral-gray mb-3 uppercase tracking-wide font-semibold">
                Owner Contact
              </p>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-green-50 flex items-center justify-center shrink-0">
                    <User className="w-5 h-5 text-positive-green" />
                  </div>
                  <div>
                    <p className="font-medium text-deep-teal">
                      {pet.contactName}
                    </p>
                    {pet.contactPhone && (
                      <p className="text-xs text-neutral-gray">
                        {pet.contactPhone}
                      </p>
                    )}
                  </div>
                </div>
                {pet.contactPhone && (
                  <a href={`tel:${pet.contactPhone}`}>
                    <Button
                      size="sm"
                      className="bg-positive-green hover:bg-positive-green/90 rounded-xl h-9 px-4"
                    >
                      <Phone className="w-4 h-4 mr-1.5" />
                      Call
                    </Button>
                  </a>
                )}
              </div>
            </DetailCard>
          )}

          {/* About / Notes card */}
          {pet.note && (
            <DetailCard>
              <div className="flex items-center gap-2 mb-3">
                <Notebook className="w-4 h-4 text-deep-teal" />
                <p className="text-xs text-neutral-gray uppercase tracking-wide font-semibold">
                  About {pet.name}
                </p>
              </div>
              <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
                {pet.note}
              </p>
            </DetailCard>
          )}
        </div>
      </div>

      {/* ========== DESKTOP / TABLET LAYOUT ========== */}
      <div className="hidden md:block px-6 lg:px-8 py-6">
        {/* Back button */}
        <button
          onClick={() => router.push('/profile/pets')}
          className="flex items-center gap-1 text-neutral-gray hover:text-deep-teal transition-colors mb-4"
        >
          <ChevronLeft className="w-5 h-5" />
          <span className="text-sm">Back to Pets</span>
        </button>

        <div className="grid grid-cols-12 gap-6 lg:gap-8">
          {/* Left — Image + actions */}
          <div className="col-span-5">
            <div className="sticky top-24 space-y-4">
              <div className="relative rounded-2xl overflow-hidden shadow-md aspect-square bg-gray-100 flex items-center justify-center">
                {pet.image ? (
                  <img src={pet.image} alt={pet.name} className="object-cover w-full h-full" />
                ) : (
                  <img src={pawPrintSrc} alt="No image" className="w-24 h-24 opacity-20" />
                )}
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1 h-10 gap-2"
                  onClick={() => setIsEditDrawerOpen(true)}
                >
                  <Edit className="w-4 h-4" />
                  Edit
                </Button>
                <Button
                  variant="outline"
                  className="h-10 gap-2 text-red-500 border-red-200 hover:bg-red-50 hover:text-red-600"
                  onClick={() => setIsDeleteDialogOpen(true)}
                >
                  <Trash2 className="w-4 h-4" />
                  Delete
                </Button>
              </div>
            </div>
          </div>

          {/* Right — Details */}
          <div className="col-span-7 space-y-5">
            {/* Header */}
            <div>
              <h1 className="text-3xl font-bold text-deep-teal">{pet.name}</h1>
              {pet.petBreedName && (
                <div className="flex items-center gap-1.5 mt-1">
                  <PawPrint className="w-4 h-4 text-neutral-gray" />
                  <p className="text-neutral-gray capitalize">
                    {pet.petBreedName}
                  </p>
                </div>
              )}
            </div>

            {/* Stat pills */}
            <div className="flex flex-wrap gap-2">
              <StatPill
                icon={<Cake className="w-3.5 h-3.5" />}
                value={ageDisplay}
                color="bg-orange-50 text-accent-orange"
              />
              <StatPill
                icon={
                  pet.sex === 'male' ? (
                    <Mars className="w-3.5 h-3.5" />
                  ) : (
                    <Venus className="w-3.5 h-3.5" />
                  )
                }
                value={pet.sex === 'male' ? 'Male' : 'Female'}
                color={
                  pet.sex === 'male'
                    ? 'bg-blue-50 text-blue-600'
                    : 'bg-pink-50 text-pink-600'
                }
              />
              {pet.petSizeName && (
                <StatPill
                  icon={<Scale className="w-3.5 h-3.5" />}
                  value={pet.petSizeName}
                  color="bg-teal-50 text-deep-teal"
                />
              )}
              <StatPill
                icon={<Zap className="w-3.5 h-3.5" />}
                value={energyLabel}
                color="bg-yellow-50 text-yellow-600"
              />
            </div>

            {/* Detail cards */}
            <DetailCard>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-orange-50 flex items-center justify-center shrink-0">
                    <Cake className="w-5 h-5 text-accent-orange" />
                  </div>
                  <div>
                    <p className="text-xs text-neutral-gray">Birthday</p>
                    <p className="font-medium text-deep-teal">
                      {formattedBirthDate}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-yellow-50 flex items-center justify-center shrink-0">
                    <Zap className="w-5 h-5 text-yellow-500" />
                  </div>
                  <div>
                    <p className="text-xs text-neutral-gray">Energy</p>
                    <p className="font-medium text-deep-teal">{energyLabel}</p>
                  </div>
                  <div className="flex gap-1 ml-2">
                    {[1, 2, 3, 4, 5].map((level) => (
                      <div
                        key={level}
                        className={`w-2 h-5 rounded-full ${
                          level <= energyLevel ? 'bg-yellow-400' : 'bg-gray-200'
                        }`}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </DetailCard>

            {/* Owner contact */}
            {(pet.contactName || pet.contactPhone) && (
              <DetailCard>
                <p className="text-xs text-neutral-gray mb-3 uppercase tracking-wide font-semibold">
                  Owner Contact
                </p>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-green-50 flex items-center justify-center shrink-0">
                      <User className="w-5 h-5 text-positive-green" />
                    </div>
                    <div>
                      <p className="font-medium text-deep-teal">
                        {pet.contactName}
                      </p>
                      {pet.contactPhone && (
                        <p className="text-xs text-neutral-gray">
                          {pet.contactPhone}
                        </p>
                      )}
                    </div>
                  </div>
                  {pet.contactPhone && (
                    <a href={`tel:${pet.contactPhone}`}>
                      <Button
                        size="sm"
                        className="bg-positive-green hover:bg-positive-green/90 rounded-xl h-9 px-4"
                      >
                        <Phone className="w-4 h-4 mr-1.5" />
                        Call
                      </Button>
                    </a>
                  )}
                </div>
              </DetailCard>
            )}

            {/* About */}
            {pet.note && (
              <DetailCard>
                <div className="flex items-center gap-2 mb-3">
                  <Notebook className="w-4 h-4 text-deep-teal" />
                  <p className="text-xs text-neutral-gray uppercase tracking-wide font-semibold">
                    About {pet.name}
                  </p>
                </div>
                <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
                  {pet.note}
                </p>
              </DetailCard>
            )}
          </div>
        </div>
      </div>

      {/* Edit Pet Drawer (Mobile) / Modal (Desktop) */}
      {isHydrated && (
        isMobile ? (
          <Drawer open={isEditDrawerOpen} onOpenChange={setIsEditDrawerOpen}>
            <DrawerContent>
              <div className="mx-auto w-full max-w-md">
                <DrawerHeader>
                  <DrawerTitle>Edit {pet.name}</DrawerTitle>
                </DrawerHeader>
                <EditPetProfileForm
                  pet={pet}
                  onClose={() => setIsEditDrawerOpen(false)}
                  onSuccess={() => {
                    onPetUpdate()
                    setIsEditDrawerOpen(false)
                  }}
                />
              </div>
            </DrawerContent>
          </Drawer>
        ) : (
          <Dialog open={isEditDrawerOpen} onOpenChange={setIsEditDrawerOpen}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Edit {pet.name}</DialogTitle>
              </DialogHeader>
              <EditPetProfileForm
                pet={pet}
                onClose={() => setIsEditDrawerOpen(false)}
                onSuccess={() => {
                  onPetUpdate()
                  setIsEditDrawerOpen(false)
                }}
              />
            </DialogContent>
          </Dialog>
        )
      )}

      <ConfirmationModal
        isOpen={isDeleteDialogOpen}
        onClose={() => setIsDeleteDialogOpen(false)}
        onConfirm={handleDelete}
        title={`Delete ${pet.name}?`}
        message="This action cannot be undone. This will permanently delete your pet profile."
        titleClassName="text-red-600"
        confirmButtonClassName="bg-red-600 hover:bg-red-700"
      />
    </div>
  )
}

function StatPill({
  icon,
  value,
  color,
}: {
  icon: React.ReactNode
  value: string
  color: string
}) {
  return (
    <div
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap shadow-sm ${color}`}
    >
      {icon}
      <span className="capitalize">{value}</span>
    </div>
  )
}

function DetailCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl p-4 shadow-md border border-gray-200/60">
      {children}
    </div>
  )
}
