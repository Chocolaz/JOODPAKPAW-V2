'use client'

import { useRef } from 'react'
import Image from 'next/image'
import { Upload, Camera } from 'lucide-react'

export function ImageUploadBox({
  label,
  description,
  file,
  onFileSelected,
}: {
  label: string
  description: string
  file: File | null
  onFileSelected: (file: File) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const preview = file ? URL.createObjectURL(file) : null

  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-semibold text-deep-teal">{label}</span>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="relative w-full aspect-[4/3] rounded-[20px] border-2 border-dashed border-gray-200 hover:border-accent-orange bg-gray-50 hover:bg-accent-orange/5 transition-all duration-200 overflow-hidden group"
      >
        {preview ? (
          <>
            <Image src={preview} alt={label} fill className="object-cover" unoptimized />
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <Camera className="w-7 h-7 text-white" />
            </div>
          </>
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-4">
            <div className="w-12 h-12 rounded-full bg-deep-teal/8 flex items-center justify-center group-hover:bg-accent-orange/10 transition-colors">
              <Upload className="w-5 h-5 text-deep-teal/50 group-hover:text-accent-orange transition-colors" />
            </div>
            <span className="text-xs text-neutral-gray text-center">Tap to upload</span>
          </div>
        )}
      </button>
      <p className="text-xs text-neutral-gray">{description}</p>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) onFileSelected(f)
          e.target.value = ''
        }}
      />
    </div>
  )
}
