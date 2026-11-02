'use client'

import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'

interface TitleDescriptionFormProps {
  title: string
  description: string
  onTitleChange: (value: string) => void
  onDescriptionChange: (value: string) => void
}

export function TitleDescriptionForm({
  title,
  description,
  onTitleChange,
  onDescriptionChange,
}: TitleDescriptionFormProps) {
  return (
    <div className="space-y-4 px-1 text-left">
      {/* Title */}
      <div>
        <label className="font-medium text-deep-teal mb-1 block">Title</label>
        <Input
          type="text"
          placeholder="Property Title"
          value={title}
          maxLength={60}
          onChange={(e) => onTitleChange(e.target.value)}
          className="w-full"
        />
        <p className="text-xs text-neutral-gray text-right">
          {title.length}/60
        </p>
      </div>

      {/* Description */}
      <div>
        <label className="font-medium text-deep-teal mb-1 block">
          Description
        </label>
        <Textarea
          placeholder="Property Description"
          value={description}
          maxLength={300}
          onChange={(e) => onDescriptionChange(e.target.value)}
          className="p-6 text-lg min-h-40 w-full resize-none"
        />
        <p className="text-xs text-neutral-gray text-right">
          {description.length}/300
        </p>
      </div>
    </div>
  )
}
