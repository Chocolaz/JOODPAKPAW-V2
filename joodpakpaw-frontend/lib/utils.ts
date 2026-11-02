import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { Pet, RoomCategories } from '@/types'

const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH || ''
const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL

export function assetPath(path: string): string {
  return `${BASE_PATH}${path}`
}

export function getApiImageUrl(path: string | null | undefined): string | null {
  if (!path || typeof path !== 'string' || path.trim() === '') return null
  if (path.startsWith('http://') || path.startsWith('https://') || path.startsWith('data:image/')) return path

  try {
    // If path starts with /, remove it for new URL(path, base) to work correctly as a relative path to base
    const relativePath = path.startsWith('/') ? path.slice(1) : path
    return new URL(relativePath, API_BASE_URL).toString()
  } catch (e) {
    console.error('Failed to construct API image URL:', e)
    return null
  }
}

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function getLowestPrice(
  roomCategories: RoomCategories | RoomCategories[] | undefined
): number | null {
  if (!roomCategories) {
    return null
  }

  if (Array.isArray(roomCategories)) {
    if (roomCategories.length === 0) {
      return null
    }
    return Math.min(...roomCategories.map((rc) => rc.basePrice))
  }

  // It's a single object
  return roomCategories.basePrice
}

export function normalizeRoomCategories(
  roomCategories: RoomCategories | RoomCategories[] | undefined
): RoomCategories[] {
  if (Array.isArray(roomCategories)) {
    return roomCategories
  }
  if (roomCategories) {
    return [roomCategories]
  }
  return []
}

export function validatePassword(password: string) {
  return {
    minLength: password.length >= 8,
    hasUppercase: /[A-Z]/.test(password),
    hasLowercase: /[a-z]/.test(password),
    hasNumber: /[0-9]/.test(password),
    hasSpecialChar: /[^A-Za-z0-9]/.test(password),
    isAsciiOnly: /^[\x20-\x7E]*$/.test(password),
  }
}

export function isPasswordValid(password: string): boolean {
  const v = validatePassword(password)
  return (
    v.minLength && v.hasUppercase && v.hasLowercase && v.hasNumber && v.hasSpecialChar && v.isAsciiOnly
  )
}

export function formatPetSizeRange(min: number, max: number): string {
  if (max >= 999) return `${min}+ kg`
  if (min === 0) return `0–${max} kg`
  return `${min}–${max} kg`
}

export function getPetPolicy(pets: Pet[] | undefined): string | null {
  if (!pets || pets.length === 0) {
    return null
  }

  const allowedPets = new Set(pets.map((p) => p.name.toLowerCase()))

  const hasDog = allowedPets.has('dog')
  const hasCat = allowedPets.has('cat')

  if (hasDog && hasCat) {
    return 'Cat & Dog'
  }
  if (hasDog) {
    return 'Dog Only'
  }
  if (hasCat) {
    return 'Cat Only'
  }

  return null
}
