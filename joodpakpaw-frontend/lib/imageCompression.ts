// lib/imageCompression.ts
/**
 * Client-side WebP image compression and size normalization utility.
 * Addresses Release 1 Retrospective bottleneck where multi-megabyte photos
 * caused slow multipart uploads or reverse-proxy 413 Payload Too Large errors.
 */

export interface ImageCompressionOptions {
  /** Maximum width or height in pixels (default: 1920) */
  maxDimension?: number
  /** WebP encoding quality between 0 and 1 (default: 0.82) */
  quality?: number
}

const DEFAULT_MAX_DIMENSION = 1920
const DEFAULT_QUALITY = 0.82

function replaceExtensionWithWebP(fileName: string): string {
  const trimmed = fileName.trim() || 'upload'
  const lastDotIndex = trimmed.lastIndexOf('.')
  if (lastDotIndex <= 0) {
    return `${trimmed}.webp`
  }
  return `${trimmed.slice(0, lastDotIndex)}.webp`
}

async function decodeImageSource(
  file: File
): Promise<{
  source: CanvasImageSource
  width: number
  height: number
  cleanup: () => void
}> {
  if (typeof createImageBitmap === 'function') {
    const bitmap = await createImageBitmap(file)
    return {
      source: bitmap,
      width: bitmap.width,
      height: bitmap.height,
      cleanup: () => {
        if (typeof bitmap.close === 'function') {
          bitmap.close()
        }
      },
    }
  }

  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      resolve({
        source: img,
        width: img.naturalWidth || img.width,
        height: img.naturalHeight || img.height,
        cleanup: () => URL.revokeObjectURL(objectUrl),
      })
    }
    img.onerror = (err) => {
      URL.revokeObjectURL(objectUrl)
      reject(err)
    }
    img.src = objectUrl
  })
}

/**
 * Compresses and resizes a browser `File` image into `image/webp` format.
 * Safely returns the original `File` when running in SSR, for non-raster images (e.g., SVG/GIF),
 * or if HTML5 `<canvas>` encoding fails.
 */
export async function compressImageToWebP(
  file: File,
  options?: ImageCompressionOptions
): Promise<File> {
  // Guard against SSR or non-File inputs
  if (
    typeof window === 'undefined' ||
    typeof document === 'undefined' ||
    !(file instanceof File)
  ) {
    return file
  }

  // Only compress raster image types; leave SVGs/GIFs/non-images untouched
  if (
    !file.type.startsWith('image/') ||
    file.type === 'image/svg+xml' ||
    file.type === 'image/gif'
  ) {
    return file
  }

  const maxDimension = options?.maxDimension ?? DEFAULT_MAX_DIMENSION
  const quality = options?.quality ?? DEFAULT_QUALITY

  try {
    const { source, width, height, cleanup } = await decodeImageSource(file)

    try {
      if (!width || !height) {
        return file
      }

      let targetWidth = width
      let targetHeight = height

      if (width > maxDimension || height > maxDimension) {
        if (width >= height) {
          targetWidth = maxDimension
          targetHeight = Math.max(1, Math.round((height * maxDimension) / width))
        } else {
          targetHeight = maxDimension
          targetWidth = Math.max(1, Math.round((width * maxDimension) / height))
        }
      } else if (file.type === 'image/webp' && file.size <= 500 * 1024) {
        // Already a compact WebP within target dimensions
        return file
      }

      const canvas = document.createElement('canvas')
      canvas.width = targetWidth
      canvas.height = targetHeight

      const ctx = canvas.getContext('2d')
      if (!ctx) {
        return file
      }

      ctx.drawImage(source, 0, 0, targetWidth, targetHeight)

      const blob = await new Promise<Blob | null>((resolve) => {
        canvas.toBlob((result) => resolve(result), 'image/webp', quality)
      })

      if (!blob || blob.size === 0) {
        return file
      }

      // If original was already WebP within maxDimension and re-encoding produced a larger file, keep original
      if (
        file.type === 'image/webp' &&
        targetWidth === width &&
        targetHeight === height &&
        blob.size >= file.size
      ) {
        return file
      }

      const webpFileName = replaceExtensionWithWebP(file.name)
      return new File([blob], webpFileName, {
        type: 'image/webp',
        lastModified: file.lastModified || Date.now(),
      })
    } finally {
      cleanup()
    }
  } catch {
    return file
  }
}

/**
 * Compresses an array of `File` objects to `image/webp` in parallel.
 */
export async function compressImagesToWebP(
  files: File[],
  options?: ImageCompressionOptions
): Promise<File[]> {
  if (!Array.isArray(files) || files.length === 0) {
    return []
  }
  return Promise.all(files.map((file) => compressImageToWebP(file, options)))
}

/**
 * Inspects all entries in a `FormData` instance and compresses any `File` entries
 * that are images into `image/webp`, returning a new `FormData` with the same field order.
 */
export async function compressFormDataImages(
  formData: FormData,
  options?: ImageCompressionOptions
): Promise<FormData> {
  if (typeof window === 'undefined' || !(formData instanceof FormData)) {
    return formData
  }

  const entries = Array.from(formData.entries())
  const hasImageFile = entries.some(
    ([, value]) => value instanceof File && value.type.startsWith('image/')
  )

  if (!hasImageFile) {
    return formData
  }

  const nextFormData = new FormData()
  for (const [key, value] of entries) {
    if (value instanceof File && value.type.startsWith('image/')) {
      const compressed = await compressImageToWebP(value, options)
      nextFormData.append(key, compressed, compressed.name)
    } else {
      nextFormData.append(key, value)
    }
  }

  return nextFormData
}
