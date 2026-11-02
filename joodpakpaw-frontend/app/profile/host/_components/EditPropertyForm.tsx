'use client'

import { useState } from 'react'
import { Property } from '@/types'
import { useGroupedFacilities } from '../_hooks/useGroupedFacilities'
import { updateProperty } from '@/lib/api'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import { Spinner } from '@/components/ui/spinner'
import { FacilityCard } from './FacilityCard'
import { ImageManager } from '@/app/_components/ImageManager'
import { TitleDescriptionForm } from './TitleDescriptionForm'
import { FormSubmitButton } from './FormSubmitButton'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'

interface EditPropertyFormProps {
  property: Property
  onSuccess: () => void
  variant?: 'mobile' | 'desktop'
}

type Tab = 'property' | 'facilities'

export function EditPropertyForm({ property, onSuccess, variant = 'mobile' }: EditPropertyFormProps) {
  const [activeTab, setActiveTab] = useState<Tab>('property')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [title, setTitle] = useState(property.title)
  const [description, setDescription] = useState(property.description)
  const [newFiles, setNewFiles] = useState<File[]>([])
  const [existingImages, setExistingImages] = useState(property.images)
  const [selectedFacilities, setSelectedFacilities] = useState<number[]>(
    property.facilities?.map((f) => f.id) || []
  )

  const { groupedFacilities, loading: facilitiesLoading, error } = useGroupedFacilities()

  const toggleFacility = (id: number) => {
    setSelectedFacilities((prev) =>
      prev.includes(id) ? prev.filter((fId) => fId !== id) : [...prev, id]
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    const initialImageIds = property.images?.map((img) => img.id) || []
    const finalImageIds = new Set(existingImages.map((img) => img.id))
    const deleteImageIds = initialImageIds.filter((id) => !finalImageIds.has(id))

    const formData = new FormData()
    formData.append('title', title)
    formData.append('description', description)
    formData.append('facilities', JSON.stringify(selectedFacilities))
    formData.append('deleteImageIds', JSON.stringify(deleteImageIds))
    newFiles.forEach((file) => formData.append('images', file))

    try {
      await updateProperty(property.id.toString(), formData)
      toast.success('Property updated successfully!')
      onSuccess()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update property.')
    } finally {
      setIsSubmitting(false)
    }
  }

  // ── Desktop layout ─────────────────────────────────────────────────────────
  if (variant === 'desktop') {
    return (
      <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
        <div className="flex-1 overflow-y-auto scrollbar-modern px-6 py-5">
          <div className="grid grid-cols-[1fr_260px] gap-8">

            {/* Left: title + description + facilities */}
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Title</label>
                <Input
                  type="text"
                  placeholder="Property title"
                  value={title}
                  maxLength={60}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full"
                />
                <p className="text-xs text-gray-400 text-right mt-1">{title.length}/60</p>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Description</label>
                <Textarea
                  placeholder="Describe your property…"
                  value={description}
                  maxLength={300}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full resize-none min-h-32"
                  rows={5}
                />
                <p className="text-xs text-gray-400 text-right mt-1">{description.length}/300</p>
              </div>

              <div>
                <p className="text-sm font-semibold text-gray-700 mb-4">Facilities</p>
                {facilitiesLoading ? (
                  <div className="flex items-center gap-2 text-sm text-gray-400 py-4">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Loading…
                  </div>
                ) : error ? (
                  <p className="text-sm text-red-500">{error}</p>
                ) : (
                  <div className="space-y-5">
                    {Object.entries(groupedFacilities).map(([category, facilities]) => (
                      <div key={category}>
                        <h6 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2">
                          {category}
                        </h6>
                        <div className="grid grid-cols-2 gap-2">
                          {facilities.map((facility) => (
                            <FacilityCard
                              key={facility.id}
                              facility={facility}
                              selected={selectedFacilities.includes(facility.id)}
                              onToggle={toggleFacility}
                            />
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Right: photos */}
            <div className="sticky top-0 self-start">
              <p className="text-sm font-semibold text-gray-700 mb-3">Photos</p>
              <ImageManager
                existingImages={existingImages}
                newFiles={newFiles}
                onExistingImagesChange={setExistingImages}
                onNewFilesChange={setNewFiles}
                renderAsGridAddButton={true}
                layout="grid"
              />
            </div>
          </div>
        </div>

        <div className="shrink-0 border-t border-gray-100 px-6 py-4 flex justify-end">
          <button
            type="submit"
            disabled={isSubmitting}
            className="flex items-center gap-2 px-6 py-2.5 bg-deep-teal text-white text-sm font-semibold rounded-xl hover:bg-deep-teal/90 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
            {isSubmitting ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </form>
    )
  }

  // ── Mobile layout (original) ───────────────────────────────────────────────
  return (
    <form
      className="px-5 h-[80vh] max-w-[500px] flex flex-col overflow-y-scroll hide-scrollbar"
      onSubmit={handleSubmit}
    >
      {/* Sticky Tabs Header */}
      <div className="sticky top-0 bg-white z-10 pb-3">
        <Tabs
          value={activeTab}
          onValueChange={(value) => setActiveTab(value as Tab)}
          className="w-full"
        >
          <TabsList className="flex bg-transparent p-0 justify-center">
            <TabsTrigger
              value="property"
              className="py-2 px-4 rounded-none border-b-2 border-transparent text-neutral-gray
              data-[state=active]:border-accent-orange data-[state=active]:text-accent-orange"
            >
              Property
            </TabsTrigger>
            <TabsTrigger
              value="facilities"
              className="py-2 px-4 rounded-none border-b-2 border-transparent text-neutral-gray
              data-[state=active]:border-accent-orange data-[state=active]:text-accent-orange"
            >
              Facilities
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto hide-scrollbar space-y-4">
        <Tabs value={activeTab}>
          <TabsContent value="property">
            <TitleDescriptionForm
              title={title}
              description={description}
              onTitleChange={setTitle}
              onDescriptionChange={setDescription}
            />
            <div>
              <label className="block font-medium text-deep-teal mb-2">Images</label>
              <ImageManager
                existingImages={existingImages}
                newFiles={newFiles}
                onExistingImagesChange={setExistingImages}
                onNewFilesChange={setNewFiles}
                renderAsGridAddButton={true}
              />
            </div>
          </TabsContent>

          <TabsContent value="facilities">
            <div className="space-y-8 pb-20">
              {facilitiesLoading ? (
                <Spinner />
              ) : error ? (
                <p className="text-red-500">{error}</p>
              ) : (
                Object.entries(groupedFacilities).map(([category, facilities]) => (
                  <div key={category}>
                    <h5 className="text-left text-deep-teal capitalize mb-4">{category}</h5>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                      {facilities.map((facility) => (
                        <FacilityCard
                          key={facility.id}
                          facility={facility}
                          selected={selectedFacilities.includes(facility.id)}
                          onToggle={toggleFacility}
                        />
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Sticky Bottom Button */}
      <div className="sticky bottom-0 bg-white p-4 border-t">
        <FormSubmitButton isSubmitting={isSubmitting} buttonText="Save Changes" />
      </div>
    </form>
  )
}
